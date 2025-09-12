import dotenv from 'dotenv'
import mongoose from 'mongoose'
import User from './src/models/User.js'
import jwt from 'jsonwebtoken'

dotenv.config()

const fixFrontendIssue = async () => {
  try {
    console.log('🔧 FIXING FRONTEND ISSUE\n')

    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI)
    console.log('✅ Connected to MongoDB')

    // Find test user
    const user = await User.findOne({ email: '2022003695.prateek@ug.sharda.ac.in' })
    if (!user) {
      console.log('❌ Test user not found')
      return
    }

    console.log('✅ Test user found:', user.email)

    // Generate fresh JWT token
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' })
    
    console.log('\n🔑 FRESH JWT TOKEN:')
    console.log('Copy this token and paste it in your browser console:')
    console.log('')
    console.log('localStorage.setItem("token", "' + token + '");')
    console.log('')
    console.log('Then refresh the page (F5) or hard refresh (Ctrl+F5)')
    console.log('')

    console.log('📋 STEP-BY-STEP FIX:')
    console.log('1. Open your browser (Chrome/Firefox)')
    console.log('2. Go to http://localhost:3000')
    console.log('3. Open Developer Tools (F12)')
    console.log('4. Go to Console tab')
    console.log('5. Paste this command:')
    console.log('   localStorage.setItem("token", "' + token + '");')
    console.log('6. Press Enter')
    console.log('7. Refresh the page (F5)')
    console.log('8. Check if all 201 emails are now visible')
    console.log('')

    console.log('🔍 ALTERNATIVE FIX:')
    console.log('If the above doesn\'t work, try:')
    console.log('1. Clear browser cache (Ctrl+Shift+Delete)')
    console.log('2. Clear localStorage: localStorage.clear()')
    console.log('3. Refresh the page')
    console.log('4. Login again')
    console.log('')

    console.log('📊 EXPECTED RESULTS:')
    console.log('✅ Should show 201 emails total')
    console.log('✅ Should show 50 emails per page')
    console.log('✅ Should show 5 pages total')
    console.log('✅ Should show proper categories (Placement, Academic, etc.)')
    console.log('✅ Should show classification badges with confidence scores')

  } catch (error) {
    console.error('❌ Fix failed:', error)
  } finally {
    await mongoose.disconnect()
    console.log('\n🔌 Disconnected from MongoDB')
  }
}

fixFrontendIssue()
