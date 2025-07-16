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
const { ConversationalClaimAnalyzer } = require('./src/services/conversationalClaimAnalyzer.js');

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
const conversationalAnalyzer = new ConversationalClaimAnalyzer();
const conversationSessions = new Map();

// ===== MAIN ROUTES - 4 CORE PAGES =====

// 1. Main Home Page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// 2. Chat Interface - Enhanced Version
app.get('/chat', (req, res) => {
  res.sendFile(path.join(__dirname, 'enhanced-chat-interface.html'));
});

app.get('/enhanced-chat', (req, res) => {
  res.sendFile(path.join(__dirname, 'enhanced-chat-interface.html'));
});

// Legacy chat interface
app.get('/chat-interface.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'chat-interface.html'));
});

app.get('/chat-legacy', (req, res) => {
  res.sendFile(path.join(__dirname, 'chat-interface.html'));
});

// 3. Claim Assessment (New Enhanced Version)
app.get('/claims', (req, res) => {
  res.sendFile(path.join(__dirname, 'claim-assessment-new.html'));
});

app.get('/claim-assessment.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'claim-assessment-new.html'));
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
app.post('/api/chat', async (req, res) => {
  try {
    const { 
      message, 
      sessionId = 'default',
      llmProvider = 'groq',
      planId = '',
      planContext = null,
      conversationHistory = []
    } = req.body;

    console.log('🔍 Received chat request with planId:', planId);
    console.log('🔍 Plan context received:', planContext);

    if (!message || !message.trim()) {
      return res.status(400).json({ error: 'Message is required' });
    }

    // Get or create conversation session
    let session = conversationSessions.get(sessionId);
    if (!session) {
      session = {
        id: sessionId,
        history: [],
        planId: planId,
        planContext: planContext,
        createdAt: new Date().toISOString()
      };
      conversationSessions.set(sessionId, session);
    }

    // Update session with latest plan info
    session.planId = planId || session.planId;
    session.planContext = planContext || session.planContext;
    session.history.push({
      role: 'user',
      content: message,
      timestamp: new Date().toISOString()
    });

    // Determine if this is a claim analysis request
    const isClaimAnalysis = isClaimAnalysisRequest(message, session.history);
    
    let response;
    if (isClaimAnalysis && session.planId) {
      // Perform detailed claim analysis
      response = await performClaimAnalysis(message, session, llmProvider);
    } else {
      // General conversation
      response = await getGeneralResponse(message, session, llmProvider);
    }

    // Add AI response to session
    session.history.push({
      role: 'assistant',
      content: response,
      timestamp: new Date().toISOString()
    });

    // Keep only last 20 messages to manage memory
    if (session.history.length > 20) {
      session.history = session.history.slice(-20);
    }

    res.json({
      response: response,
      sessionId: sessionId,
      analysisType: isClaimAnalysis ? 'claim_analysis' : 'general',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Chat API error:', error);
    res.status(500).json({ 
      error: 'Internal server error', 
      message: 'I apologize, but I encountered an error processing your request. Please try again.'
    });
  }
});

// Get conversation history
app.get('/api/chat/sessions/:sessionId', (req, res) => {
  const { sessionId } = req.params;
  const session = conversationSessions.get(sessionId);
  
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }

  res.json({
    sessionId: sessionId,
    history: session.history,
    planId: session.planId,
    createdAt: session.createdAt
  });
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

// ===== ENHANCED CONVERSATIONAL CLAIM ASSESSMENT API =====

// Enhanced conversational claim analysis endpoint
app.post('/api/claims/conversational-analysis', async (req, res) => {
  try {
    console.log('🗣️ Received conversational claim analysis request...');
    
    const { 
      sessionId = `session_${Date.now()}`,
      userInput,
      planFilePath = null,
      claimData = {},
      options = {}
    } = req.body;

    // Validate required fields
    if (!userInput || !userInput.trim()) {
      return res.status(400).json({ 
        error: 'userInput is required',
        message: 'Please provide your message or question about the claim'
      });
    }

    // Use the conversational analyzer
    const response = await conversationalAnalyzer.analyzeClaimConversational(
      sessionId,
      userInput.trim(),
      { planFilePath, claimData, ...options }
    );

    console.log(`✅ Conversational analysis completed for session: ${sessionId}`);
    res.json(response);
    
  } catch (error) {
    console.error('❌ Conversational claim analysis failed:', error);
    res.status(500).json({
      error: 'Conversational analysis failed',
      message: error.message,
      sessionId: req.body.sessionId || null
    });
  }
});

// Get conversation session details
app.get('/api/claims/conversation/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const session = conversationalAnalyzer.getSession(sessionId);
    
    if (!session) {
      return res.status(404).json({ 
        error: 'Session not found',
        sessionId: sessionId
      });
    }

    // Return sanitized session data
    const sessionData = {
      sessionId: session.id,
      stage: session.stage,
      createdAt: session.createdAt,
      lastActivity: session.lastActivity,
      totalInteractions: session.totalInteractions,
      planDetails: {
        hasPlans: !!session.planFilePath,
        planName: session.planDetails?.data?.plan_details?.['Plan Name'] || 'Not selected',
        company: session.planDetails?.data?.plan_details?.Company || 'Not selected'
      },
      claimData: {
        condition: session.claimData.medical_condition || 'Not specified',
        patientAge: session.claimData.patient_age || null,
        claimAmount: session.claimData.claim_amount || null
      },
      eligibilityResult: session.eligibilityResult ? {
        eligible: session.eligibilityResult.eligible,
        summary: session.eligibilityResult.summary
      } : null,
      pendingClarifications: session.pendingClarifications?.length || 0
    };

    res.json(sessionData);
    
  } catch (error) {
    console.error('❌ Error retrieving conversation session:', error);
    res.status(500).json({
      error: 'Failed to retrieve session',
      message: error.message
    });
  }
});

// Clear conversation session
app.delete('/api/claims/conversation/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const cleared = conversationalAnalyzer.clearSession(sessionId);
    
    if (cleared) {
      res.json({ 
        message: 'Session cleared successfully',
        sessionId: sessionId
      });
    } else {
      res.status(404).json({
        error: 'Session not found',
        sessionId: sessionId
      });
    }
    
  } catch (error) {
    console.error('❌ Error clearing conversation session:', error);
    res.status(500).json({
      error: 'Failed to clear session',
      message: error.message
    });
  }
});

