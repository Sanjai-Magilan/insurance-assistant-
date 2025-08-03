// Vercel serverless function for the insurance assistant
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

// Import all services
const { GroqAnalyzer } = require('../src/services/groqAnalyzer.js');
const { HealthInsuranceClaimAnalyzer } = require('../src/services/healthInsuranceAnalyzer.js');
const { PlanManager } = require('../src/services/planManager.js');
const { ClaimEligibilityEngine } = require('../src/services/claimEligibilityEngine.js');
const { ChatOrchestrator } = require('../src/services/chatOrchestrator.js');
const { ResponseFormatter } = require('../src/services/responseFormatter.js');
const { PlanContextManager } = require('../src/services/planContextManager.js');

// Initialize services
const groqAnalyzer = new GroqAnalyzer();
const healthAnalyzer = new HealthInsuranceClaimAnalyzer();
const planManager = new PlanManager();
const claimEligibilityEngine = new ClaimEligibilityEngine();
const planContextManager = new PlanContextManager();
const chatOrchestrator = new ChatOrchestrator();

const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Health Check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    services: {
      groq: 'available',
      planManager: 'available',
      claimAnalyzer: 'available'
    }
  });
});

// Chat API
app.post('/api/chat', async (req, res) => {
  try {
    const { 
      message, 
      sessionId = 'default',
      planId = '',
      llmProvider = 'groq'
    } = req.body;

    if (!message || !message.trim()) {
      return res.status(400).json({ 
        success: false,
        error: 'Message is required' 
      });
    }

    if (!planId || !planId.trim()) {
      return res.status(400).json({ 
        success: false,
        error: 'Plan selection is required. Please select a plan first.',
        response: ResponseFormatter.formatDynamicResponse(
          'Please select a health insurance plan before asking questions. Use the plan selector on the left to choose your plan.',
          { company: 'System', planName: 'Plan Selection Required', sumInsured: '' },
          'standard'
        )
      });
    }

    const result = await chatOrchestrator.processMessage(sessionId, message, planId);

    if (result.success) {
      res.json({
        success: true,
        response: result.response,
        sessionId: result.sessionId,
        planContext: result.planContext,
        timestamp: result.timestamp
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error,
        response: result.response
      });
    }

  } catch (error) {
    console.error('❌ Chat API error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Internal server error',
      response: ResponseFormatter.formatDynamicResponse(
        `I apologize, but I encountered an error: ${error.message}. Please try again or contact support.`,
        { company: 'System', planName: 'Error', sumInsured: '' },
        'standard'
      )
    });
  }
});

// Plans API
app.get('/api/plans/list', async (req, res) => {
  try {
    const allPlans = await planManager.getAllPlans();
    res.json({ plans: allPlans });
  } catch (error) {
    console.error('❌ Error getting all plans:', error);
    res.status(500).json({ error: 'Failed to load plans' });
  }
});

// Claims API
app.post('/api/claims/analyze-questionnaire', async (req, res) => {
  try {
    const claimData = req.body;
    let planFilePath = claimData.plan_file_path;
    
    if (planFilePath) {
      console.log('📋 Using provided plan file path:', planFilePath);
    } else {
      const requiredFields = ['plan_name', 'sum_insured', 'patient_name', 'patient_age'];
      for (const field of requiredFields) {
        if (!claimData[field]) {
          return res.status(400).json({ error: `Missing required field: ${field}` });
        }
      }

      const allPlans = await planManager.getAllPlans();
      const selectedPlan = allPlans.find(plan =>
        plan.planName.toLowerCase() === claimData.plan_name.toLowerCase() ||
        plan.planName.toLowerCase().includes(claimData.plan_name.toLowerCase())
      );

      if (!selectedPlan) {
        return res.status(400).json({
          error: 'Plan not found',
          message: `Could not find plan: ${claimData.plan_name}. Please use the hierarchical selection to choose your plan.`
        });
      }

      planFilePath = selectedPlan.filePath;
    }

    const analysisResult = await claimEligibilityEngine.analyzeClaimEligibility(claimData, planFilePath);
    
    if (analysisResult.eligible) {
      analysisResult.chat_support_available = true;
      analysisResult.chat_context = {
        plan_name: claimData.plan_name,
        claim_amount: claimData.claim_amount,
        medical_condition: claimData.medical_condition,
        eligibility_confirmed: true
      };
    }

    res.json(analysisResult);
    
  } catch (error) {
    console.error('❌ Advanced claim analysis failed:', error);
    res.status(500).json({
      error: 'Claim analysis failed',
      message: error.message
    });
  }
});

// Plan Management APIs
app.post('/api/plans/create', async (req, res) => {
  try {
    const { fileName, book, data } = req.body;

    // Validate required fields
    if (!fileName) {
      return res.status(400).json({ error: 'Missing required field: fileName' });
    }
    if (!book) {
      return res.status(400).json({ error: 'Missing required field: book' });
    }
    if (!data) {
      return res.status(400).json({ error: 'Missing required field: data' });
    }

    // Validate plan data structure
    if (!data.plan_details) {
      return res.status(400).json({ error: 'Missing required field: plan_details' });
    }

    const requiredPlanFields = ['Company', 'Plan Name', 'Sum Insured Range'];
    for (const field of requiredPlanFields) {
      if (!data.plan_details[field] || data.plan_details[field].trim() === '') {
        return res.status(400).json({ error: `Missing required field: ${field.toLowerCase()}` });
      }
    }

    // Add metadata if missing
    if (!data.planName) data.planName = data.plan_details['Plan Name'];
    if (!data.company) data.company = data.plan_details['Company'];
    if (!data.sumInsuredRange) data.sumInsuredRange = data.plan_details['Sum Insured Range'];
    if (!data.updatedAt) data.updatedAt = new Date().toISOString();

    const result = await planManager.createPlan(fileName, book, data);
    
    res.json({
      success: true,
      message: 'Plan created successfully',
      filePath: result.filePath,
      fileName: fileName
    });

  } catch (error) {
    console.error('❌ Error creating plan:', error);
    res.status(500).json({ 
      error: 'Failed to create plan',
      message: error.message 
    });
  }
});

app.post('/api/plans/update', async (req, res) => {
  try {
    const { fileName, book, data, originalFilePath } = req.body;

    // Validate required fields
    if (!fileName) {
      return res.status(400).json({ error: 'Missing required field: fileName' });
    }
    if (!data) {
      return res.status(400).json({ error: 'Missing required field: data' });
    }

    // Validate plan data structure
    if (!data.plan_details) {
      return res.status(400).json({ error: 'Missing required field: plan_details' });
    }

    const requiredPlanFields = ['Company', 'Plan Name', 'Sum Insured Range'];
    for (const field of requiredPlanFields) {
      if (!data.plan_details[field] || data.plan_details[field].trim() === '') {
        return res.status(400).json({ error: `Missing required field: ${field.toLowerCase()}` });
      }
    }

    // Add metadata if missing
    if (!data.planName) data.planName = data.plan_details['Plan Name'];
    if (!data.company) data.company = data.plan_details['Company'];
    if (!data.sumInsuredRange) data.sumInsuredRange = data.plan_details['Sum Insured Range'];
    data.updatedAt = new Date().toISOString();

    const result = await planManager.updatePlan(originalFilePath, fileName, book, data);
    
    res.json({
      success: true,
      message: 'Plan updated successfully',
      filePath: result.filePath,
      fileName: fileName
    });

  } catch (error) {
    console.error('❌ Error updating plan:', error);
    res.status(500).json({ 
      error: 'Failed to update plan',
      message: error.message 
    });
  }
});

// Export for Vercel
module.exports = app;
