const { GroqAnalyzer } = require('./groqAnalyzer.js');

/**
 * Enhanced AI Prompt Engine - Generates context-aware prompts for better AI responses
 * Handles plan-specific context, conversation flow, and intelligent analysis
 */
class EnhancedAIPromptEngine {
    constructor() {
        this.groqAnalyzer = new GroqAnalyzer();
        this.promptTemplates = new Map();
        this.contextStrategies = new Map();
        this.initializePromptTemplates();
        this.initializeContextStrategies();
    }

    /**
     * Initialize prompt templates for different scenarios
     */
    initializePromptTemplates() {
        // Plan extraction prompt
        this.promptTemplates.set('plan_extraction', {
            template: `Extract insurance plan information from user input.

User Input: "{userInput}"
Available Plans Context: {availablePlans}

Extract and return JSON with:
{
  "planFilePath": "exact file path if found",
  "company": "insurance company name",
  "planName": "plan name",
  "confidence": "number 0-100"
}

Return only valid JSON:`,
            requiredContext: ['userInput', 'availablePlans']
        });

        // Claim information extraction
        this.promptTemplates.set('claim_extraction', {
            template: `Extract claim information from user input with plan context.

Plan Context: {planContext}
User Input: "{userInput}"
Session Context: {sessionContext}

Extract and return JSON with these fields (only if clearly mentioned):
{
  "medical_condition": "specific medical condition",
  "patient_age": "number if mentioned",
  "claim_amount": "number if mentioned",
  "treatment_type": "type of treatment",
  "emergency_treatment": "boolean if emergency mentioned",
  "pre_existing_disease": "boolean if pre-existing mentioned",
  "policy_start_date": "date if mentioned"
}

Return only valid JSON:`,
            requiredContext: ['userInput', 'planContext', 'sessionContext']
        });

        // Plan-specific analysis prompt
        this.promptTemplates.set('plan_analysis', {
            template: `You are an expert insurance analyst. Analyze this claim against the specific plan details.

PLAN DETAILS:
{fullPlanData}

CLAIM INFORMATION:
{claimData}

CONVERSATION CONTEXT:
{conversationContext}

ANALYSIS REQUIREMENTS:
1. Check plan-specific rules FIRST (sub_limits, special_features, etc.)
2. If plan has special coverage for this condition, use plan rules over generic rules
3. Consider plan-specific waiting periods and exclusions
4. Identify unique benefits this plan offers for this condition
5. Generate plan-specific recommendations

Return detailed JSON analysis:
{
  "planSpecificFindings": ["array of plan-specific observations"],
  "specialBenefits": ["array of special benefits for this condition"],
  "planOverrides": ["array of generic rules overridden by plan"],
  "recommendations": ["array of plan-specific recommendations"],
  "confidence": "number 0-100",
  "needsClarification": ["array of questions if any unclear aspects"]
}

Focus on plan-specific intelligence, not generic insurance rules.`,
            requiredContext: ['fullPlanData', 'claimData', 'conversationContext']
        });

        // Contextual response generation
        this.promptTemplates.set('contextual_response', {
            template: `You are a helpful insurance assistant having a conversation with a user about their claim.

CONVERSATION CONTEXT:
{conversationHistory}

SESSION STATE:
- Stage: {currentStage}
- Plan: {planName}
- Condition: {medicalCondition}
- Pending Clarifications: {pendingClarifications}

USER'S LATEST MESSAGE: "{userInput}"

RESPONSE GUIDELINES:
1. Be conversational and empathetic
2. Reference previous conversation context
3. Use plan-specific information when relevant
4. Provide clear, actionable responses
5. Ask follow-up questions if needed
6. Use emojis appropriately for clarity

Generate a helpful response that continues the conversation naturally.`,
            requiredContext: ['conversationHistory', 'currentStage', 'planName', 'medicalCondition', 'userInput']
        });

        // Intent classification prompt
        this.promptTemplates.set('intent_classification', {
            template: `Classify the user's intent from their message.

User Message: "{userInput}"
Conversation Context: {conversationContext}
Current Stage: {currentStage}

Possible Intents:
- plan_selection: User wants to select/find their plan
- claim_information: User providing claim details
- clarification_response: User answering a clarification question
- eligibility_question: User asking about eligibility
- process_question: User asking about claim process
- document_question: User asking about required documents
- appeal_question: User asking about appeals
- general_question: General insurance question
- new_assessment: User wants to start new assessment
- satisfaction_feedback: User providing feedback

Return JSON:
{
  "primary_intent": "most likely intent",
  "confidence": "number 0-100",
  "secondary_intents": ["array of other possible intents"],
  "suggested_actions": ["array of suggested next steps"]
}`,
            requiredContext: ['userInput', 'conversationContext', 'currentStage']
        });
    }

