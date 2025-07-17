/**
 * Chat Orchestrator - Main controller for chat interface
 * Handles plan loading, context management, and response formatting
 */
class ChatOrchestrator {
    constructor(groqAnalyzer, planManager) {
        this.groqAnalyzer = groqAnalyzer;
        this.planManager = planManager;
        this.sessions = new Map();
    }

    /**
     * Process chat message with complete plan context
     */
    async processMessage(sessionId, message, planId) {
        try {
            console.log('🎯 Processing chat message for session:', sessionId);
            
            // Get or create session
            const session = this.getOrCreateSession(sessionId, planId);
            
            // Load complete plan data
            const planData = await this.loadCompletePlanData(planId);
            
            // Update session with plan data
            session.planData = planData;
            session.planId = planId;
            
            // Add user message to history
            this.addMessageToHistory(session, 'user', message);
            
            // Generate AI response with complete context
            const response = await this.generateResponse(session, message);
            
            // Add AI response to history
            this.addMessageToHistory(session, 'assistant', response);
            
            // Update session
            this.sessions.set(sessionId, session);
            
            return {
                success: true,
                response: response,
                sessionId: sessionId,
                planContext: session.planContext,
                timestamp: new Date().toISOString()
            };
            
        } catch (error) {
            console.error('❌ Chat orchestrator error:', error);
            return {
                success: false,
                error: error.message,
                response: this.getErrorResponse(error.message)
            };
        }
    }

    /**
     * Get or create session
     */
    getOrCreateSession(sessionId, planId) {
        let session = this.sessions.get(sessionId);
        
        if (!session) {
            session = {
                id: sessionId,
                history: [],
                planId: planId,
                planData: null,
                planContext: null,
                createdAt: new Date().toISOString(),
                lastActivity: new Date().toISOString()
            };
        }
        
        session.lastActivity = new Date().toISOString();
        return session;
    }

    /**
     * Load complete plan data with error handling
     */
    async loadCompletePlanData(planId) {
        if (!planId) {
            throw new Error('Plan ID is required');
        }

        try {
            const planData = await this.planManager.getPlan(planId);
            
            if (!planData) {
                throw new Error(`Plan not found: ${planId}`);
            }

            console.log('✅ Complete plan data loaded:', planData.planName || 'Unknown Plan');
            return planData;
            
        } catch (error) {
            console.error('❌ Failed to load plan data:', error);
            throw new Error(`Failed to load plan: ${error.message}`);
        }
    }

    /**
     * Generate AI response with complete plan context
     */
    async generateResponse(session, message) {
        const prompt = this.buildComprehensivePrompt(session, message);
        
        try {
            const response = await this.groqAnalyzer.analyzeQuery(prompt, {
                temperature: 0.3,
                maxTokens: 4096
            });
            
            return this.formatResponse(response, session);
            
        } catch (error) {
            console.error('❌ AI response generation failed:', error);
            throw new Error(`AI response failed: ${error.message}`);
        }
    }

    /**
     * Build comprehensive prompt with complete plan data
     */
    buildComprehensivePrompt(session, message) {
        const planData = session.planData;
        const planContext = this.extractPlanContext(planData);
        
        // Update session plan context
        session.planContext = planContext;

        const prompt = `You are an expert insurance assistant providing detailed information about health insurance plans.

USER QUESTION: "${message}"

SELECTED PLAN: ${planContext.company} - ${planContext.planName} (${planContext.sumInsured})

COMPLETE PLAN DATA (USE THIS FOR ACCURATE RESPONSES):
${JSON.stringify(planData, null, 2)}

CONVERSATION HISTORY:
${this.formatConversationHistory(session.history)}

RESPONSE REQUIREMENTS:
1. Answer the user's specific question accurately using ONLY the plan data provided
2. Format your response in HTML with proper table structure when displaying plan details
3. Use structured tables for coverage details, benefits, limits, waiting periods, etc.
4. Be comprehensive but focused on the user's question
5. Include specific amounts, percentages, and conditions from the plan data
6. If the user asks a general question, provide relevant information in a well-structured format
7. Always use HTML table format for displaying multiple data points

RESPONSE FORMAT:
- Use <table class="plan-table"> for data tables
- Use <div class="section-title"> for section headers
- Use <strong class="amount"> for monetary values
- Use <strong class="important"> for important notes
- Structure your response clearly with appropriate HTML formatting

Provide a comprehensive, accurate response based on the complete plan data provided above.`;

        return prompt;
    }

    /**
     * Extract plan context from plan data
     */
    extractPlanContext(planData) {
        if (!planData) {
            return {
                company: 'Unknown',
                planName: 'Unknown Plan',
                sumInsured: 'Unknown'
            };
        }

        return {
            company: planData.company || planData.plan_details?.Company || 'Unknown',
            planName: planData.planName || planData.plan_details?.['Plan Name'] || 'Unknown Plan',
            sumInsured: planData.sumInsuredRange || planData.plan_details?.['Sum Insured Range'] || 'Unknown'
        };
    }

