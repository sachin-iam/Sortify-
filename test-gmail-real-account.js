// Test Gmail Sync with Real Account
import fetch from 'node-fetch'

const testGmailRealAccount = async () => {
  try {
    console.log('🧪 Testing Gmail Sync with Real Account...')
    console.log('📧 This test will guide you through connecting your Gmail account')
    console.log('📧 Email: 2022003695.prateek@ug.sharda.ac.in')
    console.log('📧 The system will fetch 5000+ emails from your inbox\n')

    // Test 1: Check system status
    console.log('🧪 Test 1: Check system status...')
    const healthRes = await fetch('http://localhost:5000/health')
    if (!healthRes.ok) {
      throw new Error(`System not running: ${healthRes.status}`)
    }
    console.log('✅ System is running')

    // Test 2: Get Gmail connect URL
    console.log('\n🧪 Test 2: Get Gmail connect URL...')
    const connectRes = await fetch('http://localhost:5000/api/auth/gmail/connect')
    if (!connectRes.ok) {
      throw new Error(`Gmail connect failed: ${connectRes.status}`)
    }
    
    const connectData = await connectRes.json()
    if (!connectData.success || !connectData.authUrl) {
      throw new Error('Invalid Gmail connect response')
    }
    
    console.log('✅ Gmail connect URL generated')
    console.log(`🔗 Connect URL: ${connectData.authUrl}`)

    // Test 3: Check frontend
    console.log('\n🧪 Test 3: Check frontend...')
    const frontendRes = await fetch('http://localhost:3000')
    if (!frontendRes.ok) {
      throw new Error(`Frontend not accessible: ${frontendRes.status}`)
    }
    console.log('✅ Frontend is accessible')

    console.log('\n🎉 System is ready for Gmail sync!')
    console.log('\n📋 Instructions to sync your Gmail account:')
    console.log('1. 🌐 Open your browser and go to: http://localhost:3000')
    console.log('2. 🔐 Click "Connect with Google" button')
    console.log('3. 📧 Sign in with: 2022003695.prateek@ug.sharda.ac.in')
    console.log('4. 🔑 Use password: 2022003695')
    console.log('5. ✅ Grant permissions for Gmail access')
    console.log('6. 🔄 Click "Sync Now" to fetch all emails')
    console.log('7. 📊 Watch as 5000+ emails are synced and categorized')
    
    console.log('\n🚀 Expected Results:')
    console.log('✅ All emails from your inbox will be fetched')
    console.log('✅ Emails will be automatically categorized (Academic, Promotions, etc.)')
    console.log('✅ Real-time updates will work for new emails')
    console.log('✅ Search and filtering will work across all emails')
    console.log('✅ Attachments can be downloaded')
    console.log('✅ Email actions (archive, delete) will sync with Gmail')
    
    console.log('\n📊 Test Verification:')
    console.log('After syncing, verify:')
    console.log('- Total email count shows 5000+')
    console.log('- Category tabs show proper distribution')
    console.log('- Search works across all emails')
    console.log('- Email reader shows full content')
    console.log('- Analytics dashboard shows statistics')
    
  } catch (error) {
    console.error('❌ Gmail real account test failed:', error.message)
    process.exit(1)
  }
}

testGmailRealAccount()
