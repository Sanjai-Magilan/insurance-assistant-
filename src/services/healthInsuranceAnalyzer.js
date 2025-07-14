// Health Insurance Claim Eligibility Analyzer
// Implements strict business logic for health insurance claim assessment

const fs = require('fs');
const path = require('path');
const { GroqAnalyzer } = require('./groqAnalyzer.js');

class HealthInsuranceClaimAnalyzer {
  constructor() {
    this.groqAnalyzer = new GroqAnalyzer();
    this.plansDirectory = './data/plans';
    this.availablePlans = new Map();
    this.loadAllPlans();
  }

  // Load all plan JSON files
  loadAllPlans() {
    console.log('🔄 Loading health insurance plans...');
    
    try {
      const books = fs.readdirSync(this.plansDirectory);
      
      books.forEach(book => {
        const bookPath = path.join(this.plansDirectory, book);
        if (fs.statSync(bookPath).isDirectory()) {
          const planFiles = fs.readdirSync(bookPath);
          
          planFiles.forEach(file => {
            if (file.endsWith('.json') && !file.includes('plan_name_suminsuredrange')) {
              try {
                const planPath = path.join(bookPath, file);
                const planData = JSON.parse(fs.readFileSync(planPath, 'utf8'));
                
                const planKey = `${planData.company}_${planData.planName}_${planData.normalizedSumInsured}`;
                this.availablePlans.set(planKey, {
                  ...planData,
                  filePath: planPath,
                  book: book
                });
              } catch (error) {
                console.error(`Error loading plan ${file}:`, error.message);
              }
            }
          });
        }
      });
      
      console.log(`✅ Loaded ${this.availablePlans.size} health insurance plans`);
    } catch (error) {
      console.error('❌ Error loading plans:', error.message);
    }
  }

  // Get available plan companies
  getAvailableCompanies() {
    const companies = new Set();
    this.availablePlans.forEach(plan => {
      companies.add(plan.company);
    });
    return Array.from(companies).sort();
  }

  // Get plans by company
  getPlansByCompany(company) {
    const plans = new Map();
    this.availablePlans.forEach((plan, key) => {
      if (plan.company === company) {
        const planName = plan.planName;
        if (!plans.has(planName)) {
          plans.set(planName, {
            name: planName,
            company: company,
            variants: []
          });
        }
        plans.get(planName).variants.push({
          sumInsured: plan.normalizedSumInsured,
          key: key,
          data: plan
        });
      }
    });
    return Array.from(plans.values());
  }

  // Get specific plan data
  getPlanData(company, planName, sumInsured) {
    const planKey = `${company}_${planName}_${sumInsured}`;
    return this.availablePlans.get(planKey);
  }

  // Core eligibility analysis function
  async analyzeClaimEligibility(claimData) {
    console.log('🔍 Analyzing claim eligibility...');
    
    try {
      // Get plan data
      const planData = this.getPlanData(
        claimData.company,
        claimData.planName,
        claimData.sumInsured
      );

      if (!planData) {
        throw new Error('Plan not found');
      }

      // Build comprehensive analysis prompt
      const analysisPrompt = this.buildStrictEligibilityPrompt(claimData, planData);
      
      // Get AI analysis
      const aiResponse = await this.groqAnalyzer.analyzeQuery(analysisPrompt);
      
      // Parse and validate response
      const analysis = this.parseAndValidateAnalysis(aiResponse, claimData, planData);
      
      return analysis;
      
    } catch (error) {
      console.error('❌ Eligibility analysis failed:', error.message);
      throw error;
    }
  }

