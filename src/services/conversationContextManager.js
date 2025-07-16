/**
 * Conversation Context Manager - Manages session state and conversation flow
 * Provides robust context management for conversational claim assessment
 */
class ConversationContextManager {
    constructor() {
        this.sessions = new Map();
        this.sessionTimeout = 30 * 60 * 1000; // 30 minutes
        this.maxSessionHistory = 50; // Maximum conversation history per session
        this.cleanupInterval = 5 * 60 * 1000; // Cleanup every 5 minutes
        
        // Start cleanup timer
        this.startCleanupTimer();
    }

    /**
     * Get or create a conversation session
     * @param {string} sessionId - Unique session identifier
     * @param {Object} options - Initial session options
     * @returns {Object} Session object
     */
    getOrCreateSession(sessionId, options = {}) {
        let session = this.sessions.get(sessionId);
        
        if (!session) {
            session = this.createNewSession(sessionId, options);
            this.sessions.set(sessionId, session);
            console.log(`🆕 Created new conversation session: ${sessionId}`);
        } else {
            // Update last activity
            session.lastActivity = new Date().toISOString();
            console.log(`♻️ Retrieved existing session: ${sessionId}`);
        }

        return session;
    }

    /**
     * Create a new session with default structure
     */
    createNewSession(sessionId, options) {
        return {
            id: sessionId,
            stage: options.planFilePath ? 'initial_assessment' : 'plan_selection',
            createdAt: new Date().toISOString(),
            lastActivity: new Date().toISOString(),
            
            // Plan and claim data
            planFilePath: options.planFilePath || null,
            planDetails: null,
            claimData: {
                patient_name: options.patient_name || null,
                patient_age: options.patient_age || null,
                medical_condition: options.medical_condition || null,
                claim_amount: options.claim_amount || null,
                policy_start_date: options.policy_start_date || null,
                ...options.claimData
            },

            // Analysis data
            planAnalysis: null,
            eligibilityResult: null,
            pendingClarifications: [],

            // Conversation flow
            conversationHistory: [],
            userPreferences: {
                language: 'en',
                detailLevel: 'standard', // basic, standard, detailed
                communicationStyle: 'friendly' // formal, friendly, technical
            },

            // Session metadata
            totalInteractions: 0,
            completedStages: [],
            errorCount: 0,
            satisfactionScore: null
        };
    }

    /**
     * Add a message to conversation history
     * @param {Object} session - Session object
     * @param {string} role - 'user' or 'assistant'
     * @param {string} content - Message content
     * @param {Object} data - Additional data
     */
    addMessage(session, role, content, data = {}) {
        const message = {
            role: role,
            content: content,
            timestamp: new Date().toISOString(),
            data: data
        };

        session.conversationHistory.push(message);
        session.totalInteractions++;
        session.lastActivity = new Date().toISOString();

        // Trim history if too long
        if (session.conversationHistory.length > this.maxSessionHistory) {
            session.conversationHistory = session.conversationHistory.slice(-this.maxSessionHistory);
        }

        console.log(`💬 Added ${role} message to session ${session.id}`);
    }

    /**
     * Update session with new data
     * @param {string} sessionId - Session ID
     * @param {Object} session - Updated session object
     */
    updateSession(sessionId, session) {
        session.lastActivity = new Date().toISOString();
        this.sessions.set(sessionId, session);
        console.log(`🔄 Updated session: ${sessionId}`);
    }

    /**
     * Get session by ID
     * @param {string} sessionId - Session ID
     * @returns {Object|null} Session object or null
     */
    getSession(sessionId) {
        const session = this.sessions.get(sessionId);
        if (session) {
            session.lastActivity = new Date().toISOString();
        }
        return session;
    }

    /**
     * Update session stage
     * @param {string} sessionId - Session ID
     * @param {string} newStage - New stage
     */
    updateStage(sessionId, newStage) {
        const session = this.sessions.get(sessionId);
        if (session) {
            const oldStage = session.stage;
            session.stage = newStage;
            session.completedStages.push(oldStage);
            session.lastActivity = new Date().toISOString();
            
            console.log(`🎯 Session ${sessionId}: ${oldStage} → ${newStage}`);
        }
    }

