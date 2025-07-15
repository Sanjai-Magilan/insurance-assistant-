const { ClaimEligibilityEngine } = require('./claimEligibilityEngine.js');
const { PlanManager } = require('./planManager.js');
const { GroqAnalyzer } = require('./groqAnalyzer.js');
const { PlanIntelligenceEngine } = require('./planIntelligenceEngine.js');
const { ClarificationEngine } = require('./clarificationEngine.js');
const { ConversationContextManager } = require('./conversationContextManager.js');

/**
 * Conversational Claim Analyzer - Main orchestrator for AI-driven claim assessment
 * Features: Plan-specific intelligence, conversational flow, context management
 */
class ConversationalClaimAnalyzer {
    constructor() {
        this.claimEngine = new ClaimEligibilityEngine();
        this.planManager = new PlanManager();
        this.groqAnalyzer = new GroqAnalyzer();
        this.conversationSessions = new Map();
        this.planIntelligenceEngine = new PlanIntelligenceEngine();
        this.clarificationEngine = new ClarificationEngine();
        this.contextManager = new ConversationContextManager();
        this.promptEngine = new (require('./enhancedAIPromptEngine.js').EnhancedAIPromptEngine)();
    }

    /**
     * Main entry point for conversational claim analysis
     * @param {string} sessionId - Unique session identifier
     * @param {string} userInput - User's message/input
     * @param {Object} options - Additional options (planFilePath, claimData, etc.)
     * @returns {Object} Conversation response with next steps
     */
    async analyzeClaimConversational(sessionId, userInput, options = {}) {
        try {
            console.log(`🗣️ Processing conversational input for session: ${sessionId}`);
            
            // Get or create session
            let session = this.contextManager.getOrCreateSession(sessionId, options);
            
            // Add user input to conversation history
            this.contextManager.addMessage(session, 'user', userInput);

            // Determine conversation stage and process accordingly
            const response = await this.processConversationStage(session, userInput);

            // Add AI response to history
            this.contextManager.addMessage(session, 'assistant', response.message, response.data);

            // Update session
            this.contextManager.updateSession(sessionId, session);

            return {
                sessionId: sessionId,
                stage: session.stage,
                message: response.message,
                data: response.data || {},
                requiresInput: response.requiresInput || false,
                suggestions: response.suggestions || [],
                eligibilityResult: session.eligibilityResult,
                confidence: response.confidence || 100
            };

        } catch (error) {
            console.error('❌ Conversational analysis error:', error);
            return this.generateErrorResponse(sessionId, error);
        }
    }

    /**
     * Process conversation based on current stage
     */
    async processConversationStage(session, userInput) {
        switch (session.stage) {
            case 'plan_selection':
                return await this.handlePlanSelection(session, userInput);
            
            case 'initial_assessment':
                return await this.handleInitialAssessment(session, userInput);
            
            case 'data_gathering':
                return await this.handleDataGathering(session, userInput);
            
            case 'plan_analysis':
                return await this.handlePlanSpecificAnalysis(session, userInput);
            
            case 'clarification':
                return await this.handleClarificationQuestions(session, userInput);
            
            case 'final_analysis':
                return await this.handleFinalAnalysis(session, userInput);
            
            case 'follow_up':
                return await this.handleFollowUpQuestions(session, userInput);
            
            default:
                return await this.handleInitialContact(session, userInput);
        }
    }

    /**
     * Handle initial contact and plan selection
     */
    async handleInitialContact(session, userInput) {
        if (!session.planFilePath) {
            return {
                message: `👋 Hello! I'm your AI insurance claim assistant. I'll help you assess your claim eligibility with personalized guidance based on your specific plan.

To get started, I need to know which insurance plan you have. You can either:
• Select your plan from our database
• Tell me your insurance company and plan name
• Describe your policy details

What insurance plan do you have?`,
                requiresInput: true,
                suggestions: [
                    "I have a Star Health plan",
                    "I have a Care Health plan", 
                    "Show me available plans",
                    "I'm not sure about my plan details"
                ]
            };
        } else {
            session.stage = 'initial_assessment';
            return await this.handleInitialAssessment(session, userInput);
        }
    }

