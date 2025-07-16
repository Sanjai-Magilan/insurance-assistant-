// Quick test script to verify the system works
const { ConversationalClaimAnalyzer } = require('./src/services/conversationalClaimAnalyzer.js');

async function quickTest() {
    try {
        console.log('🧪 Testing Enhanced AI System...');
        
        // Test 1: Create conversational analyzer
        const analyzer = new ConversationalClaimAnalyzer();
        console.log('✅ ConversationalClaimAnalyzer created successfully');
        
        // Test 2: Test basic conversation flow
        const testSessionId = `test_${Date.now()}`;
        const testPlan = 'data/plans/book1/health_assure_individual_5l.json';
        
        console.log('🔄 Testing conversation flow...');
        
        const response1 = await analyzer.analyzeClaimConversational(
            testSessionId,
            "I need help with cataract surgery",
            { planFilePath: testPlan }
        );
        
        console.log('✅ Initial conversation test passed');
        console.log('📝 Response stage:', response1.stage);
        console.log('💬 Response message preview:', response1.message.substring(0, 100) + '...');
        
        console.log('\n🎉 System is working correctly!');
        console.log('🚀 You can now run: node chat-server.js');
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        console.log('\n🔧 This might be due to missing dependencies.');
        console.log('💡 Make sure to run: npm install');
        console.log('🔑 And set up your GROQ_API_KEY in .env file');
    }
}

quickTest();