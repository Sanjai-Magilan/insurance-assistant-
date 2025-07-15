// ===== LIC CLAIM ASSISTANT - CLEAN API SERVER =====
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

// ===== PLAN MANAGER API =====

// Get dashboard statistics
app.get('/api/plans/stats', async (req, res) => {
  try {
    const stats = await planManager.getStats();
    res.json(stats);
  } catch (error) {
    console.error('Error getting plan stats:', error);
    res.status(500).json({ error: 'Failed to get plan statistics' });
  }
});

// Get all plans list
app.get('/api/plans/list', async (req, res) => {
  try {
    const plans = await planManager.getAllPlans();
    res.json({ plans });
  } catch (error) {
    console.error('Error getting plans list:', error);
    res.status(500).json({ error: 'Failed to get plans list' });
  }
});

// Get specific plan
app.get('/api/plans/get', async (req, res) => {
  try {
    const { filePath } = req.query;
    if (!filePath) {
      return res.status(400).json({ error: 'File path is required' });
    }
    
    const plan = await planManager.getPlan(filePath);
    res.json(plan);
  } catch (error) {
    console.error('Error getting plan:', error);
    res.status(500).json({ error: 'Failed to get plan: ' + error.message });
  }
});

// Create new plan
app.post('/api/plans/create', async (req, res) => {
  try {
    const { fileName, book, data } = req.body;
    
    if (!fileName || !book || !data) {
      return res.status(400).json({ error: 'fileName, book, and data are required' });
    }
    
    // Validate plan data
    const validation = planManager.validatePlanData(data);
    if (!validation.isValid) {
      return res.status(400).json({ 
        error: 'Invalid plan data', 
        validationErrors: validation.errors 
      });
    }
    
    const result = await planManager.createPlan(fileName, book, data);
    res.json(result);
  } catch (error) {
    console.error('Error creating plan:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update existing plan
app.post('/api/plans/update', async (req, res) => {
  try {
    const { originalFilePath, fileName, book, data } = req.body;
    
    if (!originalFilePath || !fileName || !book || !data) {
      return res.status(400).json({ error: 'originalFilePath, fileName, book, and data are required' });
    }
    
    // Validate plan data
    const validation = planManager.validatePlanData(data);
    if (!validation.isValid) {
      return res.status(400).json({ 
        error: 'Invalid plan data', 
        validationErrors: validation.errors 
      });
    }
    
    const result = await planManager.updatePlan(originalFilePath, fileName, book, data);
    res.json(result);
  } catch (error) {
    console.error('Error updating plan:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete plan
app.post('/api/plans/delete', async (req, res) => {
  try {
    const { filePath } = req.body;
    
    if (!filePath) {
      return res.status(400).json({ error: 'File path is required' });
    }
    
    const result = await planManager.deletePlan(filePath);
    res.json(result);
  } catch (error) {
    console.error('Error deleting plan:', error);
    res.status(500).json({ error: error.message });
  }
});

// Export all plans
app.get('/api/plans/export', async (req, res) => {
  try {
    const archive = await planManager.exportPlans();
    
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="health_insurance_plans_${new Date().toISOString().split('T')[0]}.zip"`);
    
    archive.pipe(res);
  } catch (error) {
    console.error('Error exporting plans:', error);
    res.status(500).json({ error: error.message });
  }
});

// Search plans
app.get('/api/plans/search', async (req, res) => {
  try {
    const { query, company, book, sumInsured } = req.query;
    const filters = {};
    
    if (company) filters.company = company;
    if (book) filters.book = book;
    if (sumInsured) filters.sumInsured = sumInsured;
    
    const result = await planManager.searchPlans(query, filters);
    res.json(result);
  } catch (error) {
    console.error('Error searching plans:', error);
    res.status(500).json({ error: error.message });
  }
});

// Test AI connection
app.post('/api/test-connection', async (req, res) => {
  try {
    const { llmProvider = 'groq' } = req.body;
    
    let isConnected = false;
    let provider = '';
    
    if (llmProvider === 'groq') {
      isConnected = await groqAnalyzer.testConnection();
      provider = 'Groq API (Llama 3.1 8B)';
    }

    res.json({
      connected: isConnected,
      provider: provider,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Connection test error:', error);
    res.json({
      connected: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// ===== HELPER FUNCTIONS =====

function isClaimAnalysisRequest(message, history) {
  const claimKeywords = [
    'claim', 'accident', 'hospital', 'medical', 'death', 'maturity',
    'eligibility', 'eligible', 'coverage', 'benefit', 'incident',
    'injury', 'illness', 'treatment', 'file claim', 'submit claim'
  ];
  
  const lowerMessage = message.toLowerCase();
  return claimKeywords.some(keyword => lowerMessage.includes(keyword));
}

async function performClaimAnalysis(message, session, llmProvider) {
  try {
    // Extract claim information from conversation
    const claimInfo = extractClaimInformation(session.history);
    
    // Get plan information
    const planContext = getPlanContext(session.planId);
    
    // Build analysis prompt
    const analysisPrompt = buildClaimAnalysisPrompt(claimInfo, planContext, session.history);
    
    if (llmProvider === 'groq') {
      const response = await groqAnalyzer.callGroqAPI(analysisPrompt);
      return response;
    }
    
    // Fallback response
    return `I understand you're inquiring about a claim. Based on our conversation, I can help analyze your situation. However, I need more specific details about:

1. **Type of claim**: Accident, illness, maternity, or death benefit?
2. **Incident details**: When did it occur? What happened?
3. **Current status**: Have you already filed the claim?
4. **Documentation**: What documents do you have available?

Please provide these details so I can give you a comprehensive analysis and guidance.`;

  } catch (error) {
    console.error('Claim analysis error:', error);
    return 'I apologize, but I encountered an error while analyzing your claim. Please provide more details and I\'ll do my best to help you.';
  }
}

async function getGeneralResponse(message, session, llmProvider) {
  try {
    const conversationContext = session.history.slice(-5).map(msg => 
      `${msg.role}: ${msg.content}`
    ).join('\n');

    const prompt = `You are a helpful LIC insurance assistant. Provide clear, accurate guidance about insurance policies and claims.

Conversation context:
${conversationContext}

Current user message: ${message}

Please provide a helpful, professional response. If the user is asking about claims, guide them through the process. If they need policy information, provide relevant details.`;

    if (llmProvider === 'groq') {
      return await groqAnalyzer.callGroqAPI(prompt);
    }
    
    // Fallback response
    return `Thank you for your message. I'm here to help with LIC insurance questions, claims guidance, and policy information. 

How can I assist you today? I can help with:
- Policy details and benefits
- Claim filing procedures
- Premium payment information
- Maturity and bonus calculations
- Coverage explanations

Please let me know what specific information you need.`;

  } catch (error) {
    console.error('General response error:', error);
    return 'I apologize, but I encountered an error processing your request. Please try again or rephrase your question.';
  }
}

function extractClaimInformation(history) {
  // Extract relevant claim information from conversation history
  const claimInfo = {};
  
  for (const message of history) {
    if (message.role === 'user') {
      const content = message.content.toLowerCase();
      
      // Extract claim type
      if (content.includes('accident')) claimInfo.type = 'accident';
      else if (content.includes('illness') || content.includes('disease')) claimInfo.type = 'illness';
      else if (content.includes('maternity') || content.includes('delivery')) claimInfo.type = 'maternity';
      else if (content.includes('death')) claimInfo.type = 'death';
      
      // Extract amount mentions
      const amountMatch = content.match(/(\d+(?:,\d+)*(?:\.\d+)?)\s*(?:rupees?|rs\.?|₹)/i);
      if (amountMatch) claimInfo.amount = amountMatch[1];
      
      // Extract dates
      const dateMatch = content.match(/(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/);
      if (dateMatch) claimInfo.date = dateMatch[1];
    }
  }
  
  return claimInfo;
}

function getPlanContext(planId) {
  // Get plan context for analysis
  try {
    if (!planId) return null;
    
    // This would fetch actual plan data in real implementation
    return {
      planId: planId,
      context: 'Plan context would be loaded here'
    };
  } catch (error) {
    console.error('Error getting plan context:', error);
    return null;
  }
}

function buildClaimAnalysisPrompt(claimInfo, planContext, history) {
  const conversationContext = history.slice(-5).map(msg => 
    `${msg.role}: ${msg.content}`
  ).join('\n');

  return `You are an expert LIC insurance claim analyst. Analyze the following claim based on the conversation and plan context.

Claim Information:
${JSON.stringify(claimInfo, null, 2)}

Plan Context:
${planContext ? JSON.stringify(planContext, null, 2) : 'No specific plan context available'}

Conversation History:
${conversationContext}

Please provide a detailed analysis including:
1. Claim eligibility assessment
2. Required documentation
3. Processing timeline
4. Potential issues or requirements
5. Next steps for the claimant

Be professional, accurate, and helpful in your response.`;
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
      console.log(`   • AI-powered chat assistance`);
      console.log(`   • Real-time claim analysis`);
      console.log(`   • Plan management system`);
      console.log(`   • Session management`);
      console.log(``);
      console.log(`API Endpoints:`);
      console.log(`- GET  /api/health - Health check`);
      console.log(`- POST /api/chat - Chat with AI`);
      console.log(`- GET  /api/claims/companies - Get insurance companies`);
      console.log(`- POST /api/claims/analyze - Analyze claims`);
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
