// Quick test script for Vercel deployment
const express = require('express');
const path = require('path');

// Test if all required modules can be loaded
console.log('🧪 Testing module imports...');

try {
  const { GroqAnalyzer } = require('./src/services/groqAnalyzer.js');
  console.log('✅ GroqAnalyzer loaded');
  
  const { HealthInsuranceClaimAnalyzer } = require('./src/services/healthInsuranceAnalyzer.js');
  console.log('✅ HealthInsuranceClaimAnalyzer loaded');
  
  const { PlanManager } = require('./src/services/planManager.js');
  console.log('✅ PlanManager loaded');
  
  const { ClaimEligibilityEngine } = require('./src/services/claimEligibilityEngine.js');
  console.log('✅ ClaimEligibilityEngine loaded');
  
  const { ChatOrchestrator } = require('./src/services/chatOrchestrator.js');
  console.log('✅ ChatOrchestrator loaded');
  
  const { ResponseFormatter } = require('./src/services/responseFormatter.js');
  console.log('✅ ResponseFormatter loaded');
  
  const { PlanContextManager } = require('./src/services/planContextManager.js');
  console.log('✅ PlanContextManager loaded');
  
} catch (error) {
  console.error('❌ Module loading failed:', error);
  process.exit(1);
}

// Test if data files exist
console.log('\n🗂️ Testing data files...');

const fs = require('fs');

const dataFiles = [
  './data/disease-rules.json',
  './data/plans',
  './index.html',
  './chat-interface.html',
  './claim-assessment.html'
];

dataFiles.forEach(file => {
  if (fs.existsSync(file)) {
    console.log(`✅ ${file} exists`);
  } else {
    console.log(`⚠️ ${file} not found`);
  }
});

console.log('\n🚀 All tests passed! Ready for Vercel deployment.');
console.log('\nTo deploy:');
console.log('1. Run: npm install -g vercel');
console.log('2. Run: vercel');
console.log('3. Set environment variables in Vercel dashboard');
console.log('4. Add GROQ_API_KEY to environment variables');