    /**
     * Format conversation history
     */
    formatConversationHistory(history) {
        if (!history || history.length === 0) {
            return 'No previous conversation';
        }

        return history.slice(-4).map(msg => 
            `${msg.role.toUpperCase()}: ${msg.content}`
        ).join('\n');
    }

    /**
     * Format response with enhanced styling
     */
    formatResponse(response, session) {
        const planContext = session.planContext;
        
        // Clean response
        const cleanResponse = typeof response === 'string' ? response.trim() : String(response);
        
        // If already formatted HTML, return as is
        if (cleanResponse.includes('<table') || cleanResponse.includes('<div class="structured-response">')) {
            return cleanResponse;
        }

        // Create structured response
        return `<div class="structured-response">
            <div class="response-header">
                🏥 <strong>${planContext.company} - ${planContext.planName} (${planContext.sumInsured})</strong>
            </div>
            <div class="response-section">
                ${this.enhanceResponseFormatting(cleanResponse)}
            </div>
            <div class="response-footer">
                💡 <em>Information based on your selected plan. For claims assistance, contact customer service.</em>
            </div>
        </div>`;
    }

    /**
     * Enhance response formatting
     */
    enhanceResponseFormatting(content) {
        // Convert markdown tables to HTML if present
        content = this.convertMarkdownTablesToHTML(content);
        
        // Format line breaks
        content = content.replace(/\n\n+/g, '</p><p>');
        content = content.replace(/\n/g, '<br>');
        
        // Format monetary values
        content = content.replace(/(\₹[\d,]+|Rs\.?\s*[\d,]+|\d+%)/g, '<strong class="amount">$1</strong>');
        
        // Format important notes
        content = content.replace(/(IMPORTANT|NOTE|WARNING|EXCLUSION):/gi, '<strong class="important">$1:</strong>');
        
        // Format headers
        content = content.replace(/^([A-Z\s&\-]+):\s*$/gm, '<div class="section-title">$1</div>');
        
        // Wrap in paragraphs if needed
        if (!content.includes('<p>') && !content.includes('<div>') && !content.includes('<table>')) {
            content = `<p>${content}</p>`;
        }
        
        return content;
    }

    /**
     * Convert markdown tables to HTML
     */
    convertMarkdownTablesToHTML(content) {
        const tableRegex = /(\|[^|\n]+\|[^|\n]*\n)(\|[-\s|:]+\|[^|\n]*\n)((?:\|[^|\n]+\|[^|\n]*\n?)+)/g;
        
        return content.replace(tableRegex, (match, header, separator, rows) => {
            const headerCells = header.split('|').slice(1, -1).map(cell => cell.trim());
            const rowsArray = rows.trim().split('\n').map(row => 
                row.split('|').slice(1, -1).map(cell => cell.trim())
            );
            
            let html = '<table class="plan-table">';
            html += '<thead><tr>';
            headerCells.forEach(cell => {
                html += `<th>${cell}</th>`;
            });
            html += '</tr></thead><tbody>';
            
            rowsArray.forEach(row => {
                html += '<tr>';
                row.forEach(cell => {
                    html += `<td>${cell}</td>`;
                });
                html += '</tr>';
            });
            
            html += '</tbody></table>';
            return html;
        });
    }

    /**
     * Add message to conversation history
     */
    addMessageToHistory(session, role, content) {
        session.history.push({
            role: role,
            content: content,
            timestamp: new Date().toISOString()
        });

        // Keep only last 10 messages to manage memory
        if (session.history.length > 10) {
            session.history = session.history.slice(-10);
        }
    }

    /**
     * Get error response
     */
    getErrorResponse(errorMessage) {
        return `<div class="structured-response">
            <div class="response-header">
                ⚠️ <strong>Error</strong>
            </div>
            <div class="response-section">
                <p>I encountered an error while processing your request:</p>
                <p style="color: #e53e3e; font-family: monospace;">${errorMessage}</p>
                <p>Please try:</p>
                <ul class="feature-list">
                    <li>Ensure a plan is selected</li>
                    <li>Check your internet connection</li>
                    <li>Try rephrasing your question</li>
                    <li>Refresh the page if issues persist</li>
                </ul>
            </div>
        </div>`;
    }

    /**
     * Get session information
     */
    getSession(sessionId) {
        return this.sessions.get(sessionId);
    }

    /**
     * Clear session
     */
    clearSession(sessionId) {
        this.sessions.delete(sessionId);
    }

    /**
     * Get session statistics
     */
    getSessionStats() {
        return {
            activeSessions: this.sessions.size,
            totalSessions: this.sessions.size
        };
    }
}

module.exports = { ChatOrchestrator };
