const { PlanManager } = require('./planManager.js');
const fs = require('fs');
const path = require('path');

class ClaimEligibilityEngine {
    constructor() {
        this.planManager = new PlanManager();
        this.diseaseRules = this.loadDiseaseRules();
    }

    /**
     * Load disease rules from JSON file
     */
    loadDiseaseRules() {
        try {
            const diseaseRulesPath = path.join(__dirname, '../../data/disease-rules.json');
            const rawData = fs.readFileSync(diseaseRulesPath, 'utf8');
            const rules = JSON.parse(rawData);
            console.log('✅ Disease rules loaded from JSON file');
            return rules;
        } catch (error) {
            console.warn('⚠️ Could not load disease rules from JSON, using defaults:', error.message);
            // Fallback to hardcoded rules if JSON loading fails
            return {
                covered: {
                    'cataract': { waiting_period: 730, requires_hospital: true, risk_level: 'low' },
                    'hernia': { waiting_period: 730, requires_hospital: true, risk_level: 'medium' },
                    'kidney stone': { waiting_period: 730, requires_hospital: true, risk_level: 'medium' },
                    'gallbladder': { waiting_period: 730, requires_hospital: true, risk_level: 'medium' },
                    'arthritis': { waiting_period: 730, requires_hospital: false, risk_level: 'medium' },
                    'diabetes': { waiting_period: 1095, requires_hospital: false, risk_level: 'high' },
                    'hypertension': { waiting_period: 1095, requires_hospital: false, risk_level: 'high' },
                    'heart disease': { waiting_period: 730, requires_hospital: true, risk_level: 'high' },
                    'cancer': { waiting_period: 730, requires_hospital: true, risk_level: 'high' },
                    'stroke': { waiting_period: 730, requires_hospital: true, risk_level: 'high' },
                    'tuberculosis': { waiting_period: 365, requires_hospital: true, risk_level: 'medium' },
                    'pneumonia': { waiting_period: 30, requires_hospital: true, risk_level: 'low' },
                    'appendicitis': { waiting_period: 30, requires_hospital: true, risk_level: 'low' },
                    'fracture': { waiting_period: 0, requires_hospital: true, risk_level: 'low' },
                    'fever': { waiting_period: 30, requires_hospital: false, risk_level: 'low' },
                    'surgery': { waiting_period: 730, requires_hospital: true, risk_level: 'medium' },
                    'accident': { waiting_period: 0, requires_hospital: true, risk_level: 'low' },
                    'maternity': { waiting_period: 1095, requires_hospital: true, risk_level: 'medium' },
                    'delivery': { waiting_period: 1095, requires_hospital: true, risk_level: 'medium' }
                },
                excluded: {
                    'cosmetic surgery': 'Cosmetic procedures are not covered',
                    'dental treatment': 'Dental treatments require separate coverage',
                    'infertility': 'Infertility treatments are excluded',
                    'experimental treatment': 'Experimental treatments are not covered',
                    'self-inflicted injury': 'Self-inflicted injuries are excluded',
                    'substance abuse': 'Substance abuse related treatments are excluded',
                    'war injury': 'War-related injuries are excluded',
                    'suicide attempt': 'Suicide attempts are excluded'
                },
                conditional: {
                    'pre-existing condition': 'Requires 3-4 year waiting period',
                    'chronic disease': 'May require ongoing documentation',
                    'genetic disorder': 'May require genetic counseling'
                }
            };
        }
    }

