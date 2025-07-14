// Production Setup CLI - LIC Claim Assistant
// This script sets up the production environment with AI-powered features
const fs = require('fs');
const path = require('path');
const readline = require('readline');

// Import our services
const { GroqAnalyzer } = require('./src/services/groqAnalyzer.js');
const knowledgeBaseGenerator = require('./src/services/knowledgeBaseGenerator.js');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const groqAnalyzer = new GroqAnalyzer();

class ProductionSetup {
  constructor() {
    this.dataDir = './data';
    this.plansFile = './data/plans.json';
    this.documentsDir = './data/documents';
    this.questionsDir = './data/questions';
    this.kbDir = './data/knowledge-base';
  }

  async initialize() {
    console.log('🚀 LIC Claim Assistant - Production Setup');
    console.log('=========================================');
    console.log('');
    
    // Ensure directories exist
    this.ensureDirectories();
    
    // Clean up example data
    await this.cleanupExampleData();
    
    // Main menu
    await this.showMainMenu();
  }

  ensureDirectories() {
    const dirs = [this.dataDir, this.documentsDir, this.questionsDir, this.kbDir];
    dirs.forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        console.log(`✅ Created directory: ${dir}`);
      }
    });
  }

  async cleanupExampleData() {
    console.log('🧹 Cleaning up example data...');
    
    // Reset plans.json to empty array
    fs.writeFileSync(this.plansFile, JSON.stringify([], null, 2));
    console.log('✅ Cleaned up example plans');

    // Clear example questions
    if (fs.existsSync(this.questionsDir)) {
      const files = fs.readdirSync(this.questionsDir);
      files.forEach(file => {
        if (file.endsWith('.json')) {
          fs.unlinkSync(path.join(this.questionsDir, file));
        }
      });
      console.log('✅ Cleaned up example questions');
    }

    // Clear example knowledge base
    if (fs.existsSync(this.kbDir)) {
      const files = fs.readdirSync(this.kbDir);
      files.forEach(file => {
        if (file.endsWith('.json')) {
          fs.unlinkSync(path.join(this.kbDir, file));
        }
      });
      console.log('✅ Cleaned up example knowledge base');
    }
    
    console.log('');
  }

  async showMainMenu() {
    console.log('📋 Production Setup Options:');
    console.log('1. Create New Insurance Plan (AI-Powered)');
    console.log('2. Upload Policy Document & Generate KB');
    console.log('3. Generate Questions for Existing Plan');
    console.log('4. View Current Plans');
    console.log('5. Test AI Connectivity');
    console.log('6. Exit');
    console.log('');

    const choice = await this.askQuestion('Select an option (1-6): ');
    
    switch (choice) {
      case '1':
        await this.createNewPlan();
        break;
      case '2':
        await this.uploadDocumentAndGenerateKB();
        break;
      case '3':
        await this.generateQuestionsForPlan();
        break;
      case '4':
        await this.viewCurrentPlans();
        break;
      case '5':
        await this.testAIConnectivity();
        break;
      case '6':
        console.log('👋 Goodbye!');
        rl.close();
        return;
      default:
        console.log('❌ Invalid option. Please try again.');
    }
    
    console.log('');
    await this.showMainMenu();
  }

  async createNewPlan() {
    console.log('');
    console.log('🆕 Creating New Insurance Plan');
    console.log('==============================');
    
    const planName = await this.askQuestion('Enter plan name (e.g., "LIC Jeevan Amar"): ');
    const planType = await this.askQuestion('Enter plan type (term/endowment/ulip/money-back): ');
    const description = await this.askQuestion('Enter plan description: ');
    
    console.log('');
    console.log('🤖 Using AI to generate comprehensive plan configuration...');
    
    try {
      // Generate plan configuration using AI
      const planConfig = await this.generatePlanConfiguration(planName, planType, description);
      
      // Generate questions using AI
      console.log('🤖 Generating intelligent questions for this plan...');
      const questions = await this.generateQuestionsWithAI(planName, planType, description);
      
      // Save plan
      const planId = this.generateId();
      const plan = {
        id: planId,
        name: planName,
        displayName: planName,
        type: planType,
        description: description,
        configuration: planConfig,
        questionCount: questions.length,
        kbConfigured: false,
        active: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      // Save to plans.json
      const plans = this.loadPlans();
      plans.push(plan);
      fs.writeFileSync(this.plansFile, JSON.stringify(plans, null, 2));
      
      // Save questions
      const questionsFile = path.join(this.questionsDir, `${planId}_questions.json`);
      fs.writeFileSync(questionsFile, JSON.stringify(questions, null, 2));
      
      console.log('');
      console.log('✅ Plan created successfully!');
      console.log(`📄 Plan ID: ${planId}`);
      console.log(`📝 Generated ${questions.length} intelligent questions`);
      console.log(`💾 Questions saved to: ${questionsFile}`);
      
    } catch (error) {
      console.error('❌ Error creating plan:', error.message);
    }
  }

  async generatePlanConfiguration(planName, planType, description) {
    const prompt = `
Generate a comprehensive insurance plan configuration for:
Plan Name: ${planName}
Plan Type: ${planType}
Description: ${description}

Please provide a JSON configuration with the following structure:
{
  "coverageDetails": {
    "minSumAssured": number,
    "maxSumAssured": number,
    "policyTermMin": number,
    "policyTermMax": number,
    "entryAgeMin": number,
    "entryAgeMax": number,
    "maturityAge": number
  },
  "benefits": [list of key benefits],
  "exclusions": [list of exclusions],
  "premiumStructure": {
    "paymentMode": ["yearly", "half-yearly", "quarterly", "monthly"],
    "premiumCalculationBasis": "description"
  },
  "claimProcess": [list of claim process steps],
  "requiredDocuments": [list of required documents for claims]
}

Provide only the JSON response, no additional text.`;

    const response = await groqAnalyzer.analyzeQuery(prompt);
    return this.extractJSON(response);
  }

  async generateQuestionsWithAI(planName, planType, description) {
    console.log('🤖 Generating intelligent questions using AI...');
    
    const prompt = `
Generate comprehensive claim assessment questions for this insurance plan:
Plan Name: ${planName}
Plan Type: ${planType}
Description: ${description}

Create 8-12 intelligent questions to assess claim eligibility. Each question should gather essential information for claim processing.

Please provide a JSON array with this structure:
[
  {
    "id": "q_timestamp_randomId",
    "text": "question text",
    "type": "text|number|date|choice|boolean",
    "required": true/false,
    "options": ["option1", "option2"] // only for choice type,
    "validation": {
      "errorMessage": "validation error message"
    },
    "order": number,
    "category": "personal|incident|policy|medical|financial"
  }
]

Include questions about:
- Personal details (name, age, policy number)
- Incident details (date, location, circumstances)
- Medical information (if applicable)
- Financial impact
- Documentation available

Provide only the JSON array, no additional text.`;      const response = await groqAnalyzer.analyzeQuery(prompt);
      const questions = this.extractJSON(response);
      
      // Ensure we have an array of questions
      let questionsArray = Array.isArray(questions) ? questions : [questions];
      
      // Filter out invalid questions and ensure proper structure
      questionsArray = questionsArray.filter(q => q && q.text).map((question, index) => {
        return {
          id: question.id || `q_${Date.now()}_${this.generateRandomId()}`,
          text: question.text,
          type: question.type || 'text',
          required: question.required !== false,
          options: question.options || undefined,
          validation: question.validation || {},
          order: index + 1,
          category: question.category || 'general'
        };
      });
      
      if (questionsArray.length === 0) {
        throw new Error('No valid questions generated');
      }
      
      return questionsArray;
  }

  async uploadDocumentAndGenerateKB() {
    console.log('');
    console.log('📄 Upload Policy Document & Generate Knowledge Base');
    console.log('=================================================');
    
    const plans = this.loadPlans();
    if (plans.length === 0) {
      console.log('❌ No plans available. Create a plan first.');
      return;
    }
    
    // Show available plans
    console.log('Available plans:');
    plans.forEach((plan, index) => {
      console.log(`${index + 1}. ${plan.name} (ID: ${plan.id})`);
    });
    
    const planIndex = await this.askQuestion('Select plan number: ');
    const selectedPlan = plans[parseInt(planIndex) - 1];
    
    if (!selectedPlan) {
      console.log('❌ Invalid plan selection.');
      return;
    }
    
    const documentPath = await this.askQuestion('Enter path to policy document (PDF/TXT): ');
    
    if (!fs.existsSync(documentPath)) {
      console.log('❌ Document not found at specified path.');
      return;
    }
    
    console.log('');
    console.log('🤖 Analyzing document and generating knowledge base...');
    
    try {
      // Copy document to our documents directory
      const fileName = path.basename(documentPath);
      const destPath = path.join(this.documentsDir, `${selectedPlan.id}_${fileName}`);
      fs.copyFileSync(documentPath, destPath);
      
      // Generate knowledge base
      const kbData = await this.generateKnowledgeBase(destPath, selectedPlan);
      
      // Save knowledge base
      const kbFile = path.join(this.kbDir, `${selectedPlan.id}_kb.json`);
      fs.writeFileSync(kbFile, JSON.stringify(kbData, null, 2));
      
      // Update plan
      selectedPlan.kbConfigured = true;
      selectedPlan.documentPath = destPath;
      selectedPlan.kbPath = kbFile;
      selectedPlan.updatedAt = new Date().toISOString();
      
      fs.writeFileSync(this.plansFile, JSON.stringify(plans, null, 2));
      
      console.log('');
      console.log('✅ Knowledge base generated successfully!');
      console.log(`📄 Document: ${destPath}`);
      console.log(`🧠 Knowledge Base: ${kbFile}`);
      console.log(`📊 KB Entries: ${kbData.entries?.length || 0}`);
      
    } catch (error) {
      console.error('❌ Error generating knowledge base:', error.message);
    }
  }

  async generateKnowledgeBase(documentPath, plan) {
    // Read document content (simplified - in production, use proper PDF parser)
    let content = '';
    try {
      content = fs.readFileSync(documentPath, 'utf8');
    } catch (error) {
      throw new Error(`Failed to read document: ${error.message}`);
    }
    
    const prompt = `
Analyze this insurance policy document and create a comprehensive knowledge base:

Document Content:
${content.substring(0, 4000)} // Truncate for prompt limits

Plan Details:
- Name: ${plan.name}
- Type: ${plan.type}
- Description: ${plan.description}

Generate a structured knowledge base with this JSON format:
{
  "planId": "${plan.id}",
  "documentAnalysis": {
    "planType": "detected plan type",
    "keyFeatures": ["feature1", "feature2"],
    "coverageDetails": {
      "sumAssured": "amount range",
      "policyTerm": "term range",
      "entryAge": "age range"
    }
  },
  "claimProcessing": {
    "eligibilityCriteria": ["criteria1", "criteria2"],
    "requiredDocuments": ["doc1", "doc2"],
    "processSteps": ["step1", "step2"],
    "timeframes": {
      "intimation": "X days",
      "documentation": "X days",
      "settlement": "X days"
    }
  },
  "exclusions": ["exclusion1", "exclusion2"],
  "benefits": ["benefit1", "benefit2"],
  "entries": [
    {
      "topic": "topic name",
      "content": "detailed information",
      "category": "category",
      "keywords": ["keyword1", "keyword2"]
    }
  ]
}

Provide only the JSON response, no additional text.`;

    const response = await groqAnalyzer.analyzeQuery(prompt);
    return this.extractJSON(response);
  }

  async generateQuestionsForPlan() {
    console.log('');
    console.log('❓ Generate Questions for Existing Plan');
    console.log('======================================');
    
    const plans = this.loadPlans();
    if (plans.length === 0) {
      console.log('❌ No plans available. Create a plan first.');
      return;
    }
    
    // Show available plans
    console.log('Available plans:');
    plans.forEach((plan, index) => {
      console.log(`${index + 1}. ${plan.name} (ID: ${plan.id}) - ${plan.questionCount} questions`);
    });
    
    const planIndex = await this.askQuestion('Select plan number: ');
    const selectedPlan = plans[parseInt(planIndex) - 1];
    
    if (!selectedPlan) {
      console.log('❌ Invalid plan selection.');
      return;
    }
    
    console.log('');
    console.log('🤖 Regenerating questions with AI...');
    
    try {
      const questions = await this.generateQuestionsWithAI(
        selectedPlan.name, 
        selectedPlan.type, 
        selectedPlan.description
      );
      
      // Save questions
      const questionsFile = path.join(this.questionsDir, `${selectedPlan.id}_questions.json`);
      fs.writeFileSync(questionsFile, JSON.stringify(questions, null, 2));
      
      // Update plan
      selectedPlan.questionCount = questions.length;
      selectedPlan.updatedAt = new Date().toISOString();
      fs.writeFileSync(this.plansFile, JSON.stringify(plans, null, 2));
      
      console.log('');
      console.log('✅ Questions regenerated successfully!');
      console.log(`📝 Generated ${questions.length} questions`);
      console.log(`💾 Saved to: ${questionsFile}`);
      
    } catch (error) {
      console.error('❌ Error generating questions:', error.message);
    }
  }

  async viewCurrentPlans() {
    console.log('');
    console.log('📋 Current Plans');
    console.log('================');
    
    const plans = this.loadPlans();
    
    if (plans.length === 0) {
      console.log('📭 No plans configured yet.');
      return;
    }
    
    plans.forEach((plan, index) => {
      console.log(`${index + 1}. ${plan.name}`);
      console.log(`   ID: ${plan.id}`);
      console.log(`   Type: ${plan.type}`);
      console.log(`   Questions: ${plan.questionCount}`);
      console.log(`   KB Configured: ${plan.kbConfigured ? '✅' : '❌'}`);
      console.log(`   Active: ${plan.active ? '✅' : '❌'}`);
      console.log(`   Created: ${new Date(plan.createdAt).toLocaleDateString()}`);
      console.log('');
    });
  }

  async testAIConnectivity() {
    console.log('');
    console.log('🔗 Testing AI Connectivity');
    console.log('===========================');
    
    console.log('Testing Groq API...');
    try {
      const response = await groqAnalyzer.analyzeQuery('Hello! Please respond with "Groq connection successful"');
      console.log('✅ Groq API: Connected');
      console.log(`   Response: ${response.substring(0, 100)}...`);
    } catch (error) {
      console.log('❌ Groq API: Failed');
      console.log(`   Error: ${error.message}`);
    }
    
    console.log('');
  }

  // Utility methods
  loadPlans() {
    if (!fs.existsSync(this.plansFile)) {
      return [];
    }
    try {
      const content = fs.readFileSync(this.plansFile, 'utf8');
      return JSON.parse(content);
    } catch (error) {
      console.error('Error loading plans:', error.message);
      return [];
    }
  }

  generateId() {
    return `plan_${Date.now()}_${this.generateRandomId()}`;
  }

  generateRandomId() {
    return Math.random().toString(36).substring(2, 15);
  }

  extractJSON(text) {
    console.log('🔍 Extracting JSON from AI response...');
    
    // Look for JSON blocks
    let startIndex = text.indexOf('{');
    let isArray = false;
    
    if (startIndex === -1) {
      startIndex = text.indexOf('[');
      isArray = true;
    }
    
    if (startIndex !== -1) {
      let braceCount = 0;
      let endIndex = -1;
      const startChar = isArray ? '[' : '{';
      const endChar = isArray ? ']' : '}';
      
      for (let i = startIndex; i < text.length; i++) {
        if (text[i] === startChar) braceCount++;
        else if (text[i] === endChar) {
          braceCount--;
          if (braceCount === 0) {
            endIndex = i;
            break;
          }
        }
      }
      
      if (endIndex !== -1) {
        try {
          const jsonString = text.substring(startIndex, endIndex + 1);
          console.log('✅ JSON extracted successfully');
          const parsed = JSON.parse(jsonString);
          
          // If we expected an array but got an object, or vice versa, handle it
          if (isArray && !Array.isArray(parsed)) {
            console.log('⚠️ Expected array but got object, converting...');
            return [parsed];
          }
          if (!isArray && Array.isArray(parsed)) {
            console.log('⚠️ Expected object but got array, returning first item...');
            return parsed[0] || {};
          }
          
          return parsed;
        } catch (error) {
          console.log('❌ JSON parsing failed:', error.message);
          console.log('📄 Raw JSON string:', text.substring(startIndex, Math.min(startIndex + 200, endIndex + 1)));
        }
      }
    }
    
    // Fallback: try to extract from code blocks
    const codeBlockMatch = text.match(/```(?:json)?\s*(\[[\s\S]*?\]|\{[\s\S]*?\})\s*```/);
    if (codeBlockMatch) {
      try {
        console.log('✅ Found JSON in code block');
        return JSON.parse(codeBlockMatch[1]);
      } catch (error) {
        console.log('❌ Code block JSON parsing failed:', error.message);
      }
    }
    
    throw new Error('No valid JSON found in response');
  }

  askQuestion(query) {
    return new Promise((resolve) => {
      rl.question(query, (answer) => {
        resolve(answer.trim());
      });
    });
  }
}

// Main execution
async function main() {
  const setup = new ProductionSetup();
  try {
    await setup.initialize();
  } catch (error) {
    console.error('❌ Setup failed:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = ProductionSetup;
