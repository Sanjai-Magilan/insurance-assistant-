# LIC Claim Assistant Bot - Dynamic Plan Management System

An intelligent LIC claim processing bot with dynamic plan management, customizable questions per plan, knowledge base integration, and AI-powered claim analysis using OpenRouter API.

## 🌟 Key Features

### ✅ Dynamic Plan Management
- Add, edit, delete insurance plans through CLI interface
- Upload policy documents (PDF/TXT) for each plan
- Automatic knowledge base creation from documents
- Plan-specific question configuration

### ✅ Customizable Questions
- Plan-specific question sets
- Support for multiple question types (text, number, date, select, boolean)
- Validation rules and error handling
- Easy question management through CLI

### ✅ AI-Powered Analysis
- OpenRouter API integration for LLM analysis
- Uses free Llama 3.1 8B model
- Policy document context-aware analysis
- Detailed eligibility reports with reasoning

### ✅ Knowledge Base Integration
- Document upload and text extraction
- Chunk-based information retrieval
- Plan-specific KB search functionality
- Support for PDF and TXT documents

## 🚀 Quick Start

### 1. Environment Setup
```bash
# Copy the example environment file
cp .env.example .env

# Edit .env file and add your API keys
# GROQ_API_KEY=your-actual-groq-api-key-here
```

### 2. Install Dependencies
```bash
cd lic-claim-bot
npm install
```

### 3. Setup Data Directories
```bash
npm run setup
```

### 4. Build the Project
```bash
npm run build
```

### 5. Run Plan Manager
```bash
npm run plan-manager
```

### 6. Configure Your First Plan

1. **Add a new plan** through the CLI
2. **Upload policy document** (PDF or TXT)
3. **Configure questions** (use defaults or customize)
4. **Set plan as active**

