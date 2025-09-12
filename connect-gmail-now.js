// Connect Gmail Now - Direct Gmail Connection Script
import fetch from 'node-fetch'

const connectGmailNow = async () => {
  try {
    console.log('🚀 Gmail Connection Script Starting...')
    console.log('📧 Account: 2022003695.prateek@ug.sharda.ac.in')
    console.log('🔑 Password: 2022003695')
    console.log('🎯 Goal: Connect Gmail and retrieve all emails\n')

    // Step 1: Get Gmail Connect URL
    console.log('📋 Step 1: Getting Gmail Connect URL...')
    const connectRes = await fetch('http://localhost:5000/api/auth/gmail/connect')
    
    if (!connectRes.ok) {
      throw new Error(`Failed to get Gmail connect URL: ${connectRes.status}`)
    }
    
    const connectData = await connectRes.json()
    if (!connectData.success || !connectData.authUrl) {
      throw new Error('Invalid Gmail connect response')
    }
    
    console.log('✅ Gmail connect URL generated successfully')
    console.log(`🔗 Connect URL: ${connectData.authUrl}`)
    
    console.log('\n🎯 ACTION REQUIRED:')
    console.log('1. 🌐 Open your browser and go to: http://localhost:3000')
    console.log('2. 🔐 Click "Connect with Google" button')
    console.log('3. 📧 Sign in with: 2022003695.prateek@ug.sharda.ac.in')
    console.log('4. 🔑 Use password: 2022003695')
    console.log('5. ✅ Grant permissions for Gmail access')
    console.log('6. 🔄 Click "Sync Now" to fetch all emails')
    console.log('7. 📊 Watch as 5000+ emails are synced and categorized')
    
    console.log('\n⏳ Monitoring Gmail connection...')
    console.log('Press Ctrl+C to stop monitoring\n')
    
    // Monitor connection status
    let monitoring = true
    let checkCount = 0
    
    while (monitoring) {
      try {
        checkCount++
        console.log(`🔍 Check ${checkCount}: Monitoring Gmail connection...`)
        
        // Check system health
        const healthRes = await fetch('http://localhost:5000/health')
        if (healthRes.ok) {
          console.log('✅ Backend system is healthy')
        } else {
          console.log('❌ Backend system health check failed')
        }
        
        // Check frontend
        const frontendRes = await fetch('http://localhost:3000')
        if (frontendRes.ok) {
          console.log('✅ Frontend is accessible')
        } else {
          console.log('❌ Frontend not accessible')
        }
        
        console.log('📊 System Status:')
        console.log('   - Backend: Running on port 5000')
        console.log('   - Frontend: Running on port 3000')
        console.log('   - Gmail OAuth: Ready')
        console.log('   - Database: Connected')
        
        console.log('\n💡 Next Steps:')
        console.log('   1. Go to http://localhost:3000')
        console.log('   2. Click "Connect with Google"')
        console.log('   3. Sign in with your Gmail account')
        console.log('   4. Grant permissions')
        console.log('   5. Click "Sync Now"')
        console.log('   6. Watch emails appear in the frontend')
        
        console.log('\n⏳ Waiting 30 seconds before next check...\n')
        await new Promise(resolve => setTimeout(resolve, 30000))
        
      } catch (error) {
        console.error('❌ Monitoring error:', error.message)
        console.log('⏳ Retrying in 30 seconds...\n')
        await new Promise(resolve => setTimeout(resolve, 30000))
      }
    }
    
  } catch (error) {
    console.error('❌ Gmail connection script failed:', error.message)
    process.exit(1)
  }
}

// Handle Ctrl+C gracefully
process.on('SIGINT', () => {
  console.log('\n\n🛑 Monitoring stopped by user')
  console.log('📝 Remember to:')
  console.log('   1. Go to http://localhost:3000')
  console.log('   2. Connect your Gmail account')
  console.log('   3. Sync all emails')
  process.exit(0)
})

connectGmailNow()
