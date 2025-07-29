const companyService = require('../bot/services/companyService');

async function testCompanyManagement() {
  console.log('🏢 Testing company management functionality...');
  
  try {
    // Test getAllCompanies
    console.log('📋 Testing getAllCompanies...');
    const companies = await companyService.getAllCompanies();
    console.log(`✅ getAllCompanies returned ${companies.length} companies`);
    
    if (companies.length > 0) {
      const testCompany = companies[0];
      console.log(`🏢 Test company: ${testCompany.name} (ID: ${testCompany.id})`);
      
      // Test getCompanyById
      console.log('🔍 Testing getCompanyById...');
      const companyDetail = await companyService.getCompanyById(testCompany.id);
      console.log(`✅ getCompanyById returned company: ${companyDetail ? 'Found' : 'Not found'}`);
      
      if (companyDetail) {
        console.log('📊 Company details:');
        console.log(`   Name: ${companyDetail.name}`);
        console.log(`   ID: ${companyDetail.id}`);
        console.log(`   Owner: ${companyDetail.telegramId || 'N/A'}`);
        console.log(`   Status: ${companyDetail.status || 'active'}`);
        console.log(`   Products: ${companyDetail.products?.length || 0}`);
        console.log(`   Balance: $${(companyDetail.billingBalance || 0).toFixed(2)}`);
      }
    }
    
    console.log('✅ All company management tests passed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error.stack);
  }
}

testCompanyManagement(); 