### 7. Configure OpenRouter API
- Get your free API key from [OpenRouter](https://openrouter.ai/)
- Set it in the bot using: `/setkey YOUR_API_KEY`

## 📁 Project Structure

```
src/
├── index_new.ts              # Main bot logic
├── interfaces/
│   └── planInterface.ts      # Plan and question interfaces
├── managers/
│   └── questionManager.ts    # Question management logic
├── services/
│   ├── knowledgeBaseManager.ts   # KB operations
│   └── openRouterAnalyzer.ts     # AI analysis service
├── flows/
│   └── conversationFlow.ts      # Conversation state management
└── cli/
    └── planManager.ts           # Plan management CLI

data/                        # Generated data directory
├── plans.json              # Plan configurations
├── questions/              # Plan-specific questions
│   ├── plan_123.json
│   └── plan_456.json
├── knowledge-base/         # Processed documents
│   ├── plan_123.json
│   └── plan_456.json
└── documents/              # Original uploaded documents
```

## 🔧 Plan Management CLI

The CLI provides a complete interface for managing plans:

### Main Menu Options:
1. **List all plans** - View all configured plans
2. **Add new plan** - Create a new insurance plan
3. **Edit plan** - Modify existing plan details
4. **Delete plan** - Remove a plan and its data
5. **Manage questions** - Configure plan-specific questions
6. **Upload policy document** - Add KB documents
7. **View KB status** - Check knowledge base status
8. **Exit** - Close the CLI

### Question Management:
- Add custom questions for each plan
- Support for different question types:
  - `text` - Free text input
  - `number` - Numeric values with validation
  - `date` - Date input with format validation
  - `select` - Multiple choice options
  - `boolean` - Yes/No questions
- Validation rules and error messages
- Question ordering and requirements

## 🤖 Bot Usage

### Setting Up API Key
```
User: /setkey sk-or-your-openrouter-api-key
Bot: ✅ OpenRouter API key configured successfully!
```

### Starting a Claim
```
User: Hello
Bot: Welcome to LIC Claim Assistant! 🏥

Available Insurance Plans:
• Jeevan Arogya - Health insurance plan
• Jeevan Anand - Life insurance plan

Please tell me which plan you have.
```

### Claim Processing Flow
1. **Plan Selection** - User selects their insurance plan
2. **Question Collection** - Bot asks plan-specific questions
3. **Answer Validation** - Validates responses in real-time
4. **AI Analysis** - Analyzes claim against policy terms
5. **Results Delivery** - Provides detailed eligibility report

## 🔑 OpenRouter Integration

### Supported Models
- `meta-llama/llama-3.1-8b-instruct:free` (Default free model)
- Easy to switch to other models if needed

### Analysis Features
- Policy context-aware analysis
- Eligibility determination with confidence scores
- Estimated claim amounts
- Detailed reasoning and recommendations
- Required document lists
- Risk factor identification

## 📊 Sample Analysis Output

```markdown
## 📋 Claim Analysis Results for Jeevan Arogya

**Eligibility Status:** ✅ ELIGIBLE

**Confidence Score:** 92%

**Estimated Coverage:** ₹45,000

**Analysis Summary:**
Based on the policy terms and provided information, this hospitalization claim appears eligible. The treatment falls within coverage parameters, waiting period requirements are met, and all necessary conditions are satisfied.

**Recommendations:**
1. Gather all original medical bills and discharge summary
2. Obtain treating doctor's certificate
3. Submit claim within 30 days of discharge

**Required Documents:**
1. Hospital discharge summary
2. All original bills and receipts
3. Treating physician's certificate
4. Policy document copy
```

## 🔒 Data Management

### File Storage
- Plans: `data/plans.json`
- Questions: `data/questions/{planId}.json`
- Knowledge Base: `data/knowledge-base/{planId}.json`
- Documents: `data/documents/{planId}_{filename}`

### Backup Strategy
- Regular backup of `data/` directory recommended
- Version control for question configurations
- Document storage with original filenames preserved

## 🛠 Development

### Watch Mode
```bash
npm run dev
```

### Type Checking
```bash
npm run check:type
```

### Adding New Question Types
1. Update `PlanQuestion` interface in `planInterface.ts`
2. Add validation logic in `questionManager.ts`
3. Update CLI input handling in `planManager.ts`

### Extending Analysis
1. Modify prompt in `openRouterAnalyzer.ts`
2. Update `AnalysisResult` interface for new fields
3. Enhance response parsing logic

## 🔧 Configuration

### Environment Variables
```bash
OPENROUTER_API_KEY=your-api-key-here  # Optional: set globally
```

### Plan Configuration Example
```json
{
  "id": "plan_123",
  "displayName": "Jeevan Arogya",
  "description": "Comprehensive health insurance plan",
  "questionCount": 8,
  "kbConfigured": true,
  "active": true,
  "createdAt": "2025-07-09T10:00:00.000Z",
  "updatedAt": "2025-07-09T10:00:00.000Z",
  "documentPath": "/path/to/policy.pdf"
}
```

## 🐛 Troubleshooting

### Common Issues

1. **API Key Not Working**
   - Verify key starts with `sk-or-`
   - Check OpenRouter account status
   - Ensure sufficient credits

2. **Document Upload Fails**
   - Check file path is absolute
   - Verify file permissions
   - Ensure supported format (PDF/TXT)

3. **Questions Not Loading**
   - Check question file exists
   - Verify JSON format validity
   - Ensure plan ID matches

4. **KB Search Not Working**
   - Verify document was processed
   - Check KB file exists
   - Ensure text extraction succeeded

## 📈 Future Enhancements

- [ ] PDF parsing with proper libraries (pdf-parse)
- [ ] Vector embeddings for better KB search
- [ ] Multi-language support
- [ ] Integration with actual LIC systems
- [ ] Advanced analytics and reporting
- [ ] Bulk plan import/export
- [ ] Web-based plan management interface

## 📝 License

This project is for educational and demonstration purposes. Please ensure compliance with LIC policies and regulations when adapting for production use.