    /**
     * Handle plan selection process
     */
    async handlePlanSelection(session, userInput) {
        // Extract plan information from user input
        const planInfo = await this.extractPlanInformation(userInput);
        
        if (planInfo.planFilePath) {
            session.planFilePath = planInfo.planFilePath;
            session.planDetails = await this.planManager.getPlan(planInfo.planFilePath);
            session.stage = 'initial_assessment';
            
            return {
                message: `✅ Great! I found your plan: **${session.planDetails.data.plan_details['Plan Name']}** from **${session.planDetails.data.plan_details.Company}**.

Now, let's assess your claim. Please tell me about your medical condition or treatment that you want to claim for.

For example: "I need cataract surgery" or "I was hospitalized for heart treatment"`,
                requiresInput: true,
                suggestions: [
                    "I need cataract surgery",
                    "I was hospitalized for an accident",
                    "I have diabetes treatment costs",
                    "I need maternity coverage"
                ]
            };
        } else {
            // Plan not found, ask for more details or show available plans
            const availablePlans = await this.planManager.getAllPlans();
            const companies = [...new Set(availablePlans.map(p => p.company))];
            
            return {
                message: `I couldn't find your exact plan. Here are the available insurance companies in our database:

${companies.map(c => `• ${c}`).join('\n')}

Could you please specify:
1. Your insurance company name
2. Your plan name
3. Your sum insured amount

Or you can say "show plans" to see all available plans.`,
                requiresInput: true,
                suggestions: companies.concat(["Show all plans", "I need help finding my plan"])
            };
        }
    }

    /**
     * Handle initial assessment with plan-specific intelligence
     */
    async handleInitialAssessment(session, userInput) {
        // Extract claim information from user input
        const claimInfo = await this.extractClaimInformation(userInput, session.planDetails);
        
        // Merge with existing claim data
        Object.assign(session.claimData, claimInfo);

        // Use plan intelligence to analyze the condition
        const planAnalysis = await this.planIntelligenceEngine.analyzeConditionForPlan(
            session.claimData.medical_condition,
            session.planDetails.data
        );

        session.planAnalysis = planAnalysis;

        // Check if we need more information
        const missingInfo = this.identifyMissingInformation(session.claimData);
        
        if (missingInfo.length > 0) {
            session.stage = 'data_gathering';
            return await this.generateDataGatheringQuestion(session, missingInfo[0]);
        } else {
            session.stage = 'plan_analysis';
            return await this.handlePlanSpecificAnalysis(session, userInput);
        }
    }

    /**
     * Handle data gathering with intelligent questions
     */
    async handleDataGathering(session, userInput) {
        // Parse user response
        const parsedData = await this.parseUserResponse(userInput, session);
        Object.assign(session.claimData, parsedData);

        // Check for remaining missing information
        const missingInfo = this.identifyMissingInformation(session.claimData);
        
        if (missingInfo.length > 0) {
            return await this.generateDataGatheringQuestion(session, missingInfo[0]);
        } else {
            session.stage = 'plan_analysis';
            return await this.handlePlanSpecificAnalysis(session, userInput);
        }
    }

    /**
     * Handle plan-specific analysis with intelligent clarifications
     */
    async handlePlanSpecificAnalysis(session, userInput) {
        // Perform initial eligibility analysis
        const eligibilityResult = await this.claimEngine.analyzeClaimEligibility(
            session.claimData,
            session.planFilePath
        );

        session.eligibilityResult = eligibilityResult;

        // Generate plan-specific clarifications
        const clarifications = await this.clarificationEngine.generatePlanSpecificClarifications(
            session.claimData,
            session.planDetails.data,
            eligibilityResult
        );

        if (clarifications.length > 0) {
            session.stage = 'clarification';
            session.pendingClarifications = clarifications;
            
            return {
                message: `📋 I've analyzed your claim based on your **${session.planDetails.data.plan_details['Plan Name']}** plan. To provide the most accurate assessment, I need to clarify a few plan-specific details:

${clarifications[0].question}`,
                requiresInput: true,
                suggestions: clarifications[0].suggestions,
                data: {
                    preliminary_result: eligibilityResult,
                    clarifications_pending: clarifications.length,
                    plan_features_identified: session.planAnalysis
                }
            };
        } else {
            session.stage = 'final_analysis';
            return await this.generateFinalAnalysis(session);
        }
    }