// Get all active conversation sessions (for monitoring)
app.get('/api/claims/conversations', async (req, res) => {
  try {
    const sessions = conversationalAnalyzer.contextManager.getActiveSessions();
    const stats = conversationalAnalyzer.contextManager.getSessionStats();
    
    res.json({
      activeSessions: sessions,
      statistics: stats,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Error retrieving active sessions:', error);
    res.status(500).json({
      error: 'Failed to retrieve sessions',
      message: error.message
    });
  }
});

// Plan selection helper for conversational flow
app.post('/api/claims/conversation/select-plan', async (req, res) => {
  try {
    const { sessionId, planFilePath, userSelection } = req.body;
    
    if (!sessionId) {
      return res.status(400).json({ error: 'sessionId is required' });
    }

    let selectedPlanPath = planFilePath;
    
    // If user provided selection criteria instead of direct path
    if (!selectedPlanPath && userSelection) {
      const allPlans = await planManager.getAllPlans();
      
      // Find plan based on user selection
      const matchedPlan = allPlans.find(plan => {
        const selection = userSelection.toLowerCase();
        return (
          plan.planName.toLowerCase().includes(selection) ||
          plan.company.toLowerCase().includes(selection) ||
          plan.filename.toLowerCase().includes(selection)
        );
      });

      if (matchedPlan) {
        selectedPlanPath = matchedPlan.filePath;
      } else {
        return res.status(404).json({
          error: 'Plan not found',
          message: `Could not find plan matching: ${userSelection}`,
          availablePlans: allPlans.slice(0, 10).map(p => ({
            company: p.company,
            planName: p.planName,
            filePath: p.filePath
          }))
        });
      }
    }

    // Continue conversation with plan selection
    const response = await conversationalAnalyzer.analyzeClaimConversational(
      sessionId,
      `I selected ${selectedPlanPath}`,
      { planFilePath: selectedPlanPath }
    );

    res.json(response);
    
  } catch (error) {
    console.error('❌ Error in plan selection:', error);
    res.status(500).json({
      error: 'Plan selection failed',
      message: error.message
    });
  }
});

// Test endpoint for conversational features
app.post('/api/claims/conversation/test', async (req, res) => {
  try {
    const testSessionId = `test_${Date.now()}`;
    const testPlan = 'data/plans/book1/health_assure_individual_5l.json';
    
    // Simulate a conversation flow
    const responses = [];
    
    // Step 1: Initial contact
    const step1 = await conversationalAnalyzer.analyzeClaimConversational(
      testSessionId,
      "I need help with my cataract surgery claim",
      { planFilePath: testPlan }
    );
    responses.push({ step: 1, description: 'Initial contact', response: step1 });

    // Step 2: Provide details
    const step2 = await conversationalAnalyzer.analyzeClaimConversational(
      testSessionId,
      "I am 65 years old and need cataract surgery costing 1 lakh rupees"
    );
    responses.push({ step: 2, description: 'Claim details', response: step2 });

    // Step 3: Answer clarification
    if (step2.stage === 'clarification') {
      const step3 = await conversationalAnalyzer.analyzeClaimConversational(
        testSessionId,
        "It's age-related cataract"
      );
      responses.push({ step: 3, description: 'Clarification response', response: step3 });
    }

    res.json({
      message: 'Conversational test completed',
      testSessionId: testSessionId,
      steps: responses,
      finalStage: responses[responses.length - 1]?.response?.stage
    });
    
  } catch (error) {
    console.error('❌ Conversational test failed:', error);
    res.status(500).json({
      error: 'Test failed',
      message: error.message
    });
  }
});

// Business rules fallback function
function analyzeClaimWithBusinessRules(claimData, policyAgeDays, aiSummary) {
  const sumInsuredValue = parseFloat(claimData.sum_insured.replace(/[^0-9.]/g, '')) * 100000; // Convert 5L to 500000
  const claimAmount = claimData.claim_amount;
  
  // Check basic eligibility
  let eligible = true;
  let rejectionReasons = [];
  let waitingPeriods = {};

  // Initial waiting period check (30 days)
  if (policyAgeDays < 30) {
    eligible = false;
    rejectionReasons.push('Policy is in initial waiting period (30 days)');
    waitingPeriods.initial_waiting = `${30 - policyAgeDays} days remaining`;
  }

  // Pre-existing disease check (3 years = 1095 days)
  if (claimData.pre_existing_disease && policyAgeDays < 1095) {
    eligible = false;
    rejectionReasons.push('Pre-existing disease waiting period not completed (3 years)');
    waitingPeriods.pre_existing_disease = `${Math.ceil((1095 - policyAgeDays) / 365)} years remaining`;
  }

  // Specific disease waiting period (2 years = 730 days) - relaxed for emergency
  if (!claimData.emergency_treatment && policyAgeDays < 730) {
    const specificDiseases = ['heart', 'cancer', 'kidney', 'liver', 'brain', 'surgery'];
    const hasSpecificDisease = specificDiseases.some(disease => 
      claimData.medical_condition.toLowerCase().includes(disease)
    );
    
    if (hasSpecificDisease) {
      eligible = false;
      rejectionReasons.push('Specific disease waiting period not completed (2 years)');
      waitingPeriods.specific_disease = `${Math.ceil((730 - policyAgeDays) / 365)} years remaining`;
    }
  }

  // Claim amount vs sum insured check
  if (claimAmount > sumInsuredValue) {
    eligible = false;
    rejectionReasons.push(`Claim amount (₹${claimAmount.toLocaleString()}) exceeds sum insured (₹${sumInsuredValue.toLocaleString()})`);
  }

  // Calculate financial breakdown
  let copayPercentage = 0;
  let copayAmount = 0;
  
  // Co-pay for age > 60 years (10%)
  if (claimData.patient_age > 60) {
    copayPercentage = 10;
    copayAmount = Math.round(claimAmount * 0.1);
  }

  const finalAmount = claimAmount - copayAmount;

  // Prepare recommendations
  let recommendations = [];
  if (!eligible) {
    if (rejectionReasons.some(r => r.includes('waiting period'))) {
      recommendations.push('Wait for the waiting period to complete');
      recommendations.push('Consider emergency treatment if applicable');
    }
    recommendations.push('Consult with your insurance advisor');
    recommendations.push('Review policy terms and conditions');
    recommendations.push('Consider alternative treatment options if urgent');
  }

  return {
    eligible: eligible,
    summary: eligible ? 
      'Your claim appears to be eligible for processing' : 
      'Your claim is not eligible due to waiting periods or policy restrictions',
    patient_name: claimData.patient_name,
    patient_age: claimData.patient_age,
    medical_condition: claimData.medical_condition,
    treatment_type: claimData.treatment_type,
    claim_amount: claimAmount,
    sum_insured: claimData.sum_insured,
    financial_breakdown: {
      total_claim: claimAmount,
      sum_insured: claimData.sum_insured,
      copay_amount: copayAmount,
      copay_percentage: copayPercentage,
      final_amount: finalAmount
    },
    coverage_details: {
      pre_hospitalization: '60 days',
      post_hospitalization: '180 days',
      room_rent_limit: '1% of SI',
      consumables: claimData.consumables_required ? 'Covered' : 'Not Required',
      emergency_ambulance: 'Actual expenses'
    },
    rejection_reasons: eligible ? null : rejectionReasons,
    waiting_periods: Object.keys(waitingPeriods).length > 0 ? waitingPeriods : null,
    recommendations: recommendations.length > 0 ? recommendations : null,
    important_notes: eligible ? 
      'Ensure all required documents are submitted and follow hospital network guidelines' :
      'Please wait for the required waiting period to complete before filing the claim'
  };
}

// ===== CHAT HELPER FUNCTIONS =====

/**
 * Determine if the user message is requesting claim analysis
 */
function isClaimAnalysisRequest(message, conversationHistory) {
  const claimKeywords = [
    'claim', 'coverage', 'eligible', 'eligibility', 'analyze', 'assessment',
    'medical condition', 'treatment', 'hospital', 'insurance', 'policy',
    'pre-existing', 'waiting period', 'copay', 'deductible', 'reimburse',
    'claim status', 'file claim', 'submit claim', 'reimbursement'
  ];
  
  const messageLower = message.toLowerCase();
  
  // Check if message contains claim-related keywords
  const hasClaimKeywords = claimKeywords.some(keyword => messageLower.includes(keyword));
  
  // Check if user explicitly asks for claim analysis
  const explicitClaimRequest = /\b(analyze|check|verify|assess|file|submit)\b.*\b(claim|coverage|eligibility|reimbursement)\b/i.test(message);
  
  return hasClaimKeywords || explicitClaimRequest;
}

/**
 * Perform detailed claim analysis using AI
 */
async function performClaimAnalysis(message, session, llmProvider = 'groq') {
  try {
    console.log('🔍 Performing claim analysis...');
    
    // Get plan details if available
    let planContext = '';
    if (session.planId) {
      try {
        const planDetails = await planManager.getPlan(session.planId);
        if (planDetails && planDetails.data) {
          planContext = `\n\nPlan Context:\n${JSON.stringify(planDetails.data, null, 2)}`;
        }
      } catch (error) {
        console.warn('Could not load plan details for analysis:', error.message);
      }
    }
    
    // Build conversation context
    const conversationContext = session.history
      .slice(-10) // Last 10 messages for context
      .map(msg => `${msg.role}: ${msg.content}`)
      .join('\n');
    
    const systemPrompt = `You are an expert insurance advisor specializing in health insurance claims and policy guidance. 

Your expertise includes:
- Health insurance claim eligibility assessment
- Policy terms and conditions explanation
- Documentation requirements for claims
- Waiting periods and exclusions
- Coverage limits and benefits
- Hospital network guidance
- Step-by-step claim processing guidance

RESPONSE FORMAT REQUIREMENTS:
- Use HTML formatting for structured responses
- Include appropriate headers, lists, and tables
- Use <div class="structured-response"> wrapper
- Break down complex information into sections
- Use emojis for visual appeal
- Provide actionable next steps

Example structure:
<div class="structured-response">
    <div class="response-header">🏥 <strong>Claim Analysis Results</strong></div>
    <div class="response-section">
        <div class="section-title">📋 Key Information</div>
        <p>Your detailed analysis here...</p>
        <table border="1" style="border-collapse: collapse; width: 100%; margin: 10px 0;">
            <tr><th>Category</th><th>Details</th></tr>
            <tr><td>Eligibility</td><td>Status here</td></tr>
        </table>
    </div>
    <div class="response-footer">Next steps: Contact your provider</div>
</div>

Guidelines:
- Provide accurate, helpful information based on standard insurance practices
- Be empathetic and supportive when dealing with claim concerns
- Explain complex insurance terms in simple language
- Always mention that final decisions depend on specific policy terms
- Suggest practical next steps when appropriate
- Use structured HTML formatting for clarity

${planContext}

Conversation History:
${conversationContext}

Please respond to the user's inquiry about their insurance claim or policy question with properly structured HTML formatting.`;

    // Use Groq API for AI response
    const aiResponse = await groqAnalyzer.analyzeQuery(systemPrompt + '\n\nUser Question: ' + message, {
      temperature: 0.2,
      maxTokens: 2048
    });
    
    console.log('✅ Claim analysis completed');
    return aiResponse;
    
  } catch (error) {
    console.error('❌ Claim analysis error:', error);
    return formatErrorResponse('Claim Analysis Error', 
      'I encountered an error while analyzing your claim request. Please provide more specific details about your medical condition, treatment type, and any specific questions about your insurance coverage.',
      [
        'Provide your medical condition details',
        'Specify the treatment type required',
        'Include your policy/plan information',
        'Ask specific questions about coverage'
      ]
    );
  }
}

/**
 * Get general conversational response - Enhanced for multi-purpose use
 */
async function getGeneralResponse(message, session, llmProvider = 'groq') {
  try {
    console.log('💬 Generating general response...');
    
    // Load plan data if planId is available
    let planData = null;
    let planContext = '';
    
    if (session.planId) {
      try {
        console.log('📋 Loading plan data for:', session.planId);
        const planInfo = await planManager.getPlan(session.planId);
        planData = planInfo.data;
        
        if (planData) {
          // Extract key plan information from the specific JSON structure
          const planDetails = planData.plan_details || {};
          const basicCoverages = planData.basic_coverages || {};
          const exclusionsWaiting = planData.exclusions_waiting_periods || {};
          const subLimits = planData.sub_limits || {};
          const renewalBenefits = planData.renewal_benefits || {};
          const specialFeatures = planData.special_features_others || {};
          
          planContext = `\n=== SELECTED INSURANCE PLAN DETAILS ===
Plan Name: ${planDetails['Plan Name'] || 'N/A'}
Company: ${planDetails['Company'] || 'N/A'}
Sum Insured: ${planDetails['Sum Insured Range'] || 'N/A'}
Policy Duration: ${planDetails['Policy Duration'] || 'N/A'}
Age Entry (Adult): ${planDetails['Adult Age Entry (MIN-MAX)'] || 'N/A'}
Age Entry (Child): ${planDetails['Child  Age Entry'] || 'N/A'}
Who Can Be Covered: ${planDetails['Who all can be covered'] || 'N/A'}
Payment Mode: ${planDetails['payment mode (YLY/HLY/QLY/MLY)'] || 'N/A'}

=== BASIC COVERAGES ===
Pre-Hospitalization: ${basicCoverages['Pre-Hospitalization'] || 'N/A'}
Post-Hospitalization: ${basicCoverages['Post-Hospitalization'] || 'N/A'}
Emergency Ambulance: ${basicCoverages['Emergency Ambulance'] || 'N/A'}
Day Care Procedures: ${basicCoverages['DAY CARE (PROCEDURE/SURGERY)'] || 'N/A'}
AYUSH Treatment: ${basicCoverages['Non-Allopathic Treatment (AYUSH)'] || 'N/A'}
Domiciliary Expenses: ${basicCoverages['Domicilary Expenses'] || 'N/A'}
Consumables: ${basicCoverages['Consumables'] || 'N/A'}
Sum Insured Restore: ${basicCoverages['SI RESTORE /RECHARGE'] || 'N/A'}
Modern Treatments: ${basicCoverages['MODERN TREATMENTS'] || 'N/A'}
Organ Donor Expenses: ${basicCoverages['ORGAN DONOR EXPENSES'] || 'N/A'}

=== WAITING PERIODS & EXCLUSIONS ===
Initial Waiting Period: ${exclusionsWaiting['INITIAL WAITING'] || 'N/A'}
Specific Disease Waiting: ${exclusionsWaiting['SPECIFIC DISEASE'] || 'N/A'}
Pre-Existing Disease Waiting: ${exclusionsWaiting['Pre Existing Disease'] || 'N/A'}

=== SUB-LIMITS ===
Room Rent: ${subLimits['Room Rent/day'] || 'N/A'}
ICU Charges: ${subLimits['ICU/day'] || 'N/A'}
Co-Payment: ${subLimits['Co - Pay'] || 'N/A'}
Cataract Limits: ${subLimits['Cataract Limits'] || 'N/A'}
Other Sub Limits: ${subLimits['Other Sub Limits'] || 'N/A'}

=== RENEWAL BENEFITS ===
No Claim Bonus: ${renewalBenefits['No claim bonus'] || 'N/A'}
Free Health Check-up: ${renewalBenefits['Free Health Check-up'] || 'N/A'}
Wellness Discount: ${renewalBenefits['Wellness Discount'] || 'N/A'}

=== SPECIAL FEATURES ===
${Object.entries(specialFeatures).map(([key, value]) => `${key}: ${value}`).join('\n')}

CRITICAL INSTRUCTIONS FOR AI:
1. You MUST use ONLY the information from the plan data above when answering questions about this plan
2. When asked about "features" - refer to the Basic Coverages and Special Features sections
3. When asked about "benefits" - refer to the Basic Coverages and Renewal Benefits sections
4. When asked about "coverage" - refer to the Basic Coverages section
5. When asked about "waiting periods" - refer to the Waiting Periods & Exclusions section
6. When asked about "eligibility" or "age limits" - refer to the Plan Details section
7. Always mention the specific plan name "${planDetails['Plan Name'] || 'N/A'}" by ${planDetails['Company'] || 'N/A'}
8. If specific information is not available in the plan data, clearly state "This information is not specified in the ${planDetails['Plan Name'] || 'this'} plan"
9. Use exact values from the plan data - don't generalize or make assumptions
10. Provide structured HTML responses with tables when showing plan details`;
          
          console.log('✅ Plan data loaded successfully for response generation');
          console.log('📊 Plan details:', planDetails['Plan Name'], 'by', planDetails['Company']);
        }
      } catch (error) {
        console.error('❌ Error loading plan data:', error);
      }
    } else {
      console.log('ℹ️ No plan selected - providing general assistance');
    }
    
    // Build conversation context
    const conversationContext = session.history
      .slice(-8) // Last 8 messages for context
      .map(msg => `${msg.role}: ${msg.content}`)
      .join('\n');
    
    // Determine the category of question
    const questionCategory = categorizeQuestion(message);
    
    const systemPrompt = `You are an insurance plan analysis expert specializing in explaining health insurance plans in detail.

${planContext}

RESPONSE STRATEGY:
${planContext ? `
PLAN-SPECIFIC MODE: A specific insurance plan is selected. You MUST provide information ONLY from the plan data provided above.

MANDATORY RULES:
1. Extract information directly from the plan data sections provided
2. When asked about "features" - list items from Basic Coverages and Special Features
3. When asked about "benefits" - detail items from Basic Coverages and Renewal Benefits  
4. When asked about "coverage" - explain the Basic Coverages section
5. When asked about "waiting periods" - reference the Waiting Periods & Exclusions section
6. Always mention the specific plan name and company
7. Format responses in structured HTML with tables for plan details
8. If information isn't in the plan data, state "Not specified in this plan"
` : `
GENERAL MODE: No specific plan selected. Provide general insurance guidance and multi-topic assistance.
`}

RESPONSE FORMAT REQUIREMENTS:
- Use structured HTML formatting with div class="structured-response"
- Include appropriate headers and sections
- Use tables for plan comparisons and feature lists
- Use proper HTML tags: strong, ul, li, table, tr, td, th
- Include relevant emojis for visual appeal

Current Question Category: ${questionCategory}
Conversation History: ${conversationContext}

Provide a comprehensive, well-structured HTML response that directly addresses the user's question using the plan data when available.`;

    // Use Groq API for AI response
    const aiResponse = await groqAnalyzer.analyzeQuery(systemPrompt + '\n\nUser Question: ' + message, {
      temperature: 0.3,
      maxTokens: 2048
    });
    
    console.log('✅ General response completed');
    return aiResponse;
    
  } catch (error) {
    console.error('❌ General response error:', error);
    return formatErrorResponse('Assistant Unavailable', 
      'I apologize, but I\'m experiencing technical difficulties. However, I\'m designed to help with a wide range of topics!',
      [
        'Try rephrasing your question',
        'Ask about insurance, health, technology, education, or general knowledge',
        'Check your internet connection',
        'Contact support if the issue persists'
      ]
    );
  }
}

/**
 * Categorize the user's question to provide contextual responses
 */
function categorizeQuestion(message) {
  const categories = {
    'insurance': ['insurance', 'policy', 'coverage', 'claim', 'premium', 'deductible', 'copay'],
    'health': ['health', 'medical', 'doctor', 'hospital', 'medicine', 'treatment', 'diagnosis', 'symptoms'],
    'technology': ['programming', 'code', 'software', 'hardware', 'computer', 'app', 'website', 'tech'],
    'finance': ['money', 'investment', 'loan', 'bank', 'finance', 'budget', 'savings', 'credit'],
    'education': ['learn', 'study', 'education', 'school', 'university', 'course', 'exam', 'homework'],
    'business': ['business', 'marketing', 'sales', 'management', 'strategy', 'startup', 'company'],
    'travel': ['travel', 'trip', 'vacation', 'flight', 'hotel', 'destination', 'tourism'],
    'science': ['science', 'research', 'experiment', 'theory', 'physics', 'chemistry', 'biology'],
    'lifestyle': ['lifestyle', 'fitness', 'diet', 'hobby', 'personal', 'relationship', 'self-help']
  };
  
  const messageLower = message.toLowerCase();
  
  for (const [category, keywords] of Object.entries(categories)) {
    if (keywords.some(keyword => messageLower.includes(keyword))) {
      return category;
    }
  }
  
  return 'general';
}

/**
 * Format error responses consistently
 */
function formatErrorResponse(title, message, suggestions = []) {
  return `
    <div class="structured-response">
        <div class="response-header">
            ⚠️ <strong>${title}</strong>
        </div>
        <div class="response-section">
            <p>${message}</p>
        </div>
        ${suggestions.length > 0 ? `
        <div class="response-section">
            <div class="section-title">💡 What you can try</div>
            <ul class="feature-list">
                ${suggestions.map(suggestion => `<li>🔄 ${suggestion}</li>`).join('')}
            </ul>
        </div>
        ` : ''}
        <div class="response-footer">
            I'm here to help with any questions you have!
        </div>
    </div>
  `;
}

// ===== ERROR HANDLING =====
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
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
    
    app.listen(PORT, () => {
      console.log(`🚀 Health Insurance Claim Assistant running on http://localhost:${PORT}`);
      console.log(`📱 Available Interfaces:`);
      console.log(`   🏠 Homepage: http://localhost:${PORT}`);
      console.log(`   📋 Plan Manager: http://localhost:${PORT}/plans`);
      console.log(`   💬 Chat Assistant: http://localhost:${PORT}/chat`);
      console.log(`   🔍 Claim Assessment: http://localhost:${PORT}/claims`);
      console.log(``);
      console.log(`🔧 Enhanced Features:`);
      console.log(`   • AI-powered questionnaire-based claim analysis`);
      console.log(`   • Real-time claim eligibility assessment`);
      console.log(`   • Plan management system`);
      console.log(`   • Session management`);
      console.log(``);
      console.log(`API Endpoints:`);
      console.log(`- GET  /api/health - Health check`);
      console.log(`- POST /api/chat - Chat with AI`);
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
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