  // Build strict eligibility analysis prompt
  buildStrictEligibilityPrompt(claimData, planData) {
    return `
STRICT HEALTH INSURANCE CLAIM ELIGIBILITY ANALYSIS

PLAN DETAILS:
Company: ${planData.company}
Plan Name: ${planData.planName}
Sum Insured: ${claimData.sumInsured}

POLICY RULES:
Initial Waiting Period: ${planData.exclusions_waiting_periods?.["INITIAL WAITING"] || "30 days"}
Specific Disease Waiting: ${planData.exclusions_waiting_periods?.["SPECIFIC DISEASE"] || "2 years"}
Pre-existing Disease Waiting: ${planData.exclusions_waiting_periods?.["Pre Existing Disease"] || "3 years"}

COVERAGE DETAILS:
Pre-hospitalization: ${planData.basic_coverages?.["Pre-Hospitalization"] || "60 days"}
Post-hospitalization: ${planData.basic_coverages?.["Post-Hospitalization"] || "180 days"}
Room Rent Limit: ${planData.sub_limits?.["Room Rent/day"] || "No limit"}
Co-pay: ${planData.sub_limits?.["Co - Pay"] || "No"}
Consumables: ${planData.basic_coverages?.["Consumables"] || "Not covered"}
Emergency Ambulance: ${planData.basic_coverages?.["Emergency Ambulance"] || "Covered"}

CLAIM INFORMATION:
Patient Name: ${claimData.patientName}
Patient Age: ${claimData.patientAge}
Gender: ${claimData.gender}
Policy Start Date: ${claimData.policyStartDate}
Treatment Type: ${claimData.treatmentType}
Medical Condition: ${claimData.medicalCondition}
Claim Amount: ₹${claimData.claimAmount}
Pre-existing Condition: ${claimData.hasPreExisting ? 'Yes - ' + claimData.preExistingDetails : 'No'}
Emergency Treatment: ${claimData.isEmergency ? 'Yes' : 'No'}
Consumables Required: ${claimData.needsConsumables ? 'Yes' : 'No'}
Additional Info: ${claimData.additionalInfo || 'None'}

ANALYSIS REQUIREMENTS:
1. Calculate exact waiting periods from policy start date
2. Check age eligibility against plan limits
3. Verify coverage for specific treatment type
4. Calculate co-pay deductions if applicable
5. Check consumables coverage
6. Determine final payable amount

STRICT OUTPUT FORMAT (JSON only):
{
  "isEligible": true/false,
  "eligibilityStatus": "ELIGIBLE" | "NOT_ELIGIBLE" | "PARTIAL_ELIGIBLE" | "PENDING_REVIEW",
  "claimAmount": number,
  "sumInsured": number,
  "copayPercentage": number,
  "copayAmount": number,
  "finalPayableAmount": number,
  "waitingPeriods": {
    "initialDaysRemaining": number,
    "specificDiseaseDaysRemaining": number,
    "preExistingDaysRemaining": number
  },
  "coverageDetails": {
    "preHospitalization": "string",
    "postHospitalization": "string",
    "roomRentLimit": "string",
    "consumablesCovered": boolean,
    "emergencyAmbulance": "string"
  },
  "rejectionReasons": ["array of specific reasons if not eligible"],
  "recommendations": ["array of actionable recommendations"],
  "requiredDocuments": ["array of required documents"],
  "nextSteps": ["array of next steps"],
  "confidence": number (0-100)
}

Analyze strictly based on the policy terms and waiting periods. Be precise with calculations.
`;
  }

