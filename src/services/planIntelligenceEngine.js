const fs = require('fs');
const path = require('path');

/**
 * Plan Intelligence Engine - Analyzes plan-specific rules and features
 * Handles plan-specific inclusions, exclusions, and special coverages
 */
class PlanIntelligenceEngine {
    constructor() {
        this.planSpecificRules = new Map();
        this.conditionAnalyzers = new Map();
        this.initializeConditionAnalyzers();
    }

    /**
     * Initialize condition-specific analyzers
     */
    initializeConditionAnalyzers() {
        this.conditionAnalyzers.set('cataract', new CataractAnalyzer());
        this.conditionAnalyzers.set('maternity', new MaternityAnalyzer());
        this.conditionAnalyzers.set('heart', new HeartConditionAnalyzer());
        this.conditionAnalyzers.set('diabetes', new DiabetesAnalyzer());
        this.conditionAnalyzers.set('accident', new AccidentAnalyzer());
        this.conditionAnalyzers.set('cancer', new CancerAnalyzer());
    }

    /**
     * Analyze a medical condition against specific plan features
     * @param {string} medicalCondition - The medical condition to analyze
     * @param {Object} planData - Complete plan JSON data
     * @returns {Object} Plan-specific analysis with special features, waiting periods, etc.
     */
    async analyzeConditionForPlan(medicalCondition, planData) {
        try {
            console.log(`🧠 Analyzing ${medicalCondition} for plan: ${planData.plan_details?.['Plan Name']}`);

            const analysis = {
                condition: medicalCondition,
                planName: planData.plan_details?.['Plan Name'],
                company: planData.plan_details?.Company,
                specialFeatures: [],
                planSpecificRules: {},
                waitingPeriods: {},
                coverageLimits: {},
                exclusions: [],
                recommendations: [],
                confidence: 100
            };

            // Get condition-specific analyzer
            const conditionKey = this.identifyConditionType(medicalCondition);
            const analyzer = this.conditionAnalyzers.get(conditionKey);

            if (analyzer) {
                const conditionAnalysis = await analyzer.analyze(medicalCondition, planData);
                Object.assign(analysis, conditionAnalysis);
            }

            // Analyze general plan features
            this.analyzeGeneralPlanFeatures(analysis, planData);

            // Check for plan-specific benefits
            this.checkPlanSpecificBenefits(analysis, planData, medicalCondition);

            // Analyze sub-limits and co-pay
            this.analyzeSubLimitsAndCopay(analysis, planData);

            console.log(`✅ Plan intelligence analysis complete for ${medicalCondition}`);
            return analysis;

        } catch (error) {
            console.error('❌ Plan intelligence analysis failed:', error);
            return {
                condition: medicalCondition,
                error: error.message,
                confidence: 0
            };
        }
    }

    /**
     * Identify the type of medical condition for specific analysis
     */
    identifyConditionType(medicalCondition) {
        const condition = medicalCondition.toLowerCase();
        
        if (condition.includes('cataract')) return 'cataract';
        if (condition.includes('maternity') || condition.includes('delivery') || condition.includes('pregnancy')) return 'maternity';
        if (condition.includes('heart') || condition.includes('cardiac')) return 'heart';
        if (condition.includes('diabetes') || condition.includes('diabetic')) return 'diabetes';
        if (condition.includes('accident') || condition.includes('injury')) return 'accident';
        if (condition.includes('cancer') || condition.includes('tumor')) return 'cancer';
        
        return 'general';
    }

    /**
     * Analyze general plan features that apply to all conditions
     */
    analyzeGeneralPlanFeatures(analysis, planData) {
        const basicCoverages = planData.basic_coverages || {};
        const subLimits = planData.sub_limits || {};

        // Pre and post hospitalization
        if (basicCoverages['Pre-Hospitalization']) {
            analysis.specialFeatures.push(`Pre-hospitalization coverage: ${basicCoverages['Pre-Hospitalization']}`);
        }
        
        if (basicCoverages['Post-Hospitalization']) {
            analysis.specialFeatures.push(`Post-hospitalization coverage: ${basicCoverages['Post-Hospitalization']}`);
        }

        // Emergency ambulance
        if (basicCoverages['Emergency Ambulance']) {
            analysis.specialFeatures.push(`Emergency ambulance: ${basicCoverages['Emergency Ambulance']}`);
        }

        // AYUSH treatment
        if (basicCoverages['Non-Allopathic Treatment (AYUSH)']) {
            analysis.specialFeatures.push(`AYUSH treatment covered: ${basicCoverages['Non-Allopathic Treatment (AYUSH)']}`);
        }

        // Room rent limits
        if (subLimits['Room Rent/day']) {
            analysis.coverageLimits.roomRent = subLimits['Room Rent/day'];
        }
    }