    /**
     * Update claim data
     * @param {string} sessionId - Session ID
     * @param {Object} newData - New claim data
     */
    updateClaimData(sessionId, newData) {
        const session = this.sessions.get(sessionId);
        if (session) {
            Object.assign(session.claimData, newData);
            session.lastActivity = new Date().toISOString();
            console.log(`📝 Updated claim data for session ${sessionId}`, Object.keys(newData));
        }
    }

    /**
     * Get conversation summary for AI context
     * @param {string} sessionId - Session ID
     * @param {number} lastN - Number of recent messages to include
     * @returns {string} Formatted conversation summary
     */
    getConversationSummary(sessionId, lastN = 5) {
        const session = this.sessions.get(sessionId);
        if (!session) return '';

        const recentMessages = session.conversationHistory.slice(-lastN);
        return recentMessages.map(msg => `${msg.role}: ${msg.content}`).join('\n');
    }

    /**
     * Get session context for AI prompts
     * @param {string} sessionId - Session ID
     * @returns {Object} Context object for AI prompts
     */
    getSessionContext(sessionId) {
        const session = this.sessions.get(sessionId);
        if (!session) return {};

        return {
            sessionInfo: {
                id: session.id,
                stage: session.stage,
                interactions: session.totalInteractions,
                duration: this.getSessionDuration(session)
            },
            planContext: {
                hasPlan: !!session.planFilePath,
                planName: session.planDetails?.data?.plan_details?.['Plan Name'] || 'Unknown',
                company: session.planDetails?.data?.plan_details?.Company || 'Unknown'
            },
            claimContext: {
                condition: session.claimData.medical_condition,
                patientAge: session.claimData.patient_age,
                claimAmount: session.claimData.claim_amount,
                hasPreExisting: session.claimData.pre_existing_disease
            },
            conversationSummary: this.getConversationSummary(sessionId, 3),
            pendingClarifications: session.pendingClarifications.length
        };
    }

    /**
     * Track user satisfaction
     * @param {string} sessionId - Session ID
     * @param {number} score - Satisfaction score (1-5)
     * @param {string} feedback - Optional feedback
     */
    recordSatisfaction(sessionId, score, feedback = '') {
        const session = this.sessions.get(sessionId);
        if (session) {
            session.satisfactionScore = score;
            session.userFeedback = feedback;
            session.lastActivity = new Date().toISOString();
            console.log(`⭐ Session ${sessionId} satisfaction: ${score}/5`);
        }
    }

    /**
     * Track errors in session
     * @param {string} sessionId - Session ID
     * @param {string} errorType - Type of error
     * @param {string} errorMessage - Error message
     */
    recordError(sessionId, errorType, errorMessage) {
        const session = this.sessions.get(sessionId);
        if (session) {
            session.errorCount++;
            session.lastError = {
                type: errorType,
                message: errorMessage,
                timestamp: new Date().toISOString()
            };
            console.log(`❌ Session ${sessionId} error: ${errorType} - ${errorMessage}`);
        }
    }

    /**
     * Clear/delete a session
     * @param {string} sessionId - Session ID
     */
    clearSession(sessionId) {
        const deleted = this.sessions.delete(sessionId);
        if (deleted) {
            console.log(`🗑️ Cleared session: ${sessionId}`);
        }
        return deleted;
    }

    /**
     * Get all active sessions (for admin/monitoring)
     * @returns {Array} Array of session summaries
     */
    getActiveSessions() {
        const sessions = [];
        this.sessions.forEach((session, sessionId) => {
            sessions.push({
                id: sessionId,
                stage: session.stage,
                createdAt: session.createdAt,
                lastActivity: session.lastActivity,
                totalInteractions: session.totalInteractions,
                hasEligibilityResult: !!session.eligibilityResult,
                planName: session.planDetails?.data?.plan_details?.['Plan Name'] || 'No plan selected',
                condition: session.claimData.medical_condition || 'Not specified'
            });
        });
        return sessions.sort((a, b) => new Date(b.lastActivity) - new Date(a.lastActivity));
    }