    /**
     * Handle clarification questions with context awareness
     */
    async handleClarificationQuestions(session, userInput) {
        // Process the current clarification
        const currentClarification = session.pendingClarifications[0];
        const clarificationResponse = await this.clarificationEngine.processClarificationResponse(
            userInput,
            currentClarification,
            session
        );

        // Update claim data with clarification
        Object.assign(session.claimData, clarificationResponse);

        // Remove processed clarification
        session.pendingClarifications.shift();

        // Re-analyze with new information
        session.eligibilityResult = await this.claimEngine.analyzeClaimEligibility(
            session.claimData,
            session.planFilePath
        );

        // Check for more clarifications
        if (session.pendingClarifications.length > 0) {
            const nextClarification = session.pendingClarifications[0];
            return {
                message: `✅ Thank you for that clarification. I have one more question to ensure accuracy:

${nextClarification.question}`,
                requiresInput: true,
                suggestions: nextClarification.suggestions,
                data: {
                    updated_result: session.eligibilityResult,
                    clarifications_pending: session.pendingClarifications.length
                }
            };
        } else {
            session.stage = 'final_analysis';
            return await this.generateFinalAnalysis(session);
        }
    }

    /**
     * Generate final comprehensive analysis
     */
    async generateFinalAnalysis(session) {
        session.stage = 'follow_up';
        const result = session.eligibilityResult;
        const plan = session.planDetails.data;

        let message = `## 🏥 **Claim Eligibility Assessment Complete**\n\n`;

        if (result.eligible) {
            message += `✅ **Excellent News! Your claim is ELIGIBLE for processing**\n\n`;
            
            // Add personalized plan benefits
            if (session.planAnalysis?.specialFeatures?.length > 0) {
                message += `### 🌟 **Your Plan's Special Benefits for this Condition:**\n`;
                session.planAnalysis.specialFeatures.forEach(feature => {
                    message += `• ${feature}\n`;
                });
                message += `\n`;
            }

            message += `### 💰 **Financial Summary:**\n`;
            message += `• **Claim Amount**: ₹${result.claim_amount?.toLocaleString() || 'N/A'}\n`;
            message += `• **Sum Insured**: ${result.sum_insured || 'N/A'}\n`;
            
            if (result.financial_breakdown?.copay_amount > 0) {
                message += `• **Your Co-pay**: ₹${result.financial_breakdown.copay_amount.toLocaleString()} (${result.financial_breakdown.copay_percentage}%)\n`;
                message += `• **Insurance Payout**: ₹${result.financial_breakdown.final_amount.toLocaleString()}\n\n`;
            } else {
                message += `• **Expected Payout**: ₹${result.claim_amount?.toLocaleString() || 'N/A'}\n\n`;
            }

        } else {
            message += `❌ **Unfortunately, your claim is currently NOT ELIGIBLE**\n\n`;
            
            message += `### 🚫 **Reasons:**\n`;
            result.rejection_reasons?.forEach(reason => {
                message += `• ${reason}\n`;
            });
            message += `\n`;

            if (result.waiting_periods && Object.keys(result.waiting_periods).length > 0) {
                message += `### ⏰ **Waiting Periods:**\n`;
                Object.entries(result.waiting_periods).forEach(([key, value]) => {
                    message += `• **${key.replace(/_/g, ' ')}**: ${value}\n`;
                });
                message += `\n`;
            }
        }

        // Add plan-specific coverage details
        message += `### 📋 **Your ${plan.plan_details['Plan Name']} Coverage:**\n`;
        if (plan.basic_coverages) {
            message += `• **Pre-hospitalization**: ${plan.basic_coverages['Pre-Hospitalization']}\n`;
            message += `• **Post-hospitalization**: ${plan.basic_coverages['Post-Hospitalization']}\n`;
            message += `• **Room Rent**: ${plan.sub_limits?.['Room Rent/day'] || 'As per policy'}\n`;
            message += `• **Consumables**: ${plan.basic_coverages['Consumables']}\n\n`;
        }

        // Add intelligent recommendations
        if (result.recommendations?.length > 0) {
            message += `### 💡 **Personalized Recommendations:**\n`;
            result.recommendations.forEach(rec => {
                message += `• ${rec}\n`;
            });
            message += `\n`;
        }

        message += `### ❓ **I'm here to help with any questions!**\n`;
        message += `Feel free to ask about coverage details, claim process, or start a new assessment.`;

        return {
            message: message,
            requiresInput: true,
            suggestions: [
                "Explain my co-pay calculation",
                "What documents do I need?",
                "How to file this claim?",
                "Can I appeal this decision?",
                "Start new assessment"
            ],
            data: {
                final_result: result,
                plan_analysis: session.planAnalysis,
                analysis_complete: true
            }
        };
    }