    /**
     * Initialize context strategies for different scenarios
     */
    initializeContextStrategies() {
        this.contextStrategies.set('cataract_analysis', {
            contextBuilder: (claimData, planData) => {
                const context = {
                    condition: 'cataract',
                    planHasSpecialCataractCoverage: planData.sub_limits?.['Cataract Limits'] === 'ACTUAL',
                    cataractCoverageDetails: planData.sub_limits?.['Cataract Limits'],
                    modernTreatmentAvailable: this.checkModernTreatmentCoverage(planData),
                    ageConsiderations: claimData.patient_age > 60 ? 'Senior citizen considerations' : 'Standard age group'
                };
                return context;
            }
        });

        this.contextStrategies.set('maternity_analysis', {
            contextBuilder: (claimData, planData) => {
                const maternityCover = planData.maternity_cover || {};
                return {
                    condition: 'maternity',
                    maternityCoverageAvailable: !!maternityCover['AVAILABLE CONDITION'],
                    firstDeliveryWaiting: maternityCover['WAITING PERIOD 1st DELIVERY'],
                    subsequentDeliveryWaiting: maternityCover['WAITING PERIOD 2nd DELIVERY'],
                    coverageAmounts: {
                        normal: maternityCover['Delivery charges (NORMAL)'],
                        caesarean: maternityCover['Delivery charges (Caesarean)']
                    },
                    newbornCoverage: maternityCover['NEW BORN BABY COVER']
                };
            }
        });
    }