    /**
     * Get session statistics
     * @returns {Object} Session statistics
     */
    getSessionStats() {
        const sessions = Array.from(this.sessions.values());
        const now = new Date();

        return {
            totalActiveSessions: sessions.length,
            recentSessions: sessions.filter(s => 
                (now - new Date(s.lastActivity)) < (60 * 60 * 1000) // Last hour
            ).length,
            completedAssessments: sessions.filter(s => 
                s.eligibilityResult && s.stage === 'follow_up'
            ).length,
            averageInteractions: sessions.reduce((sum, s) => sum + s.totalInteractions, 0) / sessions.length || 0,
            errorRate: sessions.reduce((sum, s) => sum + s.errorCount, 0) / sessions.length || 0,
            stageDistribution: this.getStageDistribution(sessions),
            satisfactionScores: sessions.filter(s => s.satisfactionScore).map(s => s.satisfactionScore)
        };
    }

    /**
     * Export session data for analysis
     * @param {string} sessionId - Session ID (optional, if not provided exports all)
     * @returns {Object} Exportable session data
     */
    exportSessionData(sessionId = null) {
        if (sessionId) {
            const session = this.sessions.get(sessionId);
            return session ? this.sanitizeSessionForExport(session) : null;
        }

        const allSessions = {};
        this.sessions.forEach((session, id) => {
            allSessions[id] = this.sanitizeSessionForExport(session);
        });
        
        return {
            exportDate: new Date().toISOString(),
            totalSessions: this.sessions.size,
            sessions: allSessions,
            statistics: this.getSessionStats()
        };
    }

    /**
     * Private helper methods
     */
    
    /**
     * Get session duration in minutes
     */
    getSessionDuration(session) {
        const start = new Date(session.createdAt);
        const end = new Date(session.lastActivity);
        return Math.round((end - start) / (1000 * 60));
    }

    /**
     * Get distribution of sessions by stage
     */
    getStageDistribution(sessions) {
        const distribution = {};
        sessions.forEach(session => {
            distribution[session.stage] = (distribution[session.stage] || 0) + 1;
        });
        return distribution;
    }

    /**
     * Sanitize session data for export (remove sensitive info)
     */
    sanitizeSessionForExport(session) {
        const sanitized = { ...session };
        
        // Remove or hash sensitive information
        if (sanitized.claimData.patient_name) {
            sanitized.claimData.patient_name = '***REDACTED***';
        }
        
        // Remove detailed conversation history, keep only summary
        sanitized.conversationSummary = this.getConversationSummary(session.id, 3);
        delete sanitized.conversationHistory;
        
        return sanitized;
    }

    /**
     * Cleanup expired sessions
     */
    startCleanupTimer() {
        setInterval(() => {
            this.cleanupExpiredSessions();
        }, this.cleanupInterval);
    }

    /**
     * Remove expired sessions
     */
    cleanupExpiredSessions() {
        const now = new Date();
        let cleanedCount = 0;

        this.sessions.forEach((session, sessionId) => {
            const lastActivity = new Date(session.lastActivity);
            const timeSinceActivity = now - lastActivity;

            if (timeSinceActivity > this.sessionTimeout) {
                this.sessions.delete(sessionId);
                cleanedCount++;
            }
        });

        if (cleanedCount > 0) {
            console.log(`🧹 Cleaned up ${cleanedCount} expired sessions`);
        }
    }

    /**
     * Graceful shutdown - save important session data
     */
    shutdown() {
        console.log('🔄 Context Manager shutting down...');
        
        // Could implement session persistence here
        const stats = this.getSessionStats();
        console.log('📊 Final session statistics:', stats);
        
        // Clear all sessions
        this.sessions.clear();
        console.log('✅ Context Manager shutdown complete');
    }
}

module.exports = { ConversationContextManager };