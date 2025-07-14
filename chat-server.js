// Chat Interface Backend Server - Enhanced Version
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

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});

// Middleware
app.use(limiter);
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname)));

// Enhanced logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Initialize AI services
const groqAnalyzer = new GroqAnalyzer();
const healthAnalyzer = new HealthInsuranceClaimAnalyzer();
const planManager = new PlanManager();

// Store conversation sessions (in production, use a database)
const conversationSessions = new Map();

// Routes

// Serve the main interfaces
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/chat-interface.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'chat-interface.html'));
});

app.get('/claim-assessment.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'claim-assessment.html'));
});

// Health Insurance API Endpoints

// Get available insurance companies
app.get('/api/health-plans/companies', (req, res) => {
  try {
    const companies = healthAnalyzer.getAvailableCompanies();
    res.json(companies);
  } catch (error) {
    console.error('Error getting companies:', error);
    res.status(500).json({ error: 'Failed to load companies' });
  }
});

// Get plans by company
app.get('/api/health-plans/company/:company', (req, res) => {
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
app.post('/api/health-claims/analyze', async (req, res) => {
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

// Get plan summary for admin
app.get('/api/health-plans/summary', (req, res) => {
  try {
    const summary = healthAnalyzer.getPlanSummary();
    res.json(summary);
  } catch (error) {
    console.error('Error getting plan summary:', error);
    res.status(500).json({ error: 'Failed to get plan summary' });
  }
});

// Plan Management API Endpoints

// Serve the plan management interface
app.get('/plans', (req, res) => {
  res.sendFile(path.join(__dirname, 'plan-management-interface.html'));
});

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

// Serve the homepage
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Serve the chat interface
app.get('/chat', (req, res) => {
  res.sendFile(path.join(__dirname, 'chat-interface.html'));
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    services: {
      groq: 'available',
      local: 'available',
      gemini: 'available'
    }
  });
});

// Get available plans
app.get('/api/plans', (req, res) => {
  try {
    const plansPath = path.join(__dirname, 'data', 'plans.json');
    
    if (!fs.existsSync(plansPath)) {
      return res.json([]);
    }
    
    const plansData = fs.readFileSync(plansPath, 'utf8');
    const plans = JSON.parse(plansData);
    
    res.json(plans.filter(plan => plan.active !== false));
  } catch (error) {
    console.error('Error loading plans:', error);
    res.status(500).json({ error: 'Failed to load plans' });
  }
});

// Chat endpoint
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
app.get('/api/sessions/:sessionId/history', (req, res) => {
  const { sessionId } = req.params;
  const session = conversationSessions.get(sessionId);
  
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }

  res.json({
    sessionId: sessionId,
    history: session.history,
    planId: session.planId,
    files: session.files || [],
    createdAt: session.createdAt
  });
});

// Clear conversation history
app.delete('/api/sessions/:sessionId', (req, res) => {
  const { sessionId } = req.params;
  conversationSessions.delete(sessionId);
  
  res.json({ 
    message: 'Session cleared successfully',
    sessionId: sessionId
  });
});

// Test LLM connection
app.post('/api/test-connection', async (req, res) => {
  try {
    const { llmProvider = 'groq' } = req.body;
    
    let isConnected = false;
    let provider = '';
    
    if (llmProvider === 'groq') {
      isConnected = await groqAnalyzer.testConnection();
      provider = 'Groq API (Llama 3 70B)';
    } else if (llmProvider === 'local') {
      // Test local LM Studio connection
      isConnected = await testLocalConnection();
      provider = 'Local LM Studio';
    } else if (llmProvider === 'gemini') {
      // Test Gemini connection
      isConnected = await testGeminiConnection();
      provider = 'Google Gemini';
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

// Helper Functions

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
    
    // Simulate claim analysis (in real implementation, use actual services)
    if (llmProvider === 'groq') {
      const analysisPrompt = buildClaimAnalysisPrompt(claimInfo, planContext, session.history);
      const response = await groqAnalyzer.callGroqAPI(analysisPrompt);
      return response;
    }
    
    // Fallback response
    return `I understand you're inquiring about a claim. Based on our conversation, I can help analyze your situation. However, I need more specific details about:

1. **Type of claim**: Accident, illness, maturity, or death benefit?
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
    ).join('\\n');

    const prompt = `You are a helpful LIC insurance assistant. Provide clear, accurate guidance about insurance policies and claims.

Conversation context:
${conversationContext}

Current user message: ${message}

Please provide a helpful, professional response. If the user is asking about claims, guide them through the process. If they need policy information, provide relevant details.`;

    if (llmProvider === 'groq') {
      return await groqAnalyzer.callGroqAPI(prompt);
    }
    
    // Fallback response
    return `Thank you for your message. I'm here to help with your LIC insurance needs. 

I can assist you with:
- Claim filing and analysis
- Policy information and benefits
- Required documentation
- Eligibility verification
- General insurance guidance

How can I specifically help you today?`;

  } catch (error) {
    console.error('General response error:', error);
    return 'I apologize, but I\'m experiencing technical difficulties. Please try again or contact our support team for assistance.';
  }
}

function extractClaimInformation(history) {
  // Extract relevant claim information from conversation history
  const claimInfo = {
    type: 'unknown',
    details: [],
    userInfo: {}
  };

  history.forEach(msg => {
    if (msg.role === 'user') {
      const content = msg.content.toLowerCase();
      
      // Extract claim type
      if (content.includes('accident')) claimInfo.type = 'accident';
      else if (content.includes('illness') || content.includes('medical')) claimInfo.type = 'medical';
      else if (content.includes('death')) claimInfo.type = 'death';
      else if (content.includes('maturity')) claimInfo.type = 'maturity';
      
      // Store details
      claimInfo.details.push(msg.content);
    }
  });

  return claimInfo;
}

function getPlanContext(planId) {
  const planDetails = {
    jeevan_amar: {
      name: 'LIC Jeevan Amar',
      type: 'Term Insurance',
      coverage: 'Death benefit with optional riders',
      waitingPeriod: '30 days for accidental claims',
      ageRange: '18-60 years',
      maxCoverage: 'Rs. 25,00,000 minimum'
    },
    jeevan_anand: {
      name: 'LIC Jeevan Anand',
      type: 'Endowment Plan',
      coverage: 'Life coverage with maturity benefits',
      waitingPeriod: '2 years for natural death, 30 days for accident',
      ageRange: '18-50 years',
      maxCoverage: 'Flexible coverage options'
    }
  };

  return planDetails[planId] || {
    name: 'Unknown Plan',
    type: 'Please specify your plan details',
    coverage: 'Coverage details needed',
    waitingPeriod: 'Please provide policy terms',
    ageRange: 'Age eligibility unknown',
    maxCoverage: 'Coverage amount unknown'
  };
}

function buildClaimAnalysisPrompt(claimInfo, planContext, history) {
  const conversationSummary = history.slice(-5).map(msg => 
    `${msg.role}: ${msg.content}`
  ).join('\\n');

  return `You are an expert LIC claim analyst. Analyze this claim based on the conversation and policy details.

POLICY INFORMATION:
- Plan: ${planContext.name}
- Type: ${planContext.type}
- Coverage: ${planContext.coverage}
- Waiting Period: ${planContext.waitingPeriod}
- Age Range: ${planContext.ageRange}

CLAIM INFORMATION:
- Type: ${claimInfo.type}
- Details: ${claimInfo.details.join(' | ')}

CONVERSATION CONTEXT:
${conversationSummary}

Please provide a comprehensive analysis including:
1. Initial eligibility assessment
2. Required documentation
3. Next steps for the claimant
4. Any potential issues or concerns
5. Recommendations for successful claim processing

Be helpful, professional, and specific to the policy terms.`;
}

async function testLocalConnection() {
  try {
    const response = await fetch('http://127.0.0.1:1234/v1/models');
    return response.ok;
  } catch (error) {
    return false;
  }
}

async function testGeminiConnection() {
  try {
    const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models?key=AIzaSyACpM8egMhTqESpcZzXAgTifh43GsVdvps');
    return response.ok;
  } catch (error) {
    return false;
  }
}

// Enhanced API endpoints

// Session management
app.get('/api/sessions', (req, res) => {
  const sessions = Array.from(conversationSessions.entries()).map(([id, session]) => ({
    id,
    createdAt: session.createdAt,
    messageCount: session.history.length,
    planId: session.planId
  }));
  
  res.json({ sessions });
});

app.delete('/api/sessions/:sessionId', (req, res) => {
  const { sessionId } = req.params;
  
  if (conversationSessions.has(sessionId)) {
    conversationSessions.delete(sessionId);
    res.json({ message: 'Session deleted successfully' });
  } else {
    res.status(404).json({ error: 'Session not found' });
  }
});

// Conversation export
app.get('/api/export/:sessionId', (req, res) => {
  const { sessionId } = req.params;
  const session = conversationSessions.get(sessionId);
  
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }
  
  const exportData = {
    sessionId,
    planId: session.planId,
    history: session.history,
    createdAt: session.createdAt,
    exportedAt: new Date().toISOString(),
    version: '1.0'
  };
  
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename="chat-export-${sessionId}.json"`);
  res.json(exportData);
});

// Enhanced status endpoint
app.get('/api/status', async (req, res) => {
  const groqStatus = await testGroqConnection();
  const localStatus = await testLocalConnection();
  const geminiStatus = await testGeminiConnection();
  
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    services: {
      groq: groqStatus ? 'connected' : 'disconnected',
      local: localStatus ? 'connected' : 'disconnected',
      gemini: geminiStatus ? 'connected' : 'disconnected'
    },
    sessions: {
      active: conversationSessions.size,
      total: Array.from(conversationSessions.values()).reduce((sum, session) => sum + session.history.length, 0)
    },
    uptime: process.uptime()
  });
});