    /**
     * Generate enhanced prompt with full context
     * @param {string} promptType - Type of prompt to generate
     * @param {Object} context - Context data for the prompt
     * @returns {string} Enhanced prompt string
     */
    async generateEnhancedPrompt(promptType, context) {
        try {
            const template = this.promptTemplates.get(promptType);
            if (!template) {
                throw new Error(`Unknown prompt type: ${promptType}`);
            }

            // Validate required context
            for (const required of template.requiredContext) {
                if (!context.hasOwnProperty(required)) {
                    throw new Error(`Missing required context: ${required}`);
                }
            }

            // Build enhanced context
            const enhancedContext = await this.buildEnhancedContext(promptType, context);

            // Replace placeholders in template
            let prompt = template.template;
            for (const [key, value] of Object.entries(enhancedContext)) {
                const placeholder = `{${key}}`;
                const replacement = typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value);
                prompt = prompt.replace(new RegExp(placeholder.replace(/[{}]/g, '\\$&'), 'g'), replacement);
            }

            console.log(`✅ Generated enhanced ${promptType} prompt`);
            return prompt;

        } catch (error) {
            console.error(`❌ Error generating prompt for ${promptType}:`, error);
            throw error;
        }
    }

    /**
     * Build enhanced context with additional intelligence
     */
    async buildEnhancedContext(promptType, baseContext) {
        const enhancedContext = { ...baseContext };

        // Add timestamp and session info
        enhancedContext.timestamp = new Date().toISOString();
        enhancedContext.promptType = promptType;

        // Add plan-specific intelligence if plan data is available
        if (baseContext.planData || baseContext.fullPlanData) {
            const planData = baseContext.planData || baseContext.fullPlanData;
            enhancedContext.planIntelligence = await this.extractPlanIntelligence(planData);
        }

        // Add condition-specific context
        if (baseContext.claimData?.medical_condition) {
            const conditionContext = this.buildConditionSpecificContext(
                baseContext.claimData.medical_condition,
                baseContext.planData || baseContext.fullPlanData
            );
            enhancedContext.conditionContext = conditionContext;
        }

        // Add conversation intelligence
        if (baseContext.conversationHistory) {
            enhancedContext.conversationIntelligence = this.analyzeConversationPattern(baseContext.conversationHistory);
        }

        // Format complex objects for better AI understanding
        this.formatContextForAI(enhancedContext);

        return enhancedContext;
    }

    /**
     * Extract intelligent insights from plan data
     */
    async extractPlanIntelligence(planData) {
        const intelligence = {
            planName: planData.plan_details?.['Plan Name'] || 'Unknown',
            company: planData.plan_details?.Company || 'Unknown',
            keyBenefits: [],
            specialFeatures: [],
            limitations: [],
            uniqueAspects: []
        };

        // Analyze basic coverages
        if (planData.basic_coverages) {
            Object.entries(planData.basic_coverages).forEach(([key, value]) => {
                if (value && value !== 'NO') {
                    intelligence.keyBenefits.push(`${key}: ${value}`);
                }
            });
        }

        // Analyze special features
        if (planData.special_features_others) {
            Object.entries(planData.special_features_others).forEach(([key, value]) => {
                if (value) {
                    intelligence.specialFeatures.push(value);
                }
            });
        }

        // Analyze sub-limits
        if (planData.sub_limits) {
            Object.entries(planData.sub_limits).forEach(([key, value]) => {
                if (value && value !== 'NO') {
                    if (key.includes('Co - Pay')) {
                        intelligence.limitations.push(`Co-pay requirement: ${value}`);
                    } else {
                        intelligence.limitations.push(`${key}: ${value}`);
                    }
                }
            });
        }

        // Identify unique aspects
        if (planData.sub_limits?.['Cataract Limits'] === 'ACTUAL') {
            intelligence.uniqueAspects.push('Unlimited cataract coverage at actual cost');
        }

        if (planData.maternity_cover?.['WAITING PERIOD 2nd DELIVERY'] === 'NO') {
            intelligence.uniqueAspects.push('No waiting period for subsequent deliveries');
        }

        return intelligence;
    }

    /**
     * Build condition-specific context
     */
    buildConditionSpecificContext(medicalCondition, planData) {
        const condition = medicalCondition.toLowerCase();
        const context = {
            condition: medicalCondition,
            category: this.categorizeCondition(condition),
            riskLevel: this.assessConditionRisk(condition),
            planSpecificBenefits: []
        };

        if (planData) {
            // Check for condition-specific benefits in plan
            context.planSpecificBenefits = this.findConditionSpecificBenefits(condition, planData);
        }

        return context;
    }

    /**
     * Analyze conversation patterns for better context
     */
    analyzeConversationPattern(conversationHistory) {
        const analysis = {
            totalMessages: conversationHistory.length,
            userQuestions: 0,
            clarificationCount: 0,
            topicChanges: 0,
            sentimentPattern: 'neutral',
            communicationStyle: 'standard'
        };

        conversationHistory.forEach(msg => {
            if (msg.role === 'user') {
                if (msg.content.includes('?')) analysis.userQuestions++;
                if (msg.content.length > 100) analysis.communicationStyle = 'detailed';
            }
            if (msg.role === 'assistant' && msg.content.includes('clarify')) {
                analysis.clarificationCount++;
            }
        });

        return analysis;
    }

    /**
     * Format context objects for better AI understanding
     */
    formatContextForAI(context) {
        // Convert complex objects to AI-friendly format
        Object.keys(context).forEach(key => {
            const value = context[key];
            if (Array.isArray(value) && value.length === 0) {
                context[key] = 'None specified';
            } else if (typeof value === 'object' && value !== null && Object.keys(value).length === 0) {
                context[key] = 'No data available';
            }
        });
    }

    /**
     * Generate context-aware AI response
     * @param {string} userInput - User's input
     * @param {Object} sessionContext - Current session context
     * @returns {Object} AI response with suggestions
     */
    async generateContextualResponse(userInput, sessionContext) {
        try {
            const prompt = await this.generateEnhancedPrompt('contextual_response', {
                userInput: userInput,
                conversationHistory: this.formatConversationHistory(sessionContext.conversationHistory),
                currentStage: sessionContext.stage,
                planName: sessionContext.planDetails?.data?.plan_details?.['Plan Name'] || 'Not selected',
                medicalCondition: sessionContext.claimData?.medical_condition || 'Not specified',
                pendingClarifications: sessionContext.pendingClarifications?.length || 0
            });

            const aiResponse = await this.groqAnalyzer.analyzeQuery(prompt);
            
            return {
                message: aiResponse,
                confidence: 85,
                contextUsed: true
            };

        } catch (error) {
            console.error('❌ Error generating contextual response:', error);
            return {
                message: "I understand you're asking about your claim. Let me help you with that. Could you please provide more details?",
                confidence: 50,
                contextUsed: false
            };
        }
    }

    /**
     * Classify user intent with context awareness
     */
    async classifyUserIntent(userInput, sessionContext) {
        try {
            const prompt = await this.generateEnhancedPrompt('intent_classification', {
                userInput: userInput,
                conversationContext: this.formatConversationHistory(sessionContext.conversationHistory, 3),
                currentStage: sessionContext.stage
            });

            const aiResponse = await this.groqAnalyzer.analyzeQuery(prompt);
            const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
            
            if (jsonMatch) {
                return JSON.parse(jsonMatch[0]);
            } else {
                throw new Error('No valid JSON response');
            }

        } catch (error) {
            console.error('❌ Error classifying intent:', error);
            return {
                primary_intent: 'general_question',
                confidence: 30,
                secondary_intents: [],
                suggested_actions: ['Ask for clarification']
            };
        }
    }

    /**
     * Utility methods
     */

    categorizeCondition(condition) {
        const categories = {
            surgical: ['cataract', 'hernia', 'surgery', 'appendicitis'],
            chronic: ['diabetes', 'hypertension', 'arthritis'],
            emergency: ['accident', 'heart attack', 'stroke'],
            maternity: ['delivery', 'pregnancy', 'maternity'],
            dental: ['dental', 'tooth', 'teeth']
        };

        for (const [category, keywords] of Object.entries(categories)) {
            if (keywords.some(keyword => condition.includes(keyword))) {
                return category;
            }
        }
        return 'general';
    }

    assessConditionRisk(condition) {
        const highRisk = ['heart', 'cancer', 'stroke', 'brain'];
        const mediumRisk = ['diabetes', 'hypertension', 'surgery'];
        const lowRisk = ['cataract', 'hernia', 'accident'];

        if (highRisk.some(risk => condition.includes(risk))) return 'high';
        if (mediumRisk.some(risk => condition.includes(risk))) return 'medium';
        if (lowRisk.some(risk => condition.includes(risk))) return 'low';
        return 'unknown';
    }

    findConditionSpecificBenefits(condition, planData) {
        const benefits = [];
        
        // Check sub-limits for condition-specific coverage
        if (planData.sub_limits) {
            Object.entries(planData.sub_limits).forEach(([key, value]) => {
                if (key.toLowerCase().includes(condition) && value !== 'NO') {
                    benefits.push(`${key}: ${value}`);
                }
            });
        }

        // Check special features
        if (planData.special_features_others) {
            Object.entries(planData.special_features_others).forEach(([key, feature]) => {
                if (feature.toLowerCase().includes(condition)) {
                    benefits.push(feature);
                }
            });
        }

        return benefits;
    }

    formatConversationHistory(history, lastN = 5) {
        if (!history || history.length === 0) return 'No previous conversation';
        
        const recentMessages = history.slice(-lastN);
        return recentMessages.map(msg => 
            `${msg.role.toUpperCase()}: ${msg.content.substring(0, 200)}${msg.content.length > 200 ? '...' : ''}`
        ).join('\n');
    }

    checkModernTreatmentCoverage(planData) {
        const specialFeatures = planData.special_features_others || {};
        return Object.values(specialFeatures).some(feature => 
            feature.toLowerCase().includes('modern treatment')
        );
    }
}

module.exports = { EnhancedAIPromptEngine };