// Groq API Service - Fast and Powerful Free LLM
const https = require('https');

class GroqAnalyzer {
  constructor() {
    this.config = {
      apiKey: process.env.GROQ_API_KEY || 'your-groq-api-key-here',
      model: 'llama3-70b-8192', // Most powerful free model
      baseUrl: 'api.groq.com',
      temperature: 0.1,
      maxTokens: 4096,
      topP: 0.9
    };
  }

  async analyzeClaimEligibility(answers, policyContext, planName) {
    const prompt = this.buildAnalysisPrompt(answers, policyContext, planName);
    
    try {
      const response = await this.callGroqAPI(prompt);
      return this.parseAnalysisResult(response);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Groq analysis failed:', errorMessage);
      throw new Error(`Groq analysis failed: ${errorMessage}`);
    }
  }

  buildAnalysisPrompt(answers, policyContext, planName) {
    const answersText = answers
      .map(a => `Q: ${a.questionText}\nA: ${a.answer}`)
      .join('\n\n');

    return `You are an expert insurance claim analyst for LIC (Life Insurance Corporation of India) with 20+ years of experience. 

Analyze the following claim details against the policy terms and provide a comprehensive eligibility assessment.

POLICY: ${planName}

POLICY TERMS AND CONDITIONS:
${policyContext}

CLAIM DETAILS FROM CUSTOMER:
${answersText}

Perform a thorough analysis considering:
1. Policy coverage terms, limits, and conditions
2. Waiting periods and their compliance
3. Age limits and eligibility criteria
4. Claim type appropriateness and validity
5. Required documentation and evidence
6. Potential fraud indicators or red flags
7. Regulatory compliance requirements
8. Industry best practices

Provide your professional assessment in this exact JSON format:

{
  "isEligible": boolean,
  "eligibilityScore": number (0-1 confidence score),
  "estimatedAmount": number (estimated claim amount in INR),
  "reasoning": "Detailed professional explanation of your decision with specific policy references",
  "recommendations": ["Specific actionable recommendations for claim processing"],
  "requiredDocuments": ["Complete list of required documents for this specific claim"],
  "riskFactors": ["Any identified risk factors, concerns, or red flags"],
  "nextSteps": ["Immediate next steps for processing this claim"],
  "timeframe": "Expected processing timeframe",
  "additionalNotes": "Any other relevant observations or considerations"
}

Provide ONLY the JSON response with thorough, professional analysis. Use your expertise to ensure accuracy and compliance.`;
  }