// WebSocket-like server-sent events for real-time updates
app.get('/api/events', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Cache-Control'
  });

  const clientId = Date.now();
  
  // Send initial connection event
  res.write(`data: ${JSON.stringify({ type: 'connected', clientId })}\n\n`);
  
  // Keep connection alive
  const keepAlive = setInterval(() => {
    res.write(`data: ${JSON.stringify({ type: 'ping', timestamp: Date.now() })}\n\n`);
  }, 30000);
  
  req.on('close', () => {
    clearInterval(keepAlive);
  });
});

// Enhanced error handling middleware
app.use((error, req, res, next) => {
  console.error('Error:', error);
  res.status(500).json({ 
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Health Insurance Claim Assistant running on http://localhost:${PORT}`);
  console.log('📱 Available Interfaces:');
  console.log(`   🏠 Homepage: http://localhost:${PORT}`);
  console.log(`   📋 Plan Manager: http://localhost:${PORT}/plans`);
  console.log(`   💬 Chat Assistant: http://localhost:${PORT}/chat-interface.html`);
  console.log(`   🔍 Claim Assessment: http://localhost:${PORT}/claim-assessment.html`);
  console.log('');
  console.log('🔧 Enhanced Features:');
  console.log('   • Dark/Light theme toggle');
  console.log('   • Voice input support');
  console.log('   • Conversation export/import');
  console.log('   • Real-time typing indicators');
  console.log('   • Message status tracking');
  console.log('   • Enhanced error handling');
  console.log('   • Session management');
  console.log('');
  console.log('Available Core Features:');
  console.log('✅ Multi-provider AI (Groq, Local LM, Gemini)');
  console.log('✅ Plan-specific guidance');
  console.log('✅ Plan management system');
  console.log('✅ Conversation history');
  console.log('✅ Real-time claim analysis');
  console.log('');
  console.log('API Endpoints:');
  console.log('- GET  /api/health - Health check');
  console.log('- POST /api/chat - Chat with AI');
  console.log('- GET  /plans - Plan management interface');
  console.log('- GET  /api/plans/list - Get all plans');
  console.log('- POST /api/plans/create - Create new plan');
  console.log('- POST /api/plans/update - Update existing plan');
  console.log('- POST /api/plans/delete - Delete plan');
  console.log('- GET  /api/plans/export - Export all plans');
  console.log('- POST /api/test-connection - Test AI providers');
  console.log('- GET  /api/sessions - List all sessions');
  console.log('- GET  /api/export/:sessionId - Export conversation');
  console.log('- GET  /api/status - Enhanced system status');
  console.log('');
});
