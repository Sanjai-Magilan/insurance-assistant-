// Test script to verify claim assessment fixes
console.log('🧪 Testing Claim Assessment Fixes...');

// Test 1: Illness claim amount detection
console.log('\n1️⃣ Testing Illness Claim Amount:');
const illnessFormData = new FormData();
illnessFormData.set('claim_type', 'Illness');
illnessFormData.set('illness_type', 'Diabetes');
illnessFormData.set('illness_claim_amount', '25000');

console.log('   - Claim Type:', illnessFormData.get('claim_type'));
console.log('   - Illness Type:', illnessFormData.get('illness_type'));
console.log('   - Illness Claim Amount:', illnessFormData.get('illness_claim_amount'));
console.log('   - Should NOT find claim_amount:', illnessFormData.get('claim_amount')); // Should be null

// Test 2: Domestic accident date calculation
console.log('\n2️⃣ Testing Domestic Accident Date Logic:');

function testDateLogic(policyStart, accidentDate) {
    const policyStartDate = new Date(policyStart);
    const accidentDateObj = new Date(accidentDate);
    const daysBetween = Math.floor((accidentDateObj - policyStartDate) / (1000 * 60 * 60 * 24));
    
    console.log(`   Policy Start: ${policyStart}`);
    console.log(`   Accident Date: ${accidentDate}`);
    console.log(`   Days Between: ${daysBetween}`);
    console.log(`   Should be eligible: ${daysBetween >= 30 ? '✅ YES' : '❌ NO'}`);
    console.log('   ---');
}

// Test cases
testDateLogic('2024-01-01', '2024-02-15'); // 45 days - should be eligible
testDateLogic('2024-01-01', '2024-01-15'); // 14 days - should NOT be eligible  
testDateLogic('2024-01-01', '2024-03-01'); // 60 days - should be eligible

// Test 3: Form field separation
console.log('\n3️⃣ Testing Form Field Separation:');
const accidentFormData = new FormData();
accidentFormData.set('claim_type', 'Accident');
accidentFormData.set('accident_type', 'Domestic');
accidentFormData.set('domestic_claim_amount', '30000');
accidentFormData.set('rta_claim_amount', '50000');
accidentFormData.set('illness_claim_amount', '25000');

console.log('   - Accident Type:', accidentFormData.get('accident_type'));
console.log('   - Domestic Amount:', accidentFormData.get('domestic_claim_amount'));
console.log('   - RTA Amount:', accidentFormData.get('rta_claim_amount'));
console.log('   - Illness Amount:', accidentFormData.get('illness_claim_amount'));
console.log('   - Old claim_amount field:', accidentFormData.get('claim_amount')); // Should be null

console.log('\n✅ Test script completed. Check the results above.');
