/**
 * Plan Context Manager - Handles plan data loading and context extraction
 */
class PlanContextManager {
    constructor(planManager) {
        this.planManager = planManager;
        this.planCache = new Map();
    }

    /**
     * Load and cache complete plan data
     */
    async loadPlanData(planId) {
        if (!planId) {
            throw new Error('Plan ID is required');
        }

        // Check cache first
        if (this.planCache.has(planId)) {
            console.log('📋 Plan data loaded from cache:', planId);
            return this.planCache.get(planId);
        }

        try {
            const planData = await this.planManager.getPlan(planId);
            
            if (!planData) {
                throw new Error(`Plan not found: ${planId}`);
            }

            // Cache the plan data
            this.planCache.set(planId, planData);
            
            console.log('✅ Plan data loaded and cached:', planData.planName || planId);
            return planData;
            
        } catch (error) {
            console.error('❌ Failed to load plan data:', error);
            throw new Error(`Failed to load plan: ${error.message}`);
        }
    }

    /**
     * Extract comprehensive plan context
     */
    extractPlanContext(planData) {
        if (!planData) {
            return this.getDefaultContext();
        }

        const context = {
            // Basic info
            company: this.extractCompany(planData),
            planName: this.extractPlanName(planData),
            sumInsured: this.extractSumInsured(planData),
            
            // Plan details
            planDetails: this.extractPlanDetails(planData),
            
            // Coverage information
            basicCoverages: this.extractBasicCoverages(planData),
            
            // Waiting periods and exclusions
            waitingPeriods: this.extractWaitingPeriods(planData),
            
            // Sub-limits and restrictions
            subLimits: this.extractSubLimits(planData),
            
            // Benefits and features
            renewalBenefits: this.extractRenewalBenefits(planData),
            specialFeatures: this.extractSpecialFeatures(planData),
            
            // Maternity coverage
            maternityCover: this.extractMaternityCover(planData),
            
            // Raw data for AI processing
            rawPlanData: planData
        };

        return context;
    }

    /**
     * Extract company name
     */
    extractCompany(planData) {
        return planData.company || 
               planData.plan_details?.Company || 
               planData.plan_details?.company ||
               'Unknown Company';
    }

    /**
     * Extract plan name
     */
    extractPlanName(planData) {
        return planData.planName || 
               planData.plan_details?.['Plan Name'] || 
               planData.plan_details?.planName ||
               'Unknown Plan';
    }

    /**
     * Extract sum insured
     */
    extractSumInsured(planData) {
        return planData.sumInsuredRange || 
               planData.plan_details?.['Sum Insured Range'] || 
               planData.plan_details?.sumInsured ||
               planData.normalizedSumInsured ||
               'Unknown';
    }

    /**
     * Extract plan details
     */
    extractPlanDetails(planData) {
        return planData.plan_details || {};
    }

    /**
     * Extract basic coverages
     */
    extractBasicCoverages(planData) {
        return planData.basic_coverages || {};
    }

    /**
     * Extract waiting periods
     */
    extractWaitingPeriods(planData) {
        return planData.exclusions_waiting_periods || {};
    }

    /**
     * Extract sub-limits
     */
    extractSubLimits(planData) {
        return planData.sub_limits || {};
    }

    /**
     * Extract renewal benefits
     */
    extractRenewalBenefits(planData) {
        return planData.renewal_benefits || {};
    }

    /**
     * Extract special features
     */
    extractSpecialFeatures(planData) {
        const features = planData.special_features_others || {};
        // Filter out empty or "NO" values
        const filteredFeatures = {};
        
        Object.entries(features).forEach(([key, value]) => {
            if (value && value !== 'NO' && value !== 'N/A' && value.trim() !== '') {
                filteredFeatures[key] = value;
            }
        });
        
        return filteredFeatures;
    }

    /**
     * Extract maternity cover
     */
    extractMaternityCover(planData) {
        return planData.maternity_cover || {};
    }

    /**
     * Get default context for missing plan data
     */
    getDefaultContext() {
        return {
            company: 'Unknown Company',
            planName: 'Unknown Plan',
            sumInsured: 'Unknown',
            planDetails: {},
            basicCoverages: {},
            waitingPeriods: {},
            subLimits: {},
            renewalBenefits: {},
            specialFeatures: {},
            maternityCover: {},
            rawPlanData: null
        };
    }

    /**
     * Create comprehensive prompt context
     */
    createPromptContext(planContext, userMessage) {
        const context = {
            userQuestion: userMessage,
            planInfo: {
                company: planContext.company,
                planName: planContext.planName,
                sumInsured: planContext.sumInsured
            },
            completePlanData: planContext.rawPlanData
        };

        return context;
    }

    /**
     * Generate plan summary for quick reference
     */
    generatePlanSummary(planContext) {
        const summary = {
            basicInfo: `${planContext.company} - ${planContext.planName} (${planContext.sumInsured})`,
            keyFeatures: [],
            importantLimits: [],
            waitingPeriods: []
        };

        // Extract key features
        if (planContext.basicCoverages) {
            Object.entries(planContext.basicCoverages).forEach(([key, value]) => {
                if (value && value !== 'NO') {
                    summary.keyFeatures.push(`${key}: ${value}`);
                }
            });
        }

        // Extract important limits
        if (planContext.subLimits) {
            Object.entries(planContext.subLimits).forEach(([key, value]) => {
                if (value && value !== 'NO' && value !== 'ACTUAL') {
                    summary.importantLimits.push(`${key}: ${value}`);
                }
            });
        }

        // Extract waiting periods
        if (planContext.waitingPeriods) {
            Object.entries(planContext.waitingPeriods).forEach(([key, value]) => {
                if (value) {
                    summary.waitingPeriods.push(`${key}: ${value}`);
                }
            });
        }

        return summary;
    }

    /**
     * Validate plan data completeness
     */
    validatePlanData(planData) {
        const validation = {
            isValid: true,
            warnings: [],
            missingFields: []
        };

        // Check for essential fields
        const essentialFields = [
            'company',
            'planName',
            'plan_details',
            'basic_coverages'
        ];

        essentialFields.forEach(field => {
            if (!planData[field] && !planData.plan_details?.[field]) {
                validation.missingFields.push(field);
                validation.isValid = false;
            }
        });

        // Check for data quality issues
        if (planData.basic_coverages) {
            const coverageCount = Object.keys(planData.basic_coverages).length;
            if (coverageCount < 3) {
                validation.warnings.push('Limited coverage information available');
            }
        }

        return validation;
    }

    /**
     * Clear plan cache
     */
    clearCache() {
        this.planCache.clear();
        console.log('🗑️ Plan cache cleared');
    }

    /**
     * Get cache statistics
     */
    getCacheStats() {
        return {
            cachedPlans: this.planCache.size,
            cacheKeys: Array.from(this.planCache.keys())
        };
    }
}

module.exports = { PlanContextManager };