  async callGroqAPI(prompt, options = {}) {
    console.log('🚀 Calling Groq API with Llama 3 70B...');
    
    try {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          messages: [
            {
              role: 'user',
              content: prompt
            }
          ],
          model: this.config.model,
          temperature: options.temperature || this.config.temperature,
          max_tokens: options.maxTokens || this.config.maxTokens,
          top_p: this.config.topP,
          stream: false
        })
      });

      console.log('📡 Groq Response Status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Groq API error:', response.status, errorText);
        throw new Error(`Groq API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      
      if (data.choices && data.choices[0] && data.choices[0].message) {
        const content = data.choices[0].message.content;
        console.log('✅ Got Groq response:', content.length, 'characters');
        
        // Log usage for monitoring free tier
        if (data.usage) {
          console.log('📊 Token usage:', data.usage);
        }
        
        return content;
      } else {
        console.log('❌ Invalid Groq response structure:', data);
        throw new Error('Invalid response format from Groq');
      }
      
    } catch (error) {
      console.error('❌ Groq request error:', error);
      throw new Error(`Groq connection failed: ${error.message}`);
    }
  }

  parseAnalysisResult(response) {
    try {
      // Find JSON in the response
      const startIndex = response.indexOf('{');
      if (startIndex === -1) {
        throw new Error('No JSON found in response');
      }

      let braceCount = 0;
      let endIndex = -1;
      
      for (let i = startIndex; i < response.length; i++) {
        if (response[i] === '{') {
          braceCount++;
        } else if (response[i] === '}') {
          braceCount--;
          if (braceCount === 0) {
            endIndex = i;
            break;
          }
        }
      }

      if (endIndex === -1) {
        throw new Error('Incomplete JSON structure');
      }

      const jsonString = response.substring(startIndex, endIndex + 1);
      console.log('📄 Extracted JSON from Groq response');
      
      const parsed = JSON.parse(jsonString);

      // Validate and normalize the response
      return {
        isEligible: parsed.isEligible !== undefined ? parsed.isEligible : false,
        eligibilityScore: parsed.eligibilityScore !== undefined ? parsed.eligibilityScore : 0,
        estimatedAmount: parsed.estimatedAmount !== undefined ? parsed.estimatedAmount : 0,
        reasoning: parsed.reasoning || 'Analysis completed but no detailed reasoning provided.',
        recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations : [],
        requiredDocuments: Array.isArray(parsed.requiredDocuments) ? parsed.requiredDocuments : [],
        riskFactors: Array.isArray(parsed.riskFactors) ? parsed.riskFactors : [],
        nextSteps: Array.isArray(parsed.nextSteps) ? parsed.nextSteps : [],
        timeframe: parsed.timeframe || 'Standard processing time',
        additionalNotes: parsed.additionalNotes || ''
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Failed to parse Groq analysis result:', errorMessage);
      console.error('Raw response:', response.substring(0, 500));
      
      // Return a fallback result
      return {
        isEligible: false,
        eligibilityScore: 0,
        estimatedAmount: 0,
        reasoning: 'Unable to parse AI analysis result. Please review manually.',
        recommendations: ['Manual review required due to parsing error'],
        requiredDocuments: ['Standard claim documentation'],
        riskFactors: ['Analysis parsing failed'],
        nextSteps: ['Escalate to manual review'],
        timeframe: 'Manual review required',
        additionalNotes: 'System experienced parsing error'
      };
    }
  }

  async testConnection() {
    try {
      const testPrompt = 'Hello! Please respond with "Groq API is working correctly" to confirm the connection.';
      const response = await this.callGroqAPI(testPrompt);
      return response.toLowerCase().includes('groq') && response.toLowerCase().includes('working');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Groq connection test failed:', errorMessage);
      return false;
    }
  }

  // Method for generating knowledge base content
  async generateKnowledgeBase(policyContent, planName) {
    const prompt = `You are an expert insurance knowledge architect. Create a comprehensive, structured knowledge base from this LIC policy document.

POLICY DOCUMENT: ${planName}
CONTENT: ${policyContent}

Analyze and structure the information into this detailed JSON format:

{
  "planName": "${planName}",
  "summary": "Professional summary of the policy",
  "keyFeatures": ["Detailed list of main features"],
  "coverage": {
    "maxAmount": "Maximum coverage amount with currency",
    "coverageTypes": ["Comprehensive list of what's covered"],
    "inclusions": ["Detailed inclusions"],
    "exclusions": ["Detailed exclusions with explanations"],
    "waitingPeriods": ["All waiting periods with durations"]
  },
  "eligibility": {
    "ageRange": "Complete age eligibility range",
    "requirements": ["All eligibility requirements"],
    "restrictions": ["Any restrictions or conditions"],
    "healthRequirements": ["Health-related requirements"]
  },
  "claims": {
    "claimProcess": ["Detailed step-by-step claim process"],
    "requiredDocuments": ["Complete list of required documents"],
    "timeframes": ["All relevant timeframes and deadlines"],
    "contactInfo": ["All relevant contact information"]
  },
  "benefits": {
    "mainBenefits": ["Primary policy benefits"],
    "additionalBenefits": ["Optional or rider benefits"],
    "maturityBenefits": ["Benefits at policy maturity"],
    "deathBenefits": ["Death benefit details"]
  },
  "premiums": {
    "paymentOptions": ["All payment frequency options"],
    "calculationFactors": ["Factors affecting premium calculation"],
    "discounts": ["Available discounts and conditions"]
  },
  "importantTerms": [
    {
      "term": "Technical term",
      "definition": "Clear, comprehensive definition"
    }
  ],
  "riskAssessment": {
    "riskFactors": ["Factors that increase claim risk"],
    "fraudIndicators": ["Common fraud patterns for this policy"],
    "redFlags": ["Warning signs during claim processing"]
  }
}

Provide comprehensive, accurate information extracted directly from the policy document.`;

    try {
      const response = await this.callGroqAPI(prompt);
      return this.parseKnowledgeBase(response);
    } catch (error) {
      console.error('❌ Groq KB generation failed:', error.message);
      throw error;
    }
  }

  parseKnowledgeBase(response) {
    try {
      const startIndex = response.indexOf('{');
      if (startIndex === -1) throw new Error('No JSON found');
      
      let braceCount = 0;
      let endIndex = -1;
      
      for (let i = startIndex; i < response.length; i++) {
        if (response[i] === '{') braceCount++;
        else if (response[i] === '}') {
          braceCount--;
          if (braceCount === 0) {
            endIndex = i;
            break;
          }
        }
      }
      
      if (endIndex === -1) throw new Error('Incomplete JSON');
      
      const jsonString = response.substring(startIndex, endIndex + 1);
      const parsed = JSON.parse(jsonString);
      
      console.log('✅ Knowledge base generated by Groq successfully');
      return parsed;
    } catch (error) {
      console.error('❌ Groq KB parsing failed:', error.message);
      return {
        planName: 'Unknown Plan',
        summary: 'Failed to parse policy document',
        keyFeatures: ['Manual review required'],
        coverage: { maxAmount: 'Unknown', coverageTypes: [], inclusions: [], exclusions: [], waitingPeriods: [] },
        eligibility: { ageRange: 'Unknown', requirements: [], restrictions: [], healthRequirements: [] },
        claims: { claimProcess: [], requiredDocuments: [], timeframes: [], contactInfo: [] },
        benefits: { mainBenefits: [], additionalBenefits: [], maturityBenefits: [], deathBenefits: [] },
        premiums: { paymentOptions: [], calculationFactors: [], discounts: [] },
        importantTerms: [],
        riskAssessment: { riskFactors: [], fraudIndicators: [], redFlags: [] }
      };
    }
  }

  // General purpose query method for various AI tasks
  async analyzeQuery(prompt, options = {}) {
    const temperature = options.temperature || this.config.temperature;
    const maxTokens = options.maxTokens || this.config.maxTokens;
    
    try {
      const response = await this.callGroqAPI(prompt, { temperature, maxTokens });
      return response;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Groq query failed:', errorMessage);
      throw new Error(`Groq query failed: ${errorMessage}`);
    }
  }
}

module.exports = { GroqAnalyzer };
