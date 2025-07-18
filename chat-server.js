// ===== LIC CLAIM ASSISTANT - CLEAN API SERVER =====
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const rateLimit = require('express-rate-limit');
const { GroqAnalyzer } = require('./src/services/groqAnalyzer.js');
const { HealthInsuranceClaimAnalyzer } = require('./src/services/healthInsuranceAnalyzer.js');
const { PlanManager } = require('./src/services/planManager.js');
const { ClaimEligibilityEngine } = require('./src/services/claimEligibilityEngine.js');
const { ChatOrchestrator } = require('./src/services/chatOrchestrator.js');
const { ResponseFormatter } = require('./src/services/responseFormatter.js');
const { PlanContextManager } = require('./src/services/planContextManager.js');

const app = express();
const PORT = process.env.PORT || 3000;

// ===== MIDDLEWARE =====
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: 'Too many requests from this IP, please try again later.'
});

app.use(limiter);
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname)));

// Enhanced logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// ===== INITIALIZE SERVICES =====
const groqAnalyzer = new GroqAnalyzer();
const healthAnalyzer = new HealthInsuranceClaimAnalyzer();
const planManager = new PlanManager();
const claimEligibilityEngine = new ClaimEligibilityEngine();

// ===== INITIALIZE MODULAR SERVICES =====
const planContextManager = new PlanContextManager(planManager);
const chatOrchestrator = new ChatOrchestrator(groqAnalyzer, planManager);

// ===== MAIN ROUTES - 4 CORE PAGES =====

// 1. Main Home Page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// 2. Chat Interface
app.get('/chat', (req, res) => {
  res.sendFile(path.join(__dirname, 'chat-interface.html'));
});

app.get('/enhanced-chat', (req, res) => {
  res.sendFile(path.join(__dirname, 'chat-interface.html'));
});

// Direct access to chat interface
app.get('/chat-interface.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'chat-interface.html'));
});

app.get('/chat-legacy', (req, res) => {
  res.sendFile(path.join(__dirname, 'chat-interface.html'));
});

// 3. Claim Assessment
app.get('/claims', (req, res) => {
  res.sendFile(path.join(__dirname, 'claim-assessment.html'));
});

app.get('/claim-assessment.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'claim-assessment.html'));
});

// Legacy claim assessment (for backup)
app.get('/claims-legacy', (req, res) => {
  res.sendFile(path.join(__dirname, 'claim-assessment.html'));
});

// 4. Plan Manager
app.get('/plans', (req, res) => {
  res.sendFile(path.join(__dirname, 'plan-management-interface.html'));
});

// ===== API ENDPOINTS =====

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

// ===== CHAT INTERFACE API =====