    /**
     * Main eligibility analysis function
     * @param {Object} claimData - Claim information from frontend
     * @param {string} planFilePath - Path to the selected plan JSON
     * @returns {Object} Eligibility analysis result
     */
    async analyzeClaimEligibility(claimData, planFilePath) {
        try {
            console.log('🔍 Starting claim eligibility analysis...');
            console.log('📄 Plan file path:', planFilePath);
            console.log('📋 Claim data:', claimData);

            // Load plan details
            const planDetails = await this.planManager.getPlan(planFilePath);
            const plan = planDetails.data;

            // Calculate policy age
            const policyStartDate = new Date(claimData.policy_start_date);
            const currentDate = new Date();
            const policyAgeDays = Math.floor((currentDate - policyStartDate) / (1000 * 60 * 60 * 24));

            console.log('📅 Policy age in days:', policyAgeDays);

            // Determine claim flow and perform appropriate analysis
            let eligibilityResult;
            if (claimData.claim_type === 'Accident') {
                eligibilityResult = this.analyzeAccidentClaim(claimData, plan, policyAgeDays);
            } else if (claimData.claim_type === 'Illness') {
                eligibilityResult = this.analyzeIllnessClaim(claimData, plan, policyAgeDays);
            } else {
                // Legacy flow for backward compatibility
                eligibilityResult = this.performEligibilityChecks(claimData, plan, policyAgeDays);
            }
            
            // Add plan-specific information
            eligibilityResult.plan_details = {
                company: plan.plan_details?.Company || plan.company,
                plan_name: plan.plan_details?.['Plan Name'] || plan.planName,
                sum_insured: claimData.sum_insured,
                policy_age_days: policyAgeDays
            };

            // Generate detailed recommendations
            eligibilityResult.recommendations = this.generateRecommendations(eligibilityResult, plan);
            
            // Add next steps and important notes
            eligibilityResult.next_steps = this.generateNextSteps(eligibilityResult);
            eligibilityResult.important_notes = this.generateImportantNotes(eligibilityResult, plan);

            console.log('✅ Eligibility analysis completed:', eligibilityResult.eligible ? 'ELIGIBLE' : 'NOT ELIGIBLE');
            return eligibilityResult;

        } catch (error) {
            console.error('❌ Error in claim eligibility analysis:', error);
            throw new Error(`Eligibility analysis failed: ${error.message}`);
        }
    }

    /**
     * Analyze Accident Claims with specific flow logic
     */
    analyzeAccidentClaim(claimData, plan, policyAgeDays) {
        const result = {
            eligible: true,
            risk_level: 'low',
            summary: '',
            patient_name: claimData.patient_name,
            patient_age: claimData.patient_age,
            medical_condition: claimData.accident_type || 'Accident',
            treatment_type: 'Accident',
            claim_amount: claimData.claim_amount || 0,
            sum_insured: claimData.sum_insured,
            rejection_reasons: [],
            waiting_periods: {},
            coverage_details: this.extractCoverageDetails(plan),
            financial_breakdown: {},
            claim_type: 'Accident',
            accident_details: {
                type: claimData.accident_type,
                date: claimData.accident_date,
                proof_available: claimData.rta_proof,
                medical_consultation: claimData.medical_consultation,
                medical_records: claimData.medical_records
            }
        };

        console.log('🚗 Analyzing accident claim:', claimData.accident_type);

        // 1. RTA with documentation has NO waiting period - instant eligibility
        if (claimData.accident_type === 'RTA' && claimData.rta_proof === 'Yes') {
            console.log('✅ RTA with documentation - No waiting period required');
            result.risk_level = 'low';
            result.summary = 'RTA claim with proper documentation - Eligible for instant processing';
            // Skip initial waiting period check for RTA with docs
        } else {
            // Check initial waiting period for other cases
            if (policyAgeDays < 30) {
                result.eligible = false;
                result.rejection_reasons.push('Policy is in initial waiting period (30 days)');
                result.waiting_periods.initial_waiting = `${30 - policyAgeDays} days remaining`;
                result.risk_level = 'high';
            }
        }

        // 2. Accident-specific logic
        if (claimData.accident_type === 'RTA') {
            // RTA Logic
            if (claimData.rta_proof === 'Yes') {
                result.risk_level = 'low';
                result.summary = 'RTA claim with proper documentation - Eligible for instant processing';
            } else if (claimData.rta_proof === 'No') {
                result.eligible = false;
                result.rejection_reasons.push('RTA claims require police documentation (FIR, accident report)');
                result.risk_level = 'high';
            }
        } else if (claimData.accident_type === 'Domestic') {
            // Domestic Accident Logic
            const accidentDate = new Date(claimData.accident_date);
            const policyStartDate = new Date(claimData.policy_start_date || Date.now());
            
            console.log('🏠 Domestic accident analysis:');
            console.log('  📅 Accident Date:', accidentDate.toISOString().split('T')[0]);
            console.log('  📋 Policy Start Date:', policyStartDate.toISOString().split('T')[0]);
            
            // Check if accident occurred before policy start
            if (accidentDate < policyStartDate) {
                console.log('  ❌ Accident occurred before policy start');
                result.eligible = false;
                result.rejection_reasons.push('Accident occurred before policy start date');
                result.risk_level = 'high';
            }
            
            // Check if policy had minimum 30 days before accident (waiting period check)
            const daysBetweenPolicyAndAccident = Math.floor((accidentDate - policyStartDate) / (1000 * 60 * 60 * 24));
            console.log('  ⏰ Days between policy start and accident:', daysBetweenPolicyAndAccident);
            
            if (daysBetweenPolicyAndAccident < 30) {
                console.log('  ❌ Waiting period violation (less than 30 days)');
                result.eligible = false;
                result.rejection_reasons.push('Domestic accidents within 30 days of policy start are not covered');
                result.risk_level = 'high';
            } else {
                console.log('  ✅ Waiting period satisfied (30+ days)');
            }

            // Check documentation requirements
            console.log('  🏥 Medical consultation:', claimData.medical_consultation);
            console.log('  📄 Medical records:', claimData.medical_records);
            
            if (claimData.medical_consultation === 'No' || claimData.medical_records === 'No') {
                console.log('  ❌ Documentation requirements not met');
                result.eligible = false;
                result.rejection_reasons.push('Domestic accidents require medical consultation and proper documentation');
                result.risk_level = 'high';
            } else {
                console.log('  ✅ Documentation requirements satisfied');
            }

            if (result.eligible) {
                console.log('  ✅ Domestic accident claim approved');
                result.risk_level = 'medium';
                result.summary = 'Domestic accident with proper documentation and timing - eligible with caution';
            } else {
                console.log('  ❌ Domestic accident claim rejected');
            }
        }

        // 3. Check claim amount vs sum insured
        this.checkClaimAmountLimits(result, claimData);

        // 4. Calculate financial breakdown
        this.calculateFinancialBreakdown(result, claimData, plan);

        // Generate summary if not set
        if (!result.summary) {
            result.summary = result.eligible ?
                'Accident claim appears eligible for processing' :
                `Accident claim not eligible: ${result.rejection_reasons.join(', ')}`;
        }

        return result;
    }

    /**
     * Analyze Illness Claims with disease database logic
     */
    analyzeIllnessClaim(claimData, plan, policyAgeDays) {
        const result = {
            eligible: true,
            risk_level: 'low',
            summary: '',
            patient_name: claimData.patient_name,
            patient_age: claimData.patient_age,
            medical_condition: claimData.illness_type || 'Illness',
            treatment_type: 'Illness',
            claim_amount: claimData.claim_amount || 0,
            sum_insured: claimData.sum_insured,
            rejection_reasons: [],
            waiting_periods: {},
            coverage_details: this.extractCoverageDetails(plan),
            financial_breakdown: {},
            claim_type: 'Illness',
            illness_details: {
                type: claimData.illness_type,
                pre_existing: claimData.pre_existing_disease,
                congenital: claimData.congenital_condition
            }
        };

        console.log('🧬 Analyzing illness claim:', claimData.illness_type);

        // 1. Check for congenital conditions (birth defects)
        if (claimData.congenital_condition) {
            result.eligible = false;
            result.rejection_reasons.push('Congenital conditions (present from birth) are not covered');
            result.risk_level = 'high';
        }

        // 2. Check pre-existing disease waiting period
        if (claimData.pre_existing_disease && policyAgeDays < 1095) { // 3 years
            result.eligible = false;
            result.rejection_reasons.push('Pre-existing disease waiting period not completed (3 years)');
            result.waiting_periods.pre_existing_disease = `${Math.ceil((1095 - policyAgeDays) / 365)} years remaining`;
            result.risk_level = 'high';
        }

        // 3. Check against disease database
        const illnessType = (claimData.illness_type || '').toLowerCase();
        this.checkIllnessAgainstDatabase(result, illnessType, policyAgeDays);

        // 4. Check initial waiting period
        if (policyAgeDays < 30) {
            result.eligible = false;
            result.rejection_reasons.push('Policy is in initial waiting period (30 days)');
            result.waiting_periods.initial_waiting = `${30 - policyAgeDays} days remaining`;
            result.risk_level = 'high';
        }

        // 5. Check claim amount vs sum insured
        this.checkClaimAmountLimits(result, claimData);

        // 6. Age-related restrictions
        this.checkAgeRestrictions(result, claimData, plan);

        // 7. Calculate financial breakdown
        this.calculateFinancialBreakdown(result, claimData, plan);

        // Generate summary if not set
        if (!result.summary) {
            result.summary = result.eligible ?
                'Illness claim appears eligible for processing' :
                `Illness claim not eligible: ${result.rejection_reasons.join(', ')}`;
        }

        return result;
    }

    /**
     * Check illness against disease database with enhanced matching
     */
    checkIllnessAgainstDatabase(result, illnessType, policyAgeDays) {
        console.log(`🔍 Checking illness: "${illnessType}" against disease database`);

        // Normalize illness type for better matching
        const normalizedIllness = illnessType.toLowerCase().trim();

        // Check permanent exclusions first
        for (const [excludedDisease, reason] of Object.entries(this.diseaseRules.excluded)) {
            if (this.matchesDisease(normalizedIllness, excludedDisease)) {
                console.log(`❌ Found excluded disease match: ${excludedDisease}`);
                result.eligible = false;
                result.rejection_reasons.push(`${reason} - ${excludedDisease} is permanently excluded`);
                result.risk_level = 'high';
                return;
            }
        }

        // Check covered diseases with waiting periods
        let diseaseMatched = false;
        for (const [disease, rules] of Object.entries(this.diseaseRules.covered)) {
            if (this.matchesDisease(normalizedIllness, disease)) {
                console.log(`✅ Found covered disease match: ${disease} (waiting: ${rules.waiting_period} days)`);
                diseaseMatched = true;
                const waitingPeriod = rules.waiting_period;
                
                if (policyAgeDays < waitingPeriod) {
                    result.eligible = false;
                    result.rejection_reasons.push(`Specific disease waiting period not completed for ${disease} (${Math.ceil(waitingPeriod / 365)} year${waitingPeriod > 365 ? 's' : ''})`);
                    result.waiting_periods.specific_disease = `${Math.ceil((waitingPeriod - policyAgeDays) / 365)} year${(waitingPeriod - policyAgeDays) > 365 ? 's' : ''} remaining`;
                    result.risk_level = 'high';
                } else {
                    console.log(`✅ Waiting period satisfied for ${disease}`);
                }
                
                // Set risk level based on disease
                if (rules.risk_level === 'high' && result.risk_level !== 'high') {
                    result.risk_level = rules.risk_level;
                } else if (rules.risk_level === 'medium' && result.risk_level === 'low') {
                    result.risk_level = rules.risk_level;
                }
                
                return;
            }
        }

        // If no exact match found, log for debugging
        if (!diseaseMatched) {
            console.log(`⚠️ No disease match found for: "${illnessType}". Treating as general illness.`);
            result.risk_level = 'medium';
        }
    }

    /**
     * Enhanced disease matching with fuzzy logic and synonyms
     */
    matchesDisease(illnessType, diseaseKey) {
        const illness = illnessType.toLowerCase();
        const disease = diseaseKey.toLowerCase();

        // Direct match
        if (illness.includes(disease) || disease.includes(illness)) {
            return true;
        }

        // Handle common synonyms and variations
        const synonymMap = {
            'piles': ['hemorrhoids', 'haemorrhoids'],
            'hemorrhoids': ['piles', 'haemorrhoids'],
            'haemorrhoids': ['piles', 'hemorrhoids'],
            'heart disease': ['cardiac', 'heart attack', 'coronary', 'myocardial'],
            'diabetes': ['diabetic', 'blood sugar', 'glucose'],
            'hypertension': ['high blood pressure', 'bp', 'blood pressure'],
            'kidney stone': ['renal stone', 'kidney stones', 'renal calculi'],
            'gallbladder': ['gall bladder', 'cholecystitis', 'gallstones'],
            'dental treatment': ['dental', 'tooth', 'teeth', 'oral', 'dentist'],
            'cosmetic surgery': ['cosmetic', 'aesthetic', 'beauty', 'plastic surgery']
        };

        // Check if disease has synonyms
        if (synonymMap[disease]) {
            for (const synonym of synonymMap[disease]) {
                if (illness.includes(synonym)) {
                    return true;
                }
            }
        }

        // Check reverse mapping (if illness is a key in synonym map)
        for (const [key, synonyms] of Object.entries(synonymMap)) {
            if (illness.includes(key) && synonyms.includes(disease)) {
                return true;
            }
        }

        // Partial word matching for compound terms
        const illnessWords = illness.split(/\s+/);
        const diseaseWords = disease.split(/\s+/);
        
        for (const illnessWord of illnessWords) {
            for (const diseaseWord of diseaseWords) {
                if (illnessWord.length > 3 && diseaseWord.length > 3) {
                    if (illnessWord.includes(diseaseWord) || diseaseWord.includes(illnessWord)) {
                        return true;
                    }
                }
            }
        }

        return false;
    }

    /**
     * Perform comprehensive eligibility checks
     */
    performEligibilityChecks(claimData, plan, policyAgeDays) {
        const result = {
            eligible: true,
            risk_level: 'low',
            summary: '',
            patient_name: claimData.patient_name,
            patient_age: claimData.patient_age,
            medical_condition: claimData.medical_condition,
            treatment_type: claimData.treatment_type,
            claim_amount: claimData.claim_amount,
            sum_insured: claimData.sum_insured,
            rejection_reasons: [],
            waiting_periods: {},
            coverage_details: this.extractCoverageDetails(plan),
            financial_breakdown: {}
        };

        // 1. Check initial waiting period (30 days)
        this.checkInitialWaitingPeriod(result, policyAgeDays);

        // 2. Check pre-existing disease waiting period
        this.checkPreExistingDiseaseWaiting(result, claimData, policyAgeDays);

        // 3. Check specific disease waiting periods
        this.checkSpecificDiseaseWaiting(result, claimData, policyAgeDays);

        // 4. Check claim amount vs sum insured
        this.checkClaimAmountLimits(result, claimData);

        // 5. Check age-related restrictions
        this.checkAgeRestrictions(result, claimData, plan);

        // 6. Check treatment type coverage
        this.checkTreatmentTypeCoverage(result, claimData, plan);

        // 7. Check excluded diseases
        this.checkExcludedDiseases(result, claimData);

        // 8. Check maternity coverage
        this.checkMaternityCoverage(result, claimData, plan, policyAgeDays);

        // 9. Calculate financial breakdown
        this.calculateFinancialBreakdown(result, claimData, plan);

        // Generate summary
        result.summary = this.generateSummary(result);

        return result;
    }

    /**
     * Check initial waiting period (30 days)
     */
    checkInitialWaitingPeriod(result, policyAgeDays) {
        const initialWaitingDays = 30;
        
        if (policyAgeDays < initialWaitingDays) {
            result.eligible = false;
            result.rejection_reasons.push(`Policy is in initial waiting period (${initialWaitingDays} days)`);
            result.waiting_periods.initial_waiting = `${initialWaitingDays - policyAgeDays} days remaining`;
            result.risk_level = 'high';
        }
    }

    /**
     * Check pre-existing disease waiting period
     */
    checkPreExistingDiseaseWaiting(result, claimData, policyAgeDays) {
        if (claimData.pre_existing_disease) {
            const preExistingWaitingDays = 1095; // 3 years
            
            if (policyAgeDays < preExistingWaitingDays) {
                result.eligible = false;
                result.rejection_reasons.push('Pre-existing disease waiting period not completed (3 years)');
                result.waiting_periods.pre_existing_disease = `${Math.ceil((preExistingWaitingDays - policyAgeDays) / 365)} years remaining`;
                result.risk_level = 'high';
            }
        }
    }

    /**
     * Check specific disease waiting periods
     */
    checkSpecificDiseaseWaiting(result, claimData, policyAgeDays) {
        const condition = claimData.medical_condition.toLowerCase();
        console.log(`🔍 Checking specific disease waiting for: "${condition}"`);
        
        // Check if condition matches any known diseases
        for (const [disease, rules] of Object.entries(this.diseaseRules.covered)) {
            if (this.matchesDisease(condition, disease)) {
                console.log(`✅ Found disease match: ${disease} (waiting: ${rules.waiting_period} days)`);
                const waitingPeriod = rules.waiting_period;
                
                // Emergency treatments may have relaxed waiting periods
                if (!claimData.emergency_treatment && policyAgeDays < waitingPeriod) {
                    result.eligible = false;
                    result.rejection_reasons.push(`Specific disease waiting period not completed for ${disease} (${Math.ceil(waitingPeriod / 365)} year${waitingPeriod > 365 ? 's' : ''})`);
                    result.waiting_periods.specific_disease = `${Math.ceil((waitingPeriod - policyAgeDays) / 365)} year${(waitingPeriod - policyAgeDays) > 365 ? 's' : ''} remaining`;
                } else {
                    console.log(`✅ Waiting period satisfied for ${disease}`);
                }
                
                // Set risk level based on disease
                if (rules.risk_level === 'high' && result.risk_level !== 'high') {
                    result.risk_level = rules.risk_level;
                }
                
                break;
            }
        }
    }

    /**
     * Check claim amount vs sum insured limits
     */
    checkClaimAmountLimits(result, claimData) {
        const sumInsuredValue = this.parseSumInsured(claimData.sum_insured);
        
        if (claimData.claim_amount > sumInsuredValue) {
            result.eligible = false;
            result.rejection_reasons.push(`Claim amount (₹${claimData.claim_amount.toLocaleString()}) exceeds sum insured (₹${sumInsuredValue.toLocaleString()})`);
            result.risk_level = 'high';
        }
    }

    /**
     * Check age-related restrictions
     */
    checkAgeRestrictions(result, claimData, plan) {
        const ageEntry = plan.plan_details?.['Adult Age Entry (MIN-MAX)'] || '';
        const ageMatch = ageEntry.match(/(\d+)(?:\s*-\s*(\d+))?/);
        
        if (ageMatch) {
            const minAge = parseInt(ageMatch[1]);
            const maxAge = ageMatch[2] ? parseInt(ageMatch[2]) : 100;
            
            if (claimData.patient_age < minAge || claimData.patient_age > maxAge) {
                result.eligible = false;
                result.rejection_reasons.push(`Patient age (${claimData.patient_age}) is outside plan coverage range (${minAge}-${maxAge} years)`);
                result.risk_level = 'high';
            }
        }

        // Age-based co-pay check
        if (claimData.patient_age > 60) {
            result.risk_level = result.risk_level === 'low' ? 'medium' : result.risk_level;
        }
    }

    /**
     * Check treatment type coverage
     */
    checkTreatmentTypeCoverage(result, claimData, plan) {
        const treatmentType = claimData.treatment_type.toLowerCase();
        const basicCoverages = plan.basic_coverages || {};
        
        // Check specific treatment coverage
        if (treatmentType.includes('ayush') && basicCoverages['Non-Allopathic Treatment (AYUSH)'] === 'NO') {
            result.eligible = false;
            result.rejection_reasons.push('AYUSH treatments are not covered under this plan');
        }
        
        if (treatmentType.includes('domicilary') && basicCoverages['Domicilary Expenses'] === 'NO') {
            result.eligible = false;
            result.rejection_reasons.push('Domiciliary expenses are not covered under this plan');
        }
        
        if (claimData.consumables_required && basicCoverages['Consumables'] === 'NO') {
            result.rejection_reasons.push('Consumables are not covered under this plan');
            result.risk_level = 'medium';
        }
    }

    /**
     * Check excluded diseases
     */
    checkExcludedDiseases(result, claimData) {
        const condition = claimData.medical_condition.toLowerCase();
        
        for (const [excludedDisease, reason] of Object.entries(this.diseaseRules.excluded)) {
            if (condition.includes(excludedDisease)) {
                result.eligible = false;
                result.rejection_reasons.push(`${reason} - ${excludedDisease} is excluded`);
                result.risk_level = 'high';
                break;
            }
        }
    }

    /**
     * Check maternity coverage
     */
    checkMaternityCoverage(result, claimData, plan, policyAgeDays) {
        if (claimData.treatment_type.toLowerCase().includes('maternity') || 
            claimData.medical_condition.toLowerCase().includes('delivery') ||
            claimData.medical_condition.toLowerCase().includes('pregnancy')) {
            
            const maternityCover = plan.maternity_cover || {};
            const waitingPeriod1st = maternityCover['WAITING PERIOD 1st DELIVERY'];
            
            if (waitingPeriod1st && waitingPeriod1st.includes('36 MONTHS')) {
                const requiredDays = 1095; // 36 months
                
                if (policyAgeDays < requiredDays) {
                    result.eligible = false;
                    result.rejection_reasons.push('Maternity waiting period not completed (36 months required)');
                    result.waiting_periods.maternity = `${Math.ceil((requiredDays - policyAgeDays) / 30)} months remaining`;
                }
            }
        }
    }

    /**
     * Calculate financial breakdown including co-pay
     */
    calculateFinancialBreakdown(result, claimData, plan) {
        let copayPercentage = 0;
        let copayAmount = 0;
        
        // Age-based co-pay (common in insurance)
        if (claimData.patient_age > 60) {
            copayPercentage = 10; // 10% co-pay for age > 60
            copayAmount = Math.round(claimData.claim_amount * 0.1);
        }
        
        // Plan-specific co-pay check
        const subLimits = plan.sub_limits || {};
        if (subLimits['Co - Pay'] && subLimits['Co - Pay'] !== 'NO') {
            // Extract co-pay percentage if specified
            const copayMatch = subLimits['Co - Pay'].match(/(\d+)%/);
            if (copayMatch) {
                copayPercentage = Math.max(copayPercentage, parseInt(copayMatch[1]));
                copayAmount = Math.round(claimData.claim_amount * (copayPercentage / 100));
            }
        }
        
        const finalAmount = claimData.claim_amount - copayAmount;
        
        result.financial_breakdown = {
            total_claim: claimData.claim_amount,
            sum_insured: claimData.sum_insured,
            copay_amount: copayAmount,
            copay_percentage: copayPercentage,
            final_amount: finalAmount
        };
    }

    /**
     * Extract coverage details from plan
     */
    extractCoverageDetails(plan) {
        const basicCoverages = plan.basic_coverages || {};
        
        return {
            pre_hospitalization: basicCoverages['Pre-Hospitalization'] || 'As per policy',
            post_hospitalization: basicCoverages['Post-Hospitalization'] || 'As per policy',
            room_rent_limit: plan.sub_limits?.['Room Rent/day'] || 'As per policy',
            consumables: basicCoverages['Consumables'] === 'YES' ? 'Covered' : 'Not Covered',
            emergency_ambulance: basicCoverages['Emergency Ambulance'] || 'As per policy',
            day_care: basicCoverages['DAY CARE (PROCEDURE/SURGERY)'] === 'YES' ? 'Covered' : 'Not Covered'
        };
    }

    /**
     * Generate summary based on eligibility result
     */
    generateSummary(result) {
        if (result.eligible) {
            return `Your claim appears to be eligible for processing. Expected payout: ₹${result.financial_breakdown.final_amount?.toLocaleString() || result.claim_amount.toLocaleString()}`;
        } else {
            return `Your claim is not eligible. ${result.rejection_reasons.length} issue${result.rejection_reasons.length > 1 ? 's' : ''} found.`;
        }
    }

    /**
     * Generate recommendations
     */
    generateRecommendations(result, plan) {
        const recommendations = [];
        
        if (result.eligible) {
            // Flow-specific recommendations
            if (result.claim_type === 'Accident') {
                if (result.accident_details?.type === 'RTA') {
                    recommendations.push('Ensure police documentation (FIR/accident report) is readily available');
                    recommendations.push('Get medical examination done immediately after the accident');
                } else if (result.accident_details?.type === 'Domestic') {
                    recommendations.push('Maintain proper medical records and consultation documents');
                    recommendations.push('Report the accident to insurance company immediately');
                }
                recommendations.push('Accident claims typically have faster processing if documentation is complete');
            } else if (result.claim_type === 'Illness') {
                recommendations.push('Ensure all medical test reports and doctor consultations are documented');
                recommendations.push('Check if the treatment requires pre-authorization');
                if (result.illness_details?.pre_existing) {
                    recommendations.push('Provide complete medical history and previous treatment records');
                }
            }
            
            // General recommendations for eligible claims
            recommendations.push('Follow hospital network guidelines for cashless treatment');
            recommendations.push('Inform insurance company within 24-48 hours of hospitalization');
            recommendations.push('Keep all original bills and medical reports');
            
            if (result.financial_breakdown.copay_amount > 0) {
                recommendations.push(`Be prepared for co-pay amount of ₹${result.financial_breakdown.copay_amount.toLocaleString()}`);
            }
        } else {
            // Flow-specific rejection guidance
            if (result.claim_type === 'Accident') {
                if (result.accident_details?.type === 'RTA' && result.accident_details?.proof_available === 'No') {
                    recommendations.push('Obtain police documentation (FIR) for RTA claims to improve eligibility');
                }
                if (result.accident_details?.type === 'Domestic') {
                    recommendations.push('Ensure proper medical consultation and documentation for domestic accidents');
                }
            } else if (result.claim_type === 'Illness') {
                if (result.illness_details?.congenital) {
                    recommendations.push('Consider specialized insurance plans that cover congenital conditions');
                }
                if (result.illness_details?.pre_existing) {
                    recommendations.push('Consider emergency treatment provisions for pre-existing conditions');
                }
            }
            
            // General waiting period recommendations
            if (result.waiting_periods.initial_waiting) {
                recommendations.push('Wait for the initial waiting period to complete');
            }
            if (result.waiting_periods.pre_existing_disease) {
                recommendations.push('Consider emergency treatment if applicable for pre-existing conditions');
            }
            if (result.waiting_periods.specific_disease) {
                recommendations.push('Wait for the specific disease waiting period to complete');
            }
            
            recommendations.push('Consult with your insurance advisor for policy clarifications');
            recommendations.push('Consider alternative treatment options if urgent');
            recommendations.push('Review policy terms and conditions for exclusions');
        }
        
        return recommendations;
    }