  // Parse and validate AI response
  parseAndValidateAnalysis(aiResponse, claimData, planData) {
    try {
      // Extract JSON from response
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No valid JSON found in AI response');
      }

      const analysis = JSON.parse(jsonMatch[0]);
      
      // Validate required fields
      const requiredFields = ['isEligible', 'eligibilityStatus', 'finalPayableAmount'];
      for (const field of requiredFields) {
        if (analysis[field] === undefined) {
          throw new Error(`Missing required field: ${field}`);
        }
      }

      // Add additional metadata
      analysis.analyzedAt = new Date().toISOString();
      analysis.planDetails = {
        company: planData.company,
        planName: planData.planName,
        sumInsured: claimData.sumInsured
      };
      analysis.patientInfo = {
        name: claimData.patientName,
        age: claimData.patientAge,
        gender: claimData.gender
      };

      return analysis;
      
    } catch (error) {
      console.error('❌ Error parsing AI response:', error.message);
      throw new Error('Failed to parse eligibility analysis');
    }
  }

  // Format output for display
  formatEligibilityOutput(analysis) {
    if (analysis.isEligible) {
      return this.formatEligibleOutput(analysis);
    } else {
      return this.formatNotEligibleOutput(analysis);
    }
  }

  formatEligibleOutput(analysis) {
    return `
✅ **CLAIM ELIGIBLE**

📋 **Claim Details:**
- Patient: ${analysis.patientInfo.name}
- Age: ${analysis.patientInfo.age} years
- Condition: ${analysis.planDetails.condition || 'As provided'}
- Treatment Type: ${analysis.treatmentType || 'Medical Treatment'}
- Claim Amount: ₹${analysis.claimAmount?.toLocaleString('en-IN') || 'N/A'}

💰 **Financial Breakdown:**
- Total Claim: ₹${analysis.claimAmount?.toLocaleString('en-IN') || 'N/A'}
- Sum Insured: ₹${analysis.sumInsured?.toLocaleString('en-IN') || 'N/A'}
- Co-pay Deduction: ₹${analysis.copayAmount?.toLocaleString('en-IN') || '0'} (${analysis.copayPercentage || 0}%)
- Final Payable: ₹${analysis.finalPayableAmount?.toLocaleString('en-IN') || 'N/A'}

📝 **Coverage Details:**
- Pre-hospitalization: ${analysis.coverageDetails?.preHospitalization || 'As per policy'}
- Post-hospitalization: ${analysis.coverageDetails?.postHospitalization || 'As per policy'}
- Room Rent Limit: ${analysis.coverageDetails?.roomRentLimit || 'As per policy'}
- Consumables: ${analysis.coverageDetails?.consumablesCovered ? 'Covered' : 'Not Covered'}
- Emergency Ambulance: ${analysis.coverageDetails?.emergencyAmbulance || 'As per policy'}

⚠️ **Important Notes:**
- Ensure proper claim documentation
- Follow hospital network guidelines
- Intimate insurance company within 24-48 hours for emergencies

📞 **Next Steps:**
${analysis.nextSteps?.map(step => `${step}`).join('\n') || '1. Contact your insurance company\n2. Submit required documents\n3. Follow up on claim status'}

📄 **Required Documents:**
${analysis.requiredDocuments?.map(doc => `• ${doc}`).join('\n') || '• As per policy terms'}
`;
  }

  formatNotEligibleOutput(analysis) {
    return `
❌ **CLAIM NOT ELIGIBLE**

🚫 **Reasons for Rejection:**
${analysis.rejectionReasons?.map(reason => `• ${reason}`).join('\n') || '• Policy terms not met'}

⏰ **Waiting Periods:**
- Initial Waiting: ${analysis.waitingPeriods?.initialDaysRemaining || 0} days remaining
- Specific Disease: ${analysis.waitingPeriods?.specificDiseaseDaysRemaining || 0} days remaining
- Pre-existing Disease: ${analysis.waitingPeriods?.preExistingDaysRemaining || 0} days remaining

💡 **Recommendations:**
${analysis.recommendations?.map(rec => `• ${rec}`).join('\n') || '• Wait for waiting period completion\n• Consult with insurance advisor'}

📞 **Support:**
Contact your insurance company for clarification on policy terms.

**Confidence Level:** ${analysis.confidence || 'N/A'}%
`;
  }

  // Get comprehensive plan summary for UI
  getPlanSummary() {
    const summary = {
      totalPlans: this.availablePlans.size,
      companies: this.getAvailableCompanies(),
      plansByCompany: {}
    };

    summary.companies.forEach(company => {
      summary.plansByCompany[company] = this.getPlansByCompany(company);
    });

    return summary;
  }
}

module.exports = { HealthInsuranceClaimAnalyzer };