    /**
     * Handle follow-up questions with contextual responses
     */
    async handleFollowUpQuestions(session, userInput) {
        const intent = this.classifyUserIntent(userInput);
        
        switch (intent) {
            case 'copay_explanation':
                return this.explainCopay(session);
            case 'documents_required':
                return this.explainRequiredDocuments(session);
            case 'claim_process':
                return this.explainClaimProcess(session);
            case 'appeal_process':
                return this.explainAppealProcess(session);
            case 'new_assessment':
                return this.startNewAssessment(session);
            default:
                return this.generateContextualResponse(session, userInput);
        }
    }

    /**
     * Utility Methods
     */
    
    async extractClaimInformation(text, planDetails) {
        const prompt = `Extract claim information from user input with plan context.

Plan Details: ${JSON.stringify(planDetails?.data?.plan_details || {})}
User Input: "${text}"

Extract and return JSON with these fields (only if clearly mentioned):
{
  "medical_condition": "string - medical condition/treatment",
  "patient_age": "number - if mentioned",
  "claim_amount": "number - if mentioned", 
  "treatment_type": "string - type of treatment",
  "emergency_treatment": "boolean - if emergency",
  "policy_start_date": "string - if mentioned"
}

Return only valid JSON:`;

        try {
            const response = await this.groqAnalyzer.analyzeQuery(prompt);
            const jsonMatch = response.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                return JSON.parse(jsonMatch[0]);
            }
        } catch (error) {
            console.log('AI extraction failed, using basic parsing');
        }

        // Fallback extraction
        return this.basicClaimExtraction(text);
    }

    basicClaimExtraction(text) {
        const extracted = {};
        
        // Medical conditions
        const conditions = ['cataract', 'diabetes', 'heart', 'cancer', 'surgery', 'accident', 'maternity', 'delivery'];
        const foundCondition = conditions.find(condition => 
            text.toLowerCase().includes(condition)
        );
        if (foundCondition) extracted.medical_condition = foundCondition;

        // Age extraction
        const ageMatch = text.match(/(\d+)\s*(?:years?|yrs?)\s*old/i);
        if (ageMatch) extracted.patient_age = parseInt(ageMatch[1]);

        // Amount extraction
        const amountMatch = text.match(/₹?\s*(\d+(?:,\d+)*)/);
        if (amountMatch) {
            extracted.claim_amount = parseInt(amountMatch[1].replace(/,/g, ''));
        }

        return extracted;
    }

    identifyMissingInformation(claimData) {
        const required = ['patient_name', 'patient_age', 'medical_condition', 'claim_amount', 'policy_start_date'];
        return required.filter(field => !claimData[field]);
    }

    async generateDataGatheringQuestion(session, missingField) {
        const questions = {
            'patient_name': {
                question: "What is the patient's name (the person who needs treatment)?",
                suggestions: ["Enter patient name"]
            },
            'patient_age': {
                question: "What is the patient's age?",
                suggestions: ["25 years", "35 years", "45 years", "65 years"]
            },
            'medical_condition': {
                question: "What is the medical condition or reason for treatment?",
                suggestions: ["Cataract surgery", "Heart disease", "Diabetes", "Accident injury"]
            },
            'claim_amount': {
                question: "What is the estimated claim amount or treatment cost?",
                suggestions: ["₹50,000", "₹1,00,000", "₹2,00,000", "₹5,00,000"]
            },
            'policy_start_date': {
                question: "When did your insurance policy start? (This helps determine waiting periods)",
                suggestions: ["January 2024", "6 months ago", "1 year ago", "2 years ago"]
            }
        };

        return questions[missingField] || {
            question: `Please provide ${missingField.replace('_', ' ')}`,
            suggestions: []
        };
    }

    generateErrorResponse(sessionId, error) {
        return {
            sessionId: sessionId,
            stage: 'error',
            message: `I apologize, but I encountered an issue while processing your request. Let me help you in a simpler way. 

Could you please tell me:
1. Your insurance plan name
2. The medical condition you want to claim for

I'll do my best to assist you.`,
            requiresInput: true,
            suggestions: [
                "I have a Star Health plan for cataract surgery",
                "Let me start over",
                "I need help with my claim"
            ],
            data: { error: error.message }
        };
    }

    // Session management methods
    getSession(sessionId) {
        return this.contextManager.getSession(sessionId);
    }

    clearSession(sessionId) {
        this.contextManager.clearSession(sessionId);
    }
}

module.exports = { ConversationalClaimAnalyzer };