// Main chat endpoint
// ===== NEW MODULAR CHAT API =====
app.post('/api/chat', async (req, res) => {
  try {
    const { 
      message, 
      sessionId = 'default',
      planId = '',
      llmProvider = 'groq'
    } = req.body;

    console.log('🎯 New modular chat request:');
    console.log('   Message:', message);
    console.log('   Session:', sessionId);
    console.log('   Plan ID:', planId);

    // Validate required fields
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

    // Process message using chat orchestrator
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
    console.error('❌ Modular chat API error:', error);
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

// Get conversation history
app.get('/api/chat/sessions/:sessionId', (req, res) => {
  try {
    const { sessionId } = req.params;
    const session = chatOrchestrator.getSession(sessionId);
    
    if (!session) {
      return res.status(404).json({ 
        success: false,
        error: 'Session not found' 
      });
    }

    res.json({
      success: true,
      sessionId: sessionId,
      history: session.history,
      planId: session.planId,
      planContext: session.planContext,
      createdAt: session.createdAt,
      lastActivity: session.lastActivity
    });
  } catch (error) {
    console.error('❌ Session retrieval error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve session'
    });
  }
});

// Clear conversation session
app.delete('/api/chat/sessions/:sessionId', (req, res) => {
  try {
    const { sessionId } = req.params;
    chatOrchestrator.clearSession(sessionId);
    
    res.json({
      success: true,
      message: 'Session cleared successfully'
    });
  } catch (error) {
    console.error('❌ Session clearing error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to clear session'
    });
  }
});

// Get chat system statistics
app.get('/api/chat/stats', (req, res) => {
  try {
    const chatStats = chatOrchestrator.getSessionStats();
    const cacheStats = planContextManager.getCacheStats();
    
    res.json({
      success: true,
      stats: {
        ...chatStats,
        ...cacheStats,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('❌ Stats retrieval error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve statistics'
    });
  }
});

// List all chat sessions
app.get('/api/chat/sessions', (req, res) => {
  const sessions = Array.from(conversationSessions.values()).map(session => ({
    id: session.id,
    planId: session.planId,
    createdAt: session.createdAt,
    messageCount: session.history.length
  }));
  
  res.json({ sessions });
});

// Clear conversation session
app.delete('/api/chat/sessions/:sessionId', (req, res) => {
  const { sessionId } = req.params;
  conversationSessions.delete(sessionId);
  
  res.json({ 
    message: 'Session cleared successfully',
    sessionId: sessionId
  });
});

// ===== PLANS API =====

// Get all available plans (used by all interfaces)
app.get('/api/plans/list', async (req, res) => {
  try {
    console.log('📋 Getting all available plans...');
    const allPlans = await planManager.getAllPlans();
    
    console.log(`✅ Returning ${allPlans.length} plans`);
    res.json({ plans: allPlans });
  } catch (error) {
    console.error('❌ Error getting all plans:', error);
    res.status(500).json({ error: 'Failed to load plans' });
  }
});

// Get dashboard statistics
app.get('/api/plans/stats', async (req, res) => {
  try {
    console.log('📊 Getting dashboard statistics...');
    const allPlans = await planManager.getAllPlans();
    const companies = healthAnalyzer.getAvailableCompanies();
    
    // Get unique books
    const books = [...new Set(allPlans.map(plan => plan.book))].filter(Boolean);
    
    // Get last updated date (most recent plan modification)
    let lastUpdated = 'Unknown';
    if (allPlans.length > 0) {
      const sortedPlans = allPlans.sort((a, b) => {
        const aDate = new Date(a.lastModified || 0);
        const bDate = new Date(b.lastModified || 0);
        return bDate - aDate;
      });
      if (sortedPlans[0] && sortedPlans[0].lastModified) {
        lastUpdated = new Date(sortedPlans[0].lastModified).toLocaleDateString();
      }
    }
    
    const stats = {
      totalPlans: allPlans.length,
      totalCompanies: companies.length,
      totalBooks: books.length,
      lastUpdated: lastUpdated
    };
    
    console.log('✅ Dashboard stats:', stats);
    res.json(stats);
  } catch (error) {
    console.error('❌ Error getting dashboard stats:', error);
    res.status(500).json({ error: 'Failed to load dashboard statistics' });
  }
});

// Create new plan (used by plan management interface)
app.post('/api/plans/create', async (req, res) => {
  try {
    console.log('📝 Creating new plan...');
    const planData = req.body;
    
    // Validate required fields
    const requiredFields = ['company', 'planName', 'sumInsured'];
    for (const field of requiredFields) {
      if (!planData[field]) {
        return res.status(400).json({ error: `Missing required field: ${field}` });
      }
    }
    
    const result = await planManager.createPlan(planData);
    console.log('✅ Plan created successfully');
    res.json(result);
  } catch (error) {
    console.error('❌ Error creating plan:', error);
    res.status(500).json({ error: 'Failed to create plan', message: error.message });
  }
});

// Get specific plan for editing
app.get('/api/plans/get', async (req, res) => {
  try {
    const { filePath } = req.query;
    if (!filePath) {
      return res.status(400).json({ error: 'filePath parameter is required' });
    }
    
    console.log('📄 Getting plan for editing:', filePath);
    const planData = await planManager.getPlan(filePath);
    
    console.log('✅ Plan data retrieved successfully');
    res.json(planData);
  } catch (error) {
    console.error('❌ Error getting plan:', error);
    res.status(500).json({ error: 'Failed to get plan', message: error.message });
  }
});

// POST version for plan details (used by claim assessment)
app.post('/api/plans/get', async (req, res) => {
  try {
    const { filePath } = req.body;
    if (!filePath) {
      return res.status(400).json({ error: 'filePath parameter is required' });
    }
    
    console.log('📄 Getting plan details:', filePath);
    const planData = await planManager.getPlan(filePath);
    
    console.log('✅ Plan details retrieved successfully');
    res.json(planData);
  } catch (error) {
    console.error('❌ Error getting plan details:', error);
    res.status(500).json({ error: 'Failed to get plan details', message: error.message });
  }
});

// Update existing plan
app.post('/api/plans/update', async (req, res) => {
  try {
    console.log('📝 Updating plan...');
    const { originalFilePath, fileName, book, data } = req.body;
    
    if (!originalFilePath || !fileName || !book || !data) {
      return res.status(400).json({ error: 'Missing required fields: originalFilePath, fileName, book, data' });
    }
    
    const result = await planManager.updatePlan(originalFilePath, fileName, book, data);
    console.log('✅ Plan updated successfully');
    res.json(result);
  } catch (error) {
    console.error('❌ Error updating plan:', error);
    res.status(500).json({ error: 'Failed to update plan', message: error.message });
  }
});

// Delete plan
app.post('/api/plans/delete', async (req, res) => {
  try {
    console.log('🗑️ Deleting plan...');
    const { filePath } = req.body;
    
    if (!filePath) {
      return res.status(400).json({ error: 'filePath is required' });
    }
    
    const result = await planManager.deletePlan(filePath);
    console.log('✅ Plan deleted successfully');
    res.json(result);
  } catch (error) {
    console.error('❌ Error deleting plan:', error);
    res.status(500).json({ error: 'Failed to delete plan', message: error.message });
  }
});

// ===== CLAIM ASSESSMENT API =====

// Get available insurance companies
app.get('/api/claims/companies', (req, res) => {
  try {
    const companies = healthAnalyzer.getAvailableCompanies();
    res.json(companies);
  } catch (error) {
    console.error('Error getting companies:', error);
    res.status(500).json({ error: 'Failed to load companies' });
  }
});

// Get plans by company
app.get('/api/claims/plans/:company', (req, res) => {
  try {
    const { company } = req.params;
    const plans = healthAnalyzer.getPlansByCompany(company);
    res.json(plans);
  } catch (error) {
    console.error('Error getting plans:', error);
    res.status(500).json({ error: 'Failed to load plans' });
  }
});

// Analyze health insurance claim
app.post('/api/claims/analyze', async (req, res) => {
  try {
    console.log('🔍 Received claim analysis request...');
    
    const claimData = req.body;
    
    // Validate required fields
    const requiredFields = ['company', 'planName', 'sumInsured', 'patientName', 'patientAge', 'claimAmount'];
    for (const field of requiredFields) {
      if (!claimData[field]) {
        return res.status(400).json({ error: `Missing required field: ${field}` });
      }
    }
    
    // Perform eligibility analysis
    const analysis = await healthAnalyzer.analyzeClaimEligibility(claimData);
    
    console.log('✅ Claim analysis completed');
    res.json(analysis);
    
  } catch (error) {
    console.error('❌ Claim analysis failed:', error);
    res.status(500).json({ 
      error: 'Claim analysis failed', 
      message: error.message 
    });
  }
});

// New advanced claim eligibility analysis using intelligent engine
app.post('/api/claims/analyze-questionnaire', async (req, res) => {
  try {
    console.log('🔍 Received advanced claim analysis request...');
    
    const claimData = req.body;
    
    // Check if plan_file_path is provided (new hierarchical selection)
    let planFilePath = claimData.plan_file_path;
    
    if (planFilePath) {
      console.log('📋 Using provided plan file path:', planFilePath);
    } else {
      // Fallback: try to find plan by name (legacy support)
      console.log('📋 No plan file path provided, attempting to find by plan name...');
      
      // Validate required fields for legacy mode
      const requiredFields = ['plan_name', 'sum_insured', 'patient_name', 'patient_age'];
      for (const field of requiredFields) {
        if (!claimData[field]) {
          return res.status(400).json({ error: `Missing required field: ${field}` });
        }
      }

      // Find the plan file path based on plan name
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
      console.log('📋 Found plan:', selectedPlan.planName, 'from file:', planFilePath);
    }

    // Use the intelligent claim eligibility engine
    const analysisResult = await claimEligibilityEngine.analyzeClaimEligibility(claimData, planFilePath);
    
    // Add chat support flag for eligible claims
    if (analysisResult.eligible) {
      analysisResult.chat_support_available = true;
      analysisResult.chat_context = {
        plan_name: claimData.plan_name,
        claim_amount: claimData.claim_amount,
        medical_condition: claimData.medical_condition,
        eligibility_confirmed: true
      };
    }

    console.log('✅ Advanced claim analysis completed:', analysisResult.eligible ? 'ELIGIBLE' : 'NOT ELIGIBLE');
    res.json(analysisResult);
    
  } catch (error) {
    console.error('❌ Advanced claim analysis failed:', error);
    res.status(500).json({
      error: 'Claim analysis failed',
      message: error.message
    });
  }
});

// Legacy AI-based analysis endpoint (fallback)
app.post('/api/claims/analyze-questionnaire-ai', async (req, res) => {
  try {
    console.log('🔍 Received AI-based claim analysis request...');
    
    const claimData = req.body;
    
    // Validate required fields
    const requiredFields = ['plan_name', 'sum_insured', 'patient_name', 'patient_age', 'claim_amount'];
    for (const field of requiredFields) {
      if (!claimData[field]) {
        return res.status(400).json({ error: `Missing required field: ${field}` });
      }
    }

    // Calculate policy age in days
    const policyStartDate = new Date(claimData.policy_start_date);
    const currentDate = new Date();
    const policyAgeDays = Math.floor((currentDate - policyStartDate) / (1000 * 60 * 60 * 24));

    // Build comprehensive analysis prompt for AI
    const analysisPrompt = `
You are an expert insurance claim analyst. Analyze the following health insurance claim for eligibility:

CLAIM DETAILS:
- Plan Name: ${claimData.plan_name}
- Sum Insured: ${claimData.sum_insured}
- Patient Name: ${claimData.patient_name}
- Patient Age: ${claimData.patient_age} years
- Patient Gender: ${claimData.patient_gender}
- Policy Start Date: ${claimData.policy_start_date}
- Policy Age: ${policyAgeDays} days
- Treatment Type: ${claimData.treatment_type}
- Medical Condition: ${claimData.medical_condition}
- Claim Amount: ₹${claimData.claim_amount}
- Pre-existing Disease: ${claimData.pre_existing_disease ? 'Yes' : 'No'}
- Emergency Treatment: ${claimData.emergency_treatment ? 'Yes' : 'No'}
- Consumables Required: ${claimData.consumables_required ? 'Yes' : 'No'}
- Additional Info: ${claimData.additional_info}

Please provide a detailed analysis in JSON format with eligibility decision and reasoning.
`;

    // Get AI analysis using Groq
    const aiResponse = await groqAnalyzer.analyzeQuery(analysisPrompt);
    
    // Try to parse JSON response from AI
    let analysisResult;
    try {
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        analysisResult = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found in AI response');
      }
    } catch (parseError) {
      console.log('Failed to parse AI JSON response, creating structured response...');
      analysisResult = analyzeClaimWithBusinessRules(claimData, policyAgeDays, aiResponse);
    }

    // Ensure all required fields are present
    analysisResult.patient_name = claimData.patient_name;
    analysisResult.patient_age = claimData.patient_age;
    analysisResult.medical_condition = claimData.medical_condition;
    analysisResult.treatment_type = claimData.treatment_type;
    analysisResult.claim_amount = claimData.claim_amount;
    analysisResult.sum_insured = claimData.sum_insured;

    console.log('✅ AI-based claim analysis completed');
    res.json(analysisResult);
    
  } catch (error) {
    console.error('❌ AI claim analysis failed:', error);
    res.status(500).json({
      error: 'Claim analysis failed',
      message: error.message
    });
  }
});

// ===== ERROR HANDLING =====
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// ===== SERVER STARTUP =====
async function startServer() {
  try {
    console.log('🔄 Loading health insurance plans...');
    const plans = await planManager.getAllPlans();
    console.log(`✅ Loaded ${plans.length} health insurance plans`);
    
    // Only start listening if not in Vercel environment
    if (!process.env.VERCEL) {
      app.listen(PORT, () => {
        console.log(`🚀 Health Insurance Assistant (Modular) running on http://localhost:${PORT}`);
        console.log(`📱 Available Interfaces:`);
        console.log(`   🏠 Homepage: http://localhost:${PORT}`);
        console.log(`   📋 Plan Manager: http://localhost:${PORT}/plans`);
        console.log(`   💬 Chat Assistant: http://localhost:${PORT}/chat`);
        console.log(`   🔍 Claim Assessment: http://localhost:${PORT}/claims`);
        console.log(``);
        console.log(`🔧 Enhanced Modular Features:`);
        console.log(`   • Complete plan data integration`);
        console.log(`   • Dynamic response formatting`);
        console.log(`   • Table-structured output`);
        console.log(`   • Robust error handling`);
        console.log(`   • Session management`);
        console.log(``);
        console.log(`API Endpoints:`);
        console.log(`- GET  /api/health - Health check`);
        console.log(`- POST /api/chat - Modular chat with AI`);
        console.log(`- GET  /api/chat/sessions/:id - Get session info`);
        console.log(`- DELETE /api/chat/sessions/:id - Clear session`);
        console.log(`- GET  /api/chat/stats - Chat system statistics`);
        console.log(`- GET  /api/claims/companies - Get insurance companies`);
        console.log(`- POST /api/claims/analyze - Analyze claims (legacy)`);
        console.log(`- POST /api/claims/analyze-questionnaire - New questionnaire-based analysis`);
        console.log(`- GET  /api/plans/list - Get all plans`);
        console.log(`- GET  /api/plans/stats - Get dashboard statistics`);
        console.log(`- GET  /api/plans/get - Get specific plan for editing`);
        console.log(`- POST /api/plans/create - Create new plan`);
        console.log(`- POST /api/plans/update - Update existing plan`);
        console.log(`- POST /api/plans/delete - Delete plan`);
        console.log(`- POST /api/test-connection - Test AI connection`);
      });
    } else {
      console.log('🚀 Health Insurance Assistant (Modular) initialized for Vercel');
    }
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    if (!process.env.VERCEL) {
      process.exit(1);
    }
  }
}

startServer();

// Export the Express app for Vercel
module.exports = app;
