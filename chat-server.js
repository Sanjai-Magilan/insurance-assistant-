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
const conversationSessions = new Map();

// ===== MAIN ROUTES - 4 CORE PAGES =====

// 1. Main Home Page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// 2. Chat Interface
app.get('/chat', (req, res) => {
  res.sendFile(path.join(__dirname, 'chat-interface.html'));
});

app.get('/chat-interface.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'chat-interface.html'));
});

// 3. Claim Assessment
app.get('/claims', (req, res) => {
  res.sendFile(path.join(__dirname, 'claim-assessment.html'));
});

app.get('/claim-assessment.html', (req, res) => {
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
      conversationHistory = []
    } = req.body;

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
        createdAt: new Date().toISOString()
      };
      conversationSessions.set(sessionId, session);
    }

    // Update session
    session.planId = planId || session.planId;
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
app.get('/api/plans/list', (req, res) => {
  try {
    console.log('📋 Getting all available plans...');
    const allPlans = healthAnalyzer.getAllPlans();
    
    console.log(`✅ Returning ${allPlans.length} plans`);
    res.json({ plans: allPlans });
  } catch (error) {
    console.error('❌ Error getting all plans:', error);
    res.status(500).json({ error: 'Failed to load plans' });
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

// Analyze claim using questionnaire data with AI
app.post('/api/claims/analyze-questionnaire', async (req, res) => {
  try {
    console.log('🔍 Received questionnaire-based claim analysis request...');
    
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

WAITING PERIOD ANALYSIS:
- Initial Waiting Period: 30 days (Standard)
- Specific Disease Waiting: 2 years (Standard)
- Pre-existing Disease Waiting: 3-4 years (Standard)

ELIGIBILITY CRITERIA TO CHECK:
1. Initial waiting period (30 days from policy start)
2. Specific disease waiting period (2 years for specific conditions)
3. Pre-existing disease waiting period (3-4 years)
4. Age limits and coverage
5. Treatment type coverage
6. Claim amount vs sum insured
7. Emergency vs planned treatment rules

Please provide a detailed analysis in the following JSON format:

{
  "eligible": true/false,
  "summary": "Brief summary of eligibility status",
  "patient_name": "${claimData.patient_name}",
  "patient_age": ${claimData.patient_age},
  "medical_condition": "${claimData.medical_condition}",
  "treatment_type": "${claimData.treatment_type}",
  "claim_amount": ${claimData.claim_amount},
  "sum_insured": "${claimData.sum_insured}",
  "financial_breakdown": {
    "total_claim": ${claimData.claim_amount},
    "sum_insured": "${claimData.sum_insured}",
    "copay_amount": 0,
    "copay_percentage": 0,
    "final_amount": ${claimData.claim_amount}
  },
  "coverage_details": {
    "pre_hospitalization": "60 days",
    "post_hospitalization": "180 days",
    "room_rent_limit": "1% of SI",
    "consumables": "Yes/No",
    "emergency_ambulance": "Actual"
  },
  "rejection_reasons": ["reason1", "reason2"] or null,
  "waiting_periods": {
    "initial_waiting": "X days remaining",
    "specific_disease": "X days remaining",
    "pre_existing_disease": "X days remaining"
  } or null,
  "recommendations": ["recommendation1", "recommendation2"] or null,
  "important_notes": "Any important notes about the claim"
}

IMPORTANT ANALYSIS RULES:
1. If policy age < 30 days: NOT ELIGIBLE (Initial waiting period)
2. If pre-existing disease and policy age < 3 years: NOT ELIGIBLE
3. If specific disease and policy age < 2 years: Check if emergency
4. Emergency treatments may have relaxed waiting periods
5. Check if claim amount exceeds sum insured
6. Consider patient age for co-pay calculations (10% for >60 years)
7. Maternity coverage requires 2-year waiting period

Provide detailed, accurate analysis based on standard insurance practices.
`;

    // Get AI analysis using Groq
    const aiResponse = await groqAnalyzer.analyzeQuery(analysisPrompt);
    
    // Try to parse JSON response from AI
    let analysisResult;
    try {
      // Extract JSON from AI response if it's wrapped in text
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        analysisResult = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found in AI response');
      }
    } catch (parseError) {
      console.log('Failed to parse AI JSON response, creating structured response...');
      
      // Fallback: Create structured response based on business rules
      analysisResult = analyzeClaimWithBusinessRules(claimData, policyAgeDays, aiResponse);
    }

    // Ensure all required fields are present
    analysisResult.patient_name = claimData.patient_name;
    analysisResult.patient_age = claimData.patient_age;
    analysisResult.medical_condition = claimData.medical_condition;
    analysisResult.treatment_type = claimData.treatment_type;
    analysisResult.claim_amount = claimData.claim_amount;
    analysisResult.sum_insured = claimData.sum_insured;

    console.log('✅ Questionnaire-based claim analysis completed');
    res.json(analysisResult);
    
  } catch (error) {
    console.error('❌ Questionnaire claim analysis failed:', error);
    res.status(500).json({ 
      error: 'Claim analysis failed', 
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
      console.log(`- POST /api/plans/create - Create new plan`);
      console.log(`- POST /api/test-connection - Test AI connection`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