    /**
     * Check for plan-specific benefits and special features
     */
    checkPlanSpecificBenefits(analysis, planData, medicalCondition) {
        const specialFeatures = planData.special_features_others || {};
        
        // Check each special feature for relevance to the condition
        Object.entries(specialFeatures).forEach(([key, feature]) => {
            if (this.isFeatureRelevant(feature, medicalCondition)) {
                analysis.specialFeatures.push(feature);
            }
        });

        // Check maternity benefits
        if (planData.maternity_cover && medicalCondition.toLowerCase().includes('maternity')) {
            const maternityCover = planData.maternity_cover;
            Object.entries(maternityCover).forEach(([key, value]) => {
                if (value && value !== 'NO') {
                    analysis.specialFeatures.push(`${key}: ${value}`);
                }
            });
        }
    }

    /**
     * Check if a special feature is relevant to the medical condition
     */
    isFeatureRelevant(feature, medicalCondition) {
        const condition = medicalCondition.toLowerCase();
        const featureText = feature.toLowerCase();

        // Condition-specific feature matching
        const relevanceMap = {
            'cataract': ['eye', 'vision', 'modern treatment'],
            'heart': ['cardiac', 'heart', 'air ambulance', 'modern treatment'],
            'cancer': ['cancer', 'oncology', 'modern treatment', 'air ambulance'],
            'maternity': ['maternity', 'delivery', 'pregnancy'],
            'chronic': ['chronic', 'pain management', 'rehabilitation'],
            'accident': ['air ambulance', 'emergency', 'rehabilitation']
        };

        for (const [condType, keywords] of Object.entries(relevanceMap)) {
            if (condition.includes(condType)) {
                return keywords.some(keyword => featureText.includes(keyword));
            }
        }

        // General features that apply to most conditions
        const generalFeatures = ['modern treatment', 'second medical opinion', 'home care'];
        return generalFeatures.some(keyword => featureText.includes(keyword));
    }

    /**
     * Analyze sub-limits and co-pay specific to the condition
     */
    analyzeSubLimitsAndCopay(analysis, planData) {
        const subLimits = planData.sub_limits || {};

        // Co-pay analysis
        if (subLimits['Co - Pay']) {
            analysis.planSpecificRules.copay = subLimits['Co - Pay'];
            
            // Extract percentage if available
            const copayMatch = subLimits['Co - Pay'].match(/(\d+)%/);
            if (copayMatch) {
                analysis.coverageLimits.copayPercentage = parseInt(copayMatch[1]);
            }
        }

        // ICU limits
        if (subLimits['ICU/day']) {
            analysis.coverageLimits.icuPerDay = subLimits['ICU/day'];
        }

        // Condition-specific limits
        Object.entries(subLimits).forEach(([key, value]) => {
            if (key.toLowerCase().includes(analysis.condition.toLowerCase())) {
                analysis.coverageLimits[key] = value;
            }
        });
    }
}

/**
 * Cataract-specific analyzer
 */
