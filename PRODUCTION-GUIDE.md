# LIC Claim Assistant - Production Setup Guide

## 🚀 Production-Ready Features

This LIC Claim Assistant now includes production-level capabilities with AI-powered plan and question generation.

## 📋 Getting Started

### 1. **Production Setup**
Run the production setup CLI to create plans and configure the system:

```bash
node production-setup.js
```

This interactive CLI allows you to:
- ✅ Create new insurance plans with AI-generated configurations
- ✅ Upload policy documents and generate knowledge bases
- ✅ Generate intelligent questions for claim assessment
- ✅ View and manage existing plans
- ✅ Test AI connectivity

### 2. **Start the Chat Server**
```bash
node chat-server.js
```

### 3. **Access the Chat Interface**
Open your browser and navigate to `http://localhost:3000`

## 🔧 Enhanced Features

### **AI-Powered Plan Creation**
- Uses LLM to generate comprehensive plan configurations
- Automatically creates intelligent assessment questions
- Supports multiple insurance plan types (term, endowment, ULIP, money-back)

### **Document Analysis & Knowledge Base Generation**
- Upload PDF policy documents
- AI analyzes documents to extract key information
- Generates structured knowledge base for accurate claim guidance

### **Intelligent Question Generation**
- Creates context-aware questions for each plan
- Covers personal details, incident information, medical data, and financial impact
- Validates claim eligibility based on responses

### **Modern Chat Interface**
- 🌓 Dark/Light theme toggle
- 🎤 Voice input support (browser dependent)
- 📤 Export conversation history
- 📥 Import previous conversations
- 🔄 Message retry functionality
- ⚡ Real-time typing indicators
- 📱 Mobile-responsive design

## 🏗️ System Architecture

### **Data Structure**
```
data/
├── plans.json              # Plan configurations
├── documents/              # Uploaded policy documents
├── questions/              # Generated questions per plan
└── knowledge-base/         # AI-generated knowledge bases
```

### **AI Providers Supported**
- **Groq API** (Llama 3 70B) - Default, fastest
- **Google Gemini** - Advanced capabilities
- **Local LM Studio** - Private, secure

### **Production Endpoints**
- `GET /api/plans` - Fetch available plans
- `POST /api/chat` - Chat with AI assistant
- `POST /api/upload` - Upload documents
- `GET /api/status` - System health check
- `GET /api/sessions` - Session management
- `GET /api/export/:sessionId` - Export conversations

## 🗂️ Plan Management

### **Creating a New Plan**
1. Run `node production-setup.js`
2. Select "Create New Insurance Plan"
3. Provide plan name, type, and description
4. AI generates comprehensive configuration and questions
5. Plan is saved and immediately available in chat interface

### **Adding Policy Documents**
1. Use production setup CLI
2. Select "Upload Policy Document & Generate KB"
3. Choose existing plan
4. Provide document path
5. AI analyzes document and creates knowledge base

## 🔧 Configuration

### **Environment Variables**
- `PORT` - Server port (default: 3000)
- `NODE_ENV` - Environment (development/production)

### **API Keys**
Update API keys in the respective analyzer files:
- `src/services/groqAnalyzer.js` - Groq API key
- `src/services/geminiAnalyzer.ts` - Gemini API key

### **Local LM Studio Setup**
1. Install and run LM Studio
2. Load a model (e.g., Mistral 7B)
3. Start local server on `http://127.0.0.1:1234`

## 🚦 Production Checklist

- ✅ Example data cleaned up
- ✅ AI-powered plan generation implemented
- ✅ Document analysis and KB generation ready
- ✅ Dynamic plan loading in chat interface
- ✅ Enhanced error handling and retry mechanisms
- ✅ Session management and conversation export
- ✅ Rate limiting and security measures
- ✅ Mobile-responsive design
- ✅ Multiple AI provider support

## 📝 Usage Flow

1. **Admin Setup**: Use `production-setup.js` to create plans and upload documents
2. **Customer Experience**: Users select plans and chat for claim assistance
3. **AI Analysis**: System provides intelligent claim assessment and guidance
4. **Documentation**: Export conversations for records and compliance

## 🛠️ Maintenance

### **Adding New Plans**
Use the production setup CLI - it's designed for non-technical users to easily add new insurance plans with AI assistance.

### **Updating Knowledge Bases**
Re-run document analysis through the CLI when policy documents are updated.

### **Monitoring**
- Check `/api/status` for system health
- Monitor conversation sessions via `/api/sessions`
- Export conversation data for analysis

## 🎯 Ready for Production

The system is now enterprise-ready with:
- Scalable architecture
- AI-powered intelligence
- Professional user interface
- Comprehensive error handling
- Export/import capabilities
- Multi-provider AI support
- Production-grade security

**Start creating your first production plan with `node production-setup.js`!**
