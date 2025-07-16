# 🚀 How to Run the Enhanced AI Insurance Claim Assessment System

## 📋 **Prerequisites**

Before running the system, ensure you have:

1. **Node.js** (version 14 or higher)
2. **npm** (comes with Node.js)
3. **GROQ API Key** (for AI functionality)

## ⚡ **Quick Start (3 Steps)**

### **Step 1: Install Dependencies**
```bash
npm install
```

### **Step 2: Configure Environment**
Create a `.env` file in the root directory:
```env
PORT=3000
GROQ_API_KEY=your_groq_api_key_here
NODE_ENV=development
```

### **Step 3: Start the Server**
```bash
node chat-server.js
```

**✅ That's it! Your enhanced system is now running.**

## 🌐 **Access the System**

Once the server starts, you'll see:
```
🚀 Health Insurance Claim Assistant running on http://localhost:3000
📱 Available Interfaces:
   🏠 Homepage: http://localhost:3000
   📋 Plan Manager: http://localhost:3000/plans
   💬 Enhanced Chat Assistant: http://localhost:3000/chat
   🔍 Claim Assessment: http://localhost:3000/claims
```

### **🎯 Main Interfaces:**

1. **Enhanced AI Chat** (Recommended): 
   - URL: `http://localhost:3000/chat`
   - Features: Conversational flow, plan-specific intelligence, clarifications

2. **Plan Manager**: 
   - URL: `http://localhost:3000/plans`
   - Features: View, edit, create insurance plans

3. **Claim Assessment**: 
   - URL: `http://localhost:3000/claims`
   - Features: Traditional form-based claim assessment

4. **Homepage**: 
   - URL: `http://localhost:3000`
   - Features: System overview and navigation

## 🧪 **Test the Enhanced Features**

### **Quick Test - Cataract Example:**

1. **Open Enhanced Chat**: `http://localhost:3000/chat`

2. **Type**: "I need help with cataract surgery"

3. **Expected AI Response**: 
   ```
   I'd be happy to help! First, which insurance plan do you have?
   [Suggestion buttons appear]
   ```

4. **Click or Type**: "Star Health plan"

5. **AI Will**: 
   - Find your plan automatically
   - Recognize special cataract coverage ("ACTUAL" cost)
   - Ask clarifying questions about cataract cause

6. **Complete the conversation** to see plan-specific analysis

### **API Testing:**

Test the conversational API directly:
```bash
curl -X POST http://localhost:3000/api/claims/conversational-analysis \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "test_session",
    "userInput": "I need cataract surgery",
    "planFilePath": "data/plans/book1/health_assure_individual_5l.json"
  }'
```

### **Automated System Test:**
```bash
curl -X POST http://localhost:3000/api/claims/conversation/test
```

## 🔧 **Configuration Options**

### **Environment Variables:**
```env
# Server Configuration
PORT=3000                    # Server port (default: 3000)
NODE_ENV=development         # Environment mode

# AI Configuration  
GROQ_API_KEY=your_key_here   # Required for AI functionality

# Optional: Advanced Configuration
SESSION_TIMEOUT=1800000      # 30 minutes (in milliseconds)
MAX_CONVERSATION_HISTORY=50  # Maximum messages per session
```

### **Custom Configuration:**
Edit these files to customize behavior:
- **Session timeout**: `src/services/conversationContextManager.js` (line 8)
- **Prompt templates**: `src/services/enhancedAIPromptEngine.js` (line 15+)
- **Clarification rules**: `src/services/clarificationEngine.js` (line 20+)

## 🚨 **Troubleshooting**

### **Common Issues:**

#### **1. "Cannot find module" errors:**
```bash
# Solution: Install dependencies
npm install
```

#### **2. "GROQ_API_KEY not found" error:**
```bash
# Solution: Create .env file with your API key
echo "GROQ_API_KEY=your_actual_api_key" > .env
```

#### **3. "Port already in use" error:**
```bash
# Solution: Use different port
PORT=3001 node chat-server.js
```

#### **4. "Plans not loading" error:**
```bash
# Check if plan files exist
ls data/plans/book1/
# Should show JSON files
```

### **Debug Mode:**
```bash
# Run with detailed logging
DEBUG=* node chat-server.js
```

## 📱 **Interface Comparison**

| Feature | Enhanced Chat | Legacy Chat | Claim Assessment |
|---------|---------------|-------------|------------------|
| Conversational Flow | ✅ Yes | ❌ No | ❌ No |
| Plan-Specific Intelligence | ✅ Yes | ❌ Limited | ✅ Yes |
| Clarification Questions | ✅ Yes | ❌ No | ❌ No |
| Session Management | ✅ Yes | ✅ Basic | ❌ No |
| Real-time Analysis | ✅ Yes | ✅ Yes | ✅ Yes |
| **Recommended Use** | **Primary** | Backup | Form-based |

## 🎯 **Key Features to Test**

### **1. Plan-Specific Intelligence:**
- Try different insurance plans
- Notice how AI adapts responses based on plan features
- Example: "Star Health" vs "Care Health" plans

### **2. Conversational Clarifications:**
- Mention "cataract surgery"
- AI should ask about cause (age-related vs accident)
- Response changes based on your answer

### **3. Progressive Data Collection:**
- Start with minimal information
- AI will ask for missing details progressively
- Each question is contextually relevant

### **4. Context Preservation:**
- Have a long conversation
- AI remembers previous exchanges
- Can reference earlier information

### **5. Error Recovery:**
- Try invalid inputs
- AI provides helpful error messages
- Suggests corrective actions

## 📊 **Monitoring**

### **Session Monitoring:**
```bash
# View active sessions
curl http://localhost:3000/api/claims/conversations
```

### **Health Check:**
```bash
# Check system status
curl http://localhost:3000/api/health
```

### **Plan Statistics:**
```bash
# View plan statistics
curl http://localhost:3000/api/plans/stats
```

## 🔄 **Development Mode**

### **File Watching (Optional):**
For development, you can use nodemon:
```bash
# Install nodemon
npm install -g nodemon

# Run with auto-restart
nodemon chat-server.js
```

### **Code Structure:**
```
src/services/
├── conversationalClaimAnalyzer.js    # Main orchestrator
├── planIntelligenceEngine.js         # Plan-specific analysis
├── clarificationEngine.js            # Question generation
├── conversationContextManager.js     # Session management
└── enhancedAIPromptEngine.js         # AI prompt engineering
```

## 🎉 **Success Indicators**

You'll know the system is working correctly when:

1. **Server starts** without errors and shows interface URLs
2. **Enhanced chat** loads at `http://localhost:3000/chat`
3. **AI responds** to "Hello" with a welcome message
4. **Plan selection** works when you mention an insurance company
5. **Clarification questions** appear for specific medical conditions
6. **Session management** preserves conversation context

## 📞 **Getting Help**

If you encounter issues:

1. **Check the console** for error messages
2. **Verify `.env` file** has correct GROQ_API_KEY
3. **Confirm all files** are in correct directory structure
4. **Test API endpoints** individually using curl commands above
5. **Review logs** for specific error details

---

## 🚀 **Ready to Start?**

**Quick Start Command:**
```bash
# Copy and run this command sequence:
npm install && echo "GROQ_API_KEY=your_groq_api_key_here" > .env && node chat-server.js
```

**Then visit**: `http://localhost:3000/chat`

Your enhanced AI-driven insurance claim assessment system is ready to use! 🎯