class CataractAnalyzer {
    async analyze(condition, planData) {
        const analysis = {
            specialFeatures: [],
            planSpecificRules: {},
            waitingPeriods: {},
            recommendations: []
        };

        const subLimits = planData.sub_limits || {};
        
        // Check for cataract-specific coverage
        if (subLimits['Cataract Limits']) {
            const cataractLimit = subLimits['Cataract Limits'];
            
            if (cataractLimit === 'ACTUAL') {
                analysis.specialFeatures.push('🎯 Excellent! Your plan covers cataract treatment at ACTUAL cost (no sub-limits)');
                analysis.planSpecificRules.cataractCoverage = 'UNLIMITED';
                analysis.recommendations.push('No cost restrictions for cataract surgery - choose the best treatment options');
            } else {
                analysis.planSpecificRules.cataractCoverage = cataractLimit;
                analysis.specialFeatures.push(`Cataract coverage limit: ${cataractLimit}`);
            }
        }

        // Check waiting periods for cataract
        const waitingPeriods = planData.exclusions_waiting_periods || {};
        if (waitingPeriods['SPECIFIC DISEASE']) {
            const waitingText = waitingPeriods['SPECIFIC DISEASE'];
            if (waitingText.includes('2 YEARS') || waitingText.includes('2YRS')) {
                analysis.waitingPeriods.specificDisease = '2 years';
                analysis.recommendations.push('Cataract surgery typically requires 2-year waiting period unless emergency');
            }
        }

        // Check for related benefits
        const specialFeatures = planData.special_features_others || {};
        Object.entries(specialFeatures).forEach(([key, feature]) => {
            if (feature.toLowerCase().includes('modern treatment')) {
                analysis.specialFeatures.push('Modern treatment methods covered for cataract surgery');
            }
        });

        return analysis;
    }
}

/**
 * Maternity-specific analyzer
 */
class MaternityAnalyzer {
    async analyze(condition, planData) {
        const analysis = {
            specialFeatures: [],
            planSpecificRules: {},
            waitingPeriods: {},
            recommendations: []
        };

        const maternityCover = planData.maternity_cover || {};

        // Analyze maternity coverage availability
        if (maternityCover['AVAILABLE CONDITION']) {
            analysis.planSpecificRules.availability = maternityCover['AVAILABLE CONDITION'];
            analysis.specialFeatures.push(`Maternity coverage: ${maternityCover['AVAILABLE CONDITION']}`);
        }

        // Waiting periods
        if (maternityCover['WAITING PERIOD 1st DELIVERY']) {
            const waitingPeriod = maternityCover['WAITING PERIOD 1st DELIVERY'];
            analysis.waitingPeriods.firstDelivery = waitingPeriod;
            analysis.specialFeatures.push(`First delivery waiting period: ${waitingPeriod}`);
        }

        if (maternityCover['WAITING PERIOD 2nd DELIVERY']) {
            const secondDeliveryWaiting = maternityCover['WAITING PERIOD 2nd DELIVERY'];
            if (secondDeliveryWaiting === 'NO') {
                analysis.specialFeatures.push('🎯 No waiting period for second delivery!');
            } else {
                analysis.waitingPeriods.subsequentDelivery = secondDeliveryWaiting;
            }
        }

        // Coverage amounts
        if (maternityCover['Delivery charges (NORMAL)']) {
            analysis.specialFeatures.push(`Normal delivery: ${maternityCover['Delivery charges (NORMAL)']}`);
        }

        if (maternityCover['Delivery charges (Caesarean)']) {
            analysis.specialFeatures.push(`Caesarean delivery: ${maternityCover['Delivery charges (Caesarean)']}`);
        }

        // Newborn coverage
        if (maternityCover['NEW BORN BABY COVER']) {
            analysis.specialFeatures.push(`Newborn baby cover: ${maternityCover['NEW BORN BABY COVER']}`);
        }

        // Infertility treatment
        if (maternityCover['INFERTILITY / ASSTREPRODUCTION'] && maternityCover['INFERTILITY / ASSTREPRODUCTION'] !== 'NO') {
            analysis.specialFeatures.push(`Infertility treatment: ${maternityCover['INFERTILITY / ASSTREPRODUCTION']}`);
        }

        return analysis;
    }
}

/**
 * Heart condition analyzer
 */
class HeartConditionAnalyzer {
    async analyze(condition, planData) {
        const analysis = {
            specialFeatures: [],
            planSpecificRules: {},
            waitingPeriods: {},
            recommendations: []
        };

        // Check for cardiac-specific features
        const specialFeatures = planData.special_features_others || {};
        Object.entries(specialFeatures).forEach(([key, feature]) => {
            if (feature.toLowerCase().includes('air ambulance')) {
                analysis.specialFeatures.push(`🚁 Air ambulance coverage: ${feature}`);
                analysis.recommendations.push('Air ambulance available for cardiac emergencies');
            }
            if (feature.toLowerCase().includes('modern treatment')) {
                analysis.specialFeatures.push('Modern cardiac treatment methods covered');
            }
        });

        // Waiting periods
        const waitingPeriods = planData.exclusions_waiting_periods || {};
        if (waitingPeriods['SPECIFIC DISEASE']) {
            analysis.waitingPeriods.specificDisease = waitingPeriods['SPECIFIC DISEASE'];
            analysis.recommendations.push('Heart conditions typically require specific disease waiting period completion');
        }

        return analysis;
    }
}

/**
 * Diabetes analyzer
 */
class DiabetesAnalyzer {
    async analyze(condition, planData) {
        const analysis = {
            specialFeatures: [],
            planSpecificRules: {},
            waitingPeriods: {},
            recommendations: []
        };

        // Check for chronic disease management
        const specialFeatures = planData.special_features_others || {};
        Object.entries(specialFeatures).forEach(([key, feature]) => {
            if (feature.toLowerCase().includes('chronic') || feature.toLowerCase().includes('home care')) {
                analysis.specialFeatures.push(`Chronic disease support: ${feature}`);
            }
        });

        // Diabetes is typically a pre-existing condition concern
        const waitingPeriods = planData.exclusions_waiting_periods || {};
        if (waitingPeriods['Pre Existing Disease']) {
            analysis.waitingPeriods.preExistingDisease = waitingPeriods['Pre Existing Disease'];
            analysis.recommendations.push('Diabetes is often considered pre-existing - ensure proper disclosure and waiting period completion');
        }

        return analysis;
    }
}

/**
 * Accident analyzer
 */
class AccidentAnalyzer {
    async analyze(condition, planData) {
        const analysis = {
            specialFeatures: [],
            planSpecificRules: {},
            waitingPeriods: {},
            recommendations: []
        };

        // Accidents typically have no waiting period
        analysis.specialFeatures.push('🚨 Accident coverage typically has NO waiting period');
        analysis.planSpecificRules.waitingPeriod = 'NONE';

        // Check for accident-specific benefits
        const basicCoverages = planData.basic_coverages || {};
        if (basicCoverages['Emergency Ambulance']) {
            analysis.specialFeatures.push(`Emergency ambulance: ${basicCoverages['Emergency Ambulance']}`);
        }

        const specialFeatures = planData.special_features_others || {};
        Object.entries(specialFeatures).forEach(([key, feature]) => {
            if (feature.toLowerCase().includes('air ambulance')) {
                analysis.specialFeatures.push(`🚁 Air ambulance for severe accidents: ${feature}`);
            }
            if (feature.toLowerCase().includes('rehabilitation')) {
                analysis.specialFeatures.push(`Rehabilitation support: ${feature}`);
            }
        });

        analysis.recommendations.push('Ensure proper documentation for accident claims (police report for road accidents)');

        return analysis;
    }
}

/**
 * Cancer analyzer
 */
class CancerAnalyzer {
    async analyze(condition, planData) {
        const analysis = {
            specialFeatures: [],
            planSpecificRules: {},
            waitingPeriods: {},
            recommendations: []
        };

        // Check for cancer-specific features
        const specialFeatures = planData.special_features_others || {};
        Object.entries(specialFeatures).forEach(([key, feature]) => {
            if (feature.toLowerCase().includes('modern treatment')) {
                analysis.specialFeatures.push('🎯 Modern cancer treatment methods covered');
                analysis.recommendations.push('Access to latest cancer treatment technologies');
            }
            if (feature.toLowerCase().includes('air ambulance')) {
                analysis.specialFeatures.push(`Air ambulance for cancer emergencies: ${feature}`);
            }
            if (feature.toLowerCase().includes('second medical opinion')) {
                analysis.specialFeatures.push('Second medical opinion available for cancer treatment');
                analysis.recommendations.push('Consider getting second opinion for cancer treatment plans');
            }
        });

        // Cancer waiting periods
        const waitingPeriods = planData.exclusions_waiting_periods || {};
        if (waitingPeriods['SPECIFIC DISEASE']) {
            analysis.waitingPeriods.specificDisease = waitingPeriods['SPECIFIC DISEASE'];
            analysis.recommendations.push('Cancer treatment requires specific disease waiting period completion unless emergency');
        }

        return analysis;
    }
}

module.exports = { PlanIntelligenceEngine };