    /**
     * Generate next steps
     */
    generateNextSteps(result) {
        if (result.eligible) {
            const steps = ['Contact your insurance company immediately'];
            
            // Flow-specific next steps
            if (result.claim_type === 'Accident') {
                if (result.accident_details?.type === 'RTA') {
                    steps.push('Submit police documentation (FIR/accident report)');
                    steps.push('Get immediate medical examination and treatment');
                } else if (result.accident_details?.type === 'Domestic') {
                    steps.push('Provide medical consultation records');
                    steps.push('Submit hospital/clinic documentation');
                }
                steps.push('File accident claim within 7 days of incident');
            } else if (result.claim_type === 'Illness') {
                steps.push('Submit pre-authorization request if required');
                steps.push('Provide complete medical history and test reports');
                if (result.illness_details?.pre_existing) {
                    steps.push('Submit previous treatment records for pre-existing conditions');
                }
            }
            
            steps.push('Prepare all medical documents and bills');
            steps.push('Follow cashless or reimbursement process');
            steps.push('Maintain communication with insurance team');
            
            return steps;
        } else {
            const steps = ['Review rejection reasons carefully'];
            
            // Flow-specific guidance for rejected claims
            if (result.claim_type === 'Accident') {
                if (result.accident_details?.type === 'RTA' && result.accident_details?.proof_available === 'No') {
                    steps.push('Obtain police documentation for RTA claims');
                }
                if (result.accident_details?.type === 'Domestic') {
                    steps.push('Ensure proper timing and documentation for domestic accidents');
                }
            } else if (result.claim_type === 'Illness') {
                if (result.waiting_periods.pre_existing_disease) {
                    steps.push('Wait for pre-existing disease waiting period to complete');
                }
                if (result.waiting_periods.specific_disease) {
                    steps.push('Wait for specific disease waiting period to complete');
                }
            }
            
            steps.push('Consult insurance advisor for guidance');
            steps.push('Consider policy upgrade if needed');
            steps.push('Seek second medical opinion if appropriate');
            
            return steps;
        }
    }

    /**
     * Generate important notes
     */
    generateImportantNotes(result, plan) {
        const notes = [];
        
        if (result.eligible) {
            notes.push('This is a preliminary assessment. Final approval depends on medical review and documentation.');
            notes.push('Cashless facility is subject to hospital network and pre-authorization approval.');
            
            if (result.risk_level === 'high') {
                notes.push('High-risk case - additional documentation may be required.');
            }
        } else {
            notes.push('This assessment is based on policy terms and provided information.');
            notes.push('Emergency cases may have different eligibility criteria.');
            notes.push('Consider consulting with insurance company for official clarification.');
        }
        
        return notes.join(' ');
    }

    /**
     * Parse sum insured value to number
     */
    parseSumInsured(sumInsured) {
        if (!sumInsured) return 0;
        
        const cleanStr = sumInsured.toString().replace(/[₹,\s]/g, '').toUpperCase();
        console.log(`💰 Parsing sum insured: "${sumInsured}" → "${cleanStr}"`);
        
        let result = 0;
        
        if (cleanStr.includes('CR') || cleanStr.includes('CRORE')) {
            result = parseFloat(cleanStr.replace(/CR|CRORE/g, '')) * 10000000; // 1 Crore = 10M
        } else if (cleanStr.includes('L') || cleanStr.includes('LAKH')) {
            result = parseFloat(cleanStr.replace(/L|LAKH/g, '')) * 100000; // 1 Lakh = 100K
        } else {
            result = parseFloat(cleanStr) || 0;
        }
        
        console.log(`💰 Parsed sum insured result: ₹${result.toLocaleString()}`);
        return result;
    }

    /**
     * Check if disease is covered
     */
    isCovered(diseaseName) {
        const condition = diseaseName.toLowerCase();
        return Object.keys(this.diseaseRules.covered).some(disease => condition.includes(disease));
    }

    /**
     * Check if waiting period is satisfied
     */
    isWaitingPeriodSatisfied(disease, policyAgeDays, isEmergency = false) {
        const condition = disease.toLowerCase();
        
        for (const [diseaseName, rules] of Object.entries(this.diseaseRules.covered)) {
            if (condition.includes(diseaseName)) {
                // Emergency treatments may have relaxed waiting periods
                if (isEmergency && rules.waiting_period > 30) {
                    return policyAgeDays >= 30; // Minimum 30 days for emergency
                }
                return policyAgeDays >= rules.waiting_period;
            }
        }
        
        return true; // Unknown diseases default to no waiting period
    }

    /**
     * Check if required documents are available
     */
    hasRequiredDocuments(diseaseName, treatmentType) {
        const condition = diseaseName.toLowerCase();
        
        for (const [disease, rules] of Object.entries(this.diseaseRules.covered)) {
            if (condition.includes(disease)) {
                return !rules.requires_hospital || treatmentType.toLowerCase().includes('hospitalization');
            }
        }
        
        return true; // Default to true for unknown diseases
    }
}

module.exports = { ClaimEligibilityEngine };