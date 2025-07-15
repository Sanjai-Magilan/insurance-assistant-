const { GroqAnalyzer } = require('./groqAnalyzer.js');

/**
 * Clarification Engine - Generates intelligent clarification questions
 * based on plan-specific rules and medical conditions
 */
class ClarificationEngine {
    constructor() {
        this.groqAnalyzer = new GroqAnalyzer();
        this.clarificationTypes = new Map();
        this.initializeClarificationTypes();
    }

    /**
     * Initialize different types of clarifications
     */
    initializeClarificationTypes() {
        this.clarificationTypes.set('cataract_specific', new CataractClarification());
        this.clarificationTypes.set('maternity_specific', new MaternityClarification());
        this.clarificationTypes.set('accident_specific', new AccidentClarification());
        this.clarificationTypes.set('age_copay', new AgeCopaylandClarification());
        this.clarificationTypes.set('pre_existing', new PreExistingClarification());
        this.clarificationTypes.set('treatment_type', new TreatmentTypeClarification());
        this.clarificationTypes.set('emergency_status', new EmergencyStatusClarification());
        this.clarificationTypes.set('consumables', new ConsumablesClarification());
        this.clarificationTypes.set('ayush_treatment', new AyushTreatmentClarification());
    }

    /**
     * Generate plan-specific clarification questions
     * @param {Object} claimData - Current claim data
     * @param {Object} planData - Plan details
     * @param {Object} eligibilityResult - Initial eligibility result
     * @returns {Array} Array of clarification objects
     */
    async generatePlanSpecificClarifications(claimData, planData, eligibilityResult) {
        try {
            console.log('🤔 Generating plan-specific clarifications...');
            
            const clarifications = [];
            const condition = claimData.medical_condition?.toLowerCase() || '';

            // Cataract-specific clarifications
            if (condition.includes('cataract')) {
                const cataractClarifications = await this.generateCataractClarifications(claimData, planData);
                clarifications.push(...cataractClarifications);
            }

            // Maternity-specific clarifications
            if (condition.includes('maternity') || condition.includes('delivery') || condition.includes('pregnancy')) {
                const maternityClarifications = await this.generateMaternityClarifications(claimData, planData);
                clarifications.push(...maternityClarifications);
            }

            // Accident-specific clarifications
            if (condition.includes('accident') || condition.includes('injury')) {
                const accidentClarifications = await this.generateAccidentClarifications(claimData, planData);
                clarifications.push(...accidentClarifications);
            }

            // Age-based co-pay clarifications
            if (claimData.patient_age > 60 && planData.sub_limits?.['Co - Pay']) {
                const ageClarifications = await this.generateAgeCopaylarifications(claimData, planData);
                clarifications.push(...ageClarifications);
            }

            // Pre-existing condition clarifications
            if (!claimData.hasOwnProperty('pre_existing_disease')) {
                const preExistingClarifications = await this.generatePreExistingClarifications(claimData, planData);
                clarifications.push(...preExistingClarifications);
            }

            // Treatment type clarifications
            if (!claimData.treatment_type) {
                const treatmentClarifications = await this.generateTreatmentTypeClarifications(claimData, planData);
                clarifications.push(...treatmentClarifications);
            }

            // Emergency status clarifications
            if (!claimData.hasOwnProperty('emergency_treatment') && this.mightBeEmergency(condition)) {
                const emergencyClarifications = await this.generateEmergencyClarifications(claimData, planData);
                clarifications.push(...emergencyClarifications);
            }

            // Consumables clarifications
            if (planData.basic_coverages?.['Consumables']?.includes('YES') && !claimData.hasOwnProperty('consumables_required')) {
                const consumablesClarifications = await this.generateConsumablesClarifications(claimData, planData);
                clarifications.push(...consumablesClarifications);
            }

            // AYUSH treatment clarifications
            if (planData.basic_coverages?.['Non-Allopathic Treatment (AYUSH)'] && this.mightBeAyushTreatment(condition)) {
                const ayushClarifications = await this.generateAyushClarifications(claimData, planData);
                clarifications.push(...ayushClarifications);
            }

            // Policy duration clarifications for waiting periods
            if (!claimData.policy_start_date && eligibilityResult.waiting_periods) {
                const policyClarifications = await this.generatePolicyDurationClarifications(claimData, planData);
                clarifications.push(...policyClarifications);
            }

            console.log(`✅ Generated ${clarifications.length} clarification questions`);
            return clarifications.slice(0, 3); // Limit to 3 clarifications to avoid overwhelming user

        } catch (error) {
            console.error('❌ Error generating clarifications:', error);
            return [];
        }
    }

    /**
     * Generate cataract-specific clarifications
     */
    async generateCataractClarifications(claimData, planData) {
        const clarifications = [];
        const cataractLimits = planData.sub_limits?.['Cataract Limits'];

        if (cataractLimits === 'ACTUAL') {
            // This plan has special cataract coverage
            clarifications.push({
                type: 'cataract_cause',
                priority: 'high',
                question: `🎯 Great news! Your plan covers cataract surgery at **ACTUAL cost** with no sub-limits.

To determine the exact waiting period and coverage, I need to know:

**What caused your cataract?**
1. **Age-related cataract** (natural aging process)
2. **Accident-related cataract** (due to injury or trauma)  
3. **Congenital cataract** (present from birth)
4. **Disease-related cataract** (due to diabetes, etc.)

The cause affects your waiting period and coverage eligibility.`,
                suggestions: [
                    "Age-related cataract (natural aging)",
                    "Accident-related cataract",
                    "Due to diabetes or other disease",
                    "Congenital (from birth)",
                    "I'm not sure about the cause"
                ],
                field: 'cataract_cause',
                planSpecific: true
            });
        }

        // Ask about bilateral vs unilateral
        if (!claimData.cataract_type) {
            clarifications.push({
                type: 'cataract_type',
                priority: 'medium',
                question: `Is this cataract surgery for:
1. **One eye only** (unilateral)
2. **Both eyes** (bilateral)
3. **Second eye** (if first eye was done earlier)

This helps determine the coverage amount and any additional benefits.`,
                suggestions: [
                    "One eye only",
                    "Both eyes (bilateral surgery)",
                    "Second eye (first eye done earlier)",
                    "I need to check with my doctor"
                ],
                field: 'cataract_bilateral',
                planSpecific: false
            });
        }

        return clarifications;
    }

    /**
     * Generate maternity-specific clarifications
     */
    async generateMaternityClarifications(claimData, planData) {
        const clarifications = [];
        const maternityCover = planData.maternity_cover || {};

        // First delivery vs subsequent
        if (!claimData.maternity_delivery_number) {
            clarifications.push({
                type: 'maternity_delivery_number',
                priority: 'high',
                question: `For maternity claims, I need to understand your delivery history:

**Is this your:**
1. **First delivery** under this insurance policy
2. **Second or subsequent delivery** under this policy
3. **First delivery overall** (never had a baby before)

Your plan has different waiting periods: ${maternityCover['WAITING PERIOD 1st DELIVERY'] || 'As per policy'} for first delivery and ${maternityCover['WAITING PERIOD 2nd DELIVERY'] || 'Different terms'} for subsequent deliveries.`,
                suggestions: [
                    "First delivery under this policy",
                    "Second delivery under this policy", 
                    "First delivery ever",
                    "I need to check my policy history"
                ],
                field: 'delivery_number',
                planSpecific: true
            });
        }

        // Normal vs caesarean
        if (!claimData.delivery_type) {
            clarifications.push({
                type: 'delivery_type',
                priority: 'medium',
                question: `What type of delivery is expected/planned?

Your plan covers:
• **Normal delivery**: ${maternityCover['Delivery charges (NORMAL)'] || 'As per policy'}
• **Caesarean delivery**: ${maternityCover['Delivery charges (Caesarean)'] || 'As per policy'}`,
                suggestions: [
                    "Normal delivery",
                    "Caesarean section (planned)",
                    "Emergency caesarean",
                    "Not yet determined by doctor"
                ],
                field: 'delivery_type',
                planSpecific: true
            });
        }

        return clarifications;
    }

    /**
     * Generate accident-specific clarifications
     */
    async generateAccidentClarifications(claimData, planData) {
        const clarifications = [];

        // Type of accident
        if (!claimData.accident_type) {
            clarifications.push({
                type: 'accident_type',
                priority: 'high',
                question: `🚨 Accident claims typically have **NO waiting period**, which is great for you!

To process your claim accurately, what type of accident was this?

1. **Road Traffic Accident (RTA)** - Car, bike, bus accident
2. **Domestic Accident** - Fall at home, kitchen accident, etc.
3. **Workplace Accident** - Injury at work
4. **Sports Injury** - During sports or exercise
5. **Other Accident** - Please specify

**Note**: Road accidents require police documentation (FIR) for claim processing.`,
                suggestions: [
                    "Road Traffic Accident (RTA)",
                    "Domestic accident (at home)",
                    "Workplace accident",
                    "Sports injury",
                    "Other type of accident"
                ],
                field: 'accident_type',
                planSpecific: false
            });
        }

        // Documentation for RTA
        if (claimData.accident_type === 'RTA' && !claimData.rta_documentation) {
            clarifications.push({
                type: 'rta_documentation',
                priority: 'high',
                question: `For Road Traffic Accidents, insurance companies require proper documentation.

**Do you have:**
1. **Police FIR** (First Information Report)
2. **Traffic Police Report**
3. **Medical Legal Case (MLC)** from hospital
4. **None of the above**

✅ **With proper documentation**: Instant claim processing
❌ **Without documentation**: Claim may be rejected`,
                suggestions: [
                    "Yes, I have Police FIR",
                    "Yes, I have traffic police report",
                    "I have hospital MLC",
                    "No, I don't have any documentation",
                    "I'm not sure what I need"
                ],
                field: 'rta_documentation',
                planSpecific: false
            });
        }

        return clarifications;
    }

    /**
     * Generate age-based co-pay clarifications
     */
    async generateAgeCopaylarifications(claimData, planData) {
        const clarifications = [];
        const copayDetails = planData.sub_limits?.['Co - Pay'];

        if (copayDetails && claimData.patient_age > 60) {
            const copayMatch = copayDetails.match(/(\d+)%/);
            const copayPercentage = copayMatch ? copayMatch[1] : '10';
            const copayAmount = Math.round(claimData.claim_amount * (parseInt(copayPercentage) / 100));

            clarifications.push({
                type: 'age_copay_understanding',
                priority: 'medium',
                question: `💰 **Important Cost Information**

Since you're ${claimData.patient_age} years old, your plan has an **age-based co-pay** requirement:

📋 **Your Co-pay Details:**
• **Co-pay percentage**: ${copayPercentage}%
• **Your share**: ₹${copayAmount.toLocaleString()} (you pay this amount)
• **Insurance pays**: ₹${(claimData.claim_amount - copayAmount).toLocaleString()}

**Do you understand and accept this co-pay arrangement?**`,
                suggestions: [
                    "Yes, I understand the co-pay",
                    "Please explain co-pay in detail",
                    "Can I avoid the co-pay?",
                    "I want to know the exact calculation"
                ],
                field: 'copay_acknowledged',
                planSpecific: true
            });
        }

        return clarifications;
    }

    /**
     * Generate pre-existing condition clarifications
     */
    async generatePreExistingClarifications(claimData, planData) {
        const clarifications = [];

        clarifications.push({
            type: 'pre_existing_condition',
            priority: 'high',
            question: `🏥 **Pre-existing Condition Check**

This is important for determining your waiting period eligibility.

**Was this medical condition present or diagnosed BEFORE your insurance policy started?**

For example:
• Diabetes diagnosed before policy start
• Heart condition known before insurance
• Any ongoing treatment before policy

**Your answer:**`,
            suggestions: [
                "No, this condition started after my policy began",
                "Yes, I had this condition before my policy",
                "I'm not sure - it might be pre-existing",
                "I need to check my medical records"
            ],
            field: 'pre_existing_disease',
            planSpecific: false
        });

        return clarifications;
    }

    /**
     * Generate treatment type clarifications
     */
    async generateTreatmentTypeClarifications(claimData, planData) {
        const clarifications = [];

        clarifications.push({
            type: 'treatment_type',
            priority: 'medium',
            question: `🩺 **Treatment Type Classification**

To assess your coverage accurately, what type of treatment is this?

1. **Hospitalization** (admitted to hospital)
2. **Day Care Procedure** (same-day discharge)
3. **OPD Treatment** (outpatient/consultation only)
4. **Emergency Treatment** (urgent medical care)
5. **Surgery** (planned surgical procedure)`,
            suggestions: [
                "Hospitalization (admitted)",
                "Day care procedure",
                "OPD/Outpatient treatment",
                "Emergency treatment",
                "Planned surgery"
            ],
            field: 'treatment_type',
            planSpecific: false
        });

        return clarifications;
    }

    /**
     * Generate emergency status clarifications
     */
    async generateEmergencyClarifications(claimData, planData) {
        const clarifications = [];

        clarifications.push({
            type: 'emergency_status',
            priority: 'high',
            question: `🚨 **Emergency Treatment Status**

Emergency treatments often have **relaxed waiting periods** which can help your claim eligibility.

**Is this treatment for:**
1. **Life-threatening emergency** (immediate medical attention needed)
2. **Urgent but not life-threatening** (needs quick treatment)
3. **Planned/Scheduled treatment** (can wait for appropriate time)
4. **Follow-up treatment** (continuation of previous treatment)

💡 Emergency status can override certain waiting period restrictions.`,
            suggestions: [
                "Life-threatening emergency",
                "Urgent medical situation",
                "Planned/scheduled treatment",
                "Follow-up treatment",
                "I'm not sure about emergency status"
            ],
            field: 'emergency_treatment',
            planSpecific: false
        });

        return clarifications;
    }

    /**
     * Generate consumables clarifications
     */
    async generateConsumablesClarifications(claimData, planData) {
        const clarifications = [];
        const consumablesCoverage = planData.basic_coverages?.['Consumables'];

        clarifications.push({
            type: 'consumables_requirement',
            priority: 'low',
            question: `🛍️ **Consumables Coverage**

Your plan covers consumables: **${consumablesCoverage}**

Consumables include items like:
• Surgical disposables
• Medicines during hospitalization  
• Medical devices and equipment
• IV fluids, syringes, etc.

**Are you claiming for any consumable items?**`,
            suggestions: [
                "Yes, I need consumables coverage",
                "No consumables required",
                "I'm not sure what consumables are",
                "Need to check with hospital"
            ],
            field: 'consumables_required',
            planSpecific: true
        });

        return clarifications;
    }

    /**
     * Generate AYUSH treatment clarifications
     */
    async generateAyushClarifications(claimData, planData) {
        const clarifications = [];
        const ayushCoverage = planData.basic_coverages?.['Non-Allopathic Treatment (AYUSH)'];

        clarifications.push({
            type: 'ayush_treatment',
            priority: 'medium',
            question: `🌿 **AYUSH Treatment Coverage**

Your plan covers AYUSH treatments: **${ayushCoverage}**

AYUSH includes:
• **Ayurveda** - Traditional Indian medicine
• **Yoga & Naturopathy** - Natural healing
• **Unani** - Traditional medicine system
• **Siddha** - Ancient medical system
• **Homeopathy** - Alternative medicine

**Is your treatment under AYUSH category?**`,
            suggestions: [
                "Yes, Ayurvedic treatment",
                "Yes, Homeopathic treatment", 
                "Yes, other AYUSH treatment",
                "No, it's regular allopathic treatment",
                "I'm not sure about treatment type"
            ],
            field: 'ayush_treatment',
            planSpecific: true
        });

        return clarifications;
    }

    /**
     * Generate policy duration clarifications
     */
    async generatePolicyDurationClarifications(claimData, planData) {
        const clarifications = [];

        clarifications.push({
            type: 'policy_duration',
            priority: 'high',
            question: `📅 **Policy Duration Check**

To determine waiting period eligibility, I need to know:

**When did your current insurance policy start?**

This is important because:
• Initial waiting period: 30 days
• Specific diseases: 2 years  
• Pre-existing conditions: 3 years

Please provide your policy start date or approximate duration.`,
            suggestions: [
                "Less than 1 month ago",
                "1-6 months ago",
                "6 months - 1 year ago",
                "1-2 years ago",
                "More than 2 years ago",
                "More than 3 years ago"
            ],
            field: 'policy_duration',
            planSpecific: false
        });

        return clarifications;
    }

    /**
     * Process clarification response
     */
    async processClarificationResponse(userInput, clarification, session) {
        try {
            const response = {};
            const input = userInput.toLowerCase();

            switch (clarification.type) {
                case 'cataract_cause':
                    if (input.includes('age') || input.includes('natural')) {
                        response.cataract_cause = 'age_related';
                        response.cataract_waiting_period_applicable = true;
                    } else if (input.includes('accident') || input.includes('injury')) {
                        response.cataract_cause = 'accident_related';
                        response.accident_related = true;
                        response.cataract_waiting_period_applicable = false;
                    } else if (input.includes('congenital') || input.includes('birth')) {
                        response.cataract_cause = 'congenital';
                        response.congenital_condition = true;
                    } else if (input.includes('diabetes') || input.includes('disease')) {
                        response.cataract_cause = 'disease_related';
                        response.pre_existing_disease = true;
                    }
                    break;

                case 'maternity_delivery_number':
                    if (input.includes('first delivery under') || input.includes('first under')) {
                        response.maternity_first_delivery = true;
                        response.maternity_policy_continuity = true;
                    } else if (input.includes('second') || input.includes('subsequent')) {
                        response.maternity_first_delivery = false;
                        response.maternity_subsequent_delivery = true;
                    } else if (input.includes('first delivery ever')) {
                        response.maternity_first_delivery = true;
                        response.maternity_first_ever = true;
                    }
                    break;

                case 'accident_type':
                    if (input.includes('road') || input.includes('traffic') || input.includes('rta')) {
                        response.accident_type = 'RTA';
                        response.requires_police_documentation = true;
                    } else if (input.includes('domestic') || input.includes('home')) {
                        response.accident_type = 'domestic';
                        response.requires_police_documentation = false;
                    } else if (input.includes('workplace') || input.includes('work')) {
                        response.accident_type = 'workplace';
                    } else if (input.includes('sports')) {
                        response.accident_type = 'sports';
                    }
                    break;

                case 'pre_existing_condition':
                    response.pre_existing_disease = input.includes('yes') || input.includes('had this condition');
                    break;

                case 'emergency_status':
                    response.emergency_treatment = input.includes('emergency') || input.includes('life-threatening');
                    break;

                case 'consumables_requirement':
                    response.consumables_required = input.includes('yes') || input.includes('need consumables');
                    break;

                case 'age_copay_understanding':
                    response.copay_acknowledged = input.includes('yes') || input.includes('understand');
                    break;
            }

            console.log(`✅ Processed clarification: ${clarification.type}`, response);
            return response;

        } catch (error) {
            console.error('❌ Error processing clarification response:', error);
            return {};
        }
    }

    /**
     * Utility methods
     */
    mightBeEmergency(condition) {
        const emergencyKeywords = ['heart attack', 'stroke', 'accident', 'emergency', 'urgent', 'critical'];
        return emergencyKeywords.some(keyword => condition.includes(keyword));
    }

    mightBeAyushTreatment(condition) {
        const ayushKeywords = ['ayurveda', 'ayurvedic', 'homeopathy', 'homeopathic', 'yoga', 'naturopathy', 'unani', 'siddha'];
        return ayushKeywords.some(keyword => condition.includes(keyword));
    }
}

/**
 * Individual clarification type classes for modular design
 */
class CataractClarification {
    generateQuestions(claimData, planData) {
        // Implementation for cataract-specific questions
    }
}

class MaternityClarification {
    generateQuestions(claimData, planData) {
        // Implementation for maternity-specific questions  
    }
}

class AccidentClarification {
    generateQuestions(claimData, planData) {
        // Implementation for accident-specific questions
    }
}

class AgeCopaylandClarification {
    generateQuestions(claimData, planData) {
        // Implementation for age co-pay questions
    }
}

class PreExistingClarification {
    generateQuestions(claimData, planData) {
        // Implementation for pre-existing condition questions
    }
}

class TreatmentTypeClarification {
    generateQuestions(claimData, planData) {
        // Implementation for treatment type questions
    }
}

class EmergencyStatusClarification {
    generateQuestions(claimData, planData) {
        // Implementation for emergency status questions
    }
}

class ConsumablesClarification {
    generateQuestions(claimData, planData) {
        // Implementation for consumables questions
    }
}

class AyushTreatmentClarification {
    generateQuestions(claimData, planData) {
        // Implementation for AYUSH treatment questions
    }
}

module.exports = { ClarificationEngine };