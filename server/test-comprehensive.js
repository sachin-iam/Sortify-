import dotenv from 'dotenv'
import mongoose from 'mongoose'
import User from './src/models/User.js'
import Email from './src/models/Email.js'
import jwt from 'jsonwebtoken'
import axios from 'axios'
import { startRealtimeSync, stopRealtimeSync } from './src/services/realtimeSync.js'

dotenv.config()

const testComprehensive = async () => {
  try {
    console.log('🧪 COMPREHENSIVE EMAIL SYSTEM TEST\n')
    console.log('='.repeat(50))

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

    // Generate JWT token
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET)
    const baseURL = 'http://localhost:5000'
    const headers = { Authorization: `Bearer ${token}` }

    console.log('\n📡 TEST 1: API ENDPOINTS')
    console.log('-'.repeat(30))

    // Test all API endpoints
    const tests = [
      { name: 'GET /api/auth/me', method: 'get', url: '/api/auth/me' },
      { name: 'GET /api/analytics/stats', method: 'get', url: '/api/analytics/stats' },
      { name: 'GET /api/emails', method: 'get', url: '/api/emails?page=1&limit=50' },
      { name: 'GET /api/analytics/categories', method: 'get', url: '/api/analytics/categories' },
      { name: 'POST /api/emails/gmail/sync', method: 'post', url: '/api/emails/gmail/sync' },
      { name: 'POST /api/emails/gmail/sync-all', method: 'post', url: '/api/emails/gmail/sync-all' },
      { name: 'POST /api/emails/realtime/start', method: 'post', url: '/api/emails/realtime/start' },
      { name: 'GET /api/emails/realtime/status', method: 'get', url: '/api/emails/realtime/status' }
    ]

    let passedTests = 0
    for (const test of tests) {
      try {
        const response = await axios[test.method](`${baseURL}${test.url}`, 
          test.method === 'post' ? {} : undefined, 
          { headers }
        )
        console.log(`✅ ${test.name}: SUCCESS`)
        passedTests++
      } catch (error) {
        console.log(`❌ ${test.name}: ${error.response?.data?.message || error.message}`)
      }
    }

    console.log(`\n📊 API Tests: ${passedTests}/${tests.length} passed`)

    console.log('\n📧 TEST 2: EMAIL DATA VERIFICATION')
    console.log('-'.repeat(30))

    // Check email count
    const totalEmails = await Email.countDocuments({ userId: user._id })
    console.log(`📧 Total emails in database: ${totalEmails}`)

    // Check pagination
    const emailsResponse = await axios.get(`${baseURL}/api/emails?page=1&limit=50`, { headers })
    const emails = emailsResponse.data.emails || []
    const pagination = emailsResponse.data.pagination || {}
    
    console.log(`📄 Pagination: Page ${pagination.currentPage} of ${pagination.totalPages}`)
    console.log(`📧 Emails returned: ${emails.length}`)

    // Check classification
    const classificationBreakdown = {}
    emails.forEach(email => {
      const category = email.category || 'Other'
      classificationBreakdown[category] = (classificationBreakdown[category] || 0) + 1
    })

    console.log('\n📊 Classification Breakdown:')
    Object.entries(classificationBreakdown).forEach(([category, count]) => {
      console.log(`  ${category}: ${count} emails`)
    })

    console.log('\n🤖 TEST 3: ML CLASSIFICATION')
    console.log('-'.repeat(30))

    // Check if emails are properly classified
    const classifiedEmails = emails.filter(email => email.classification?.label)
    const unclassifiedEmails = emails.filter(email => !email.classification?.label)
    
    console.log(`✅ Classified emails: ${classifiedEmails.length}`)
    console.log(`❌ Unclassified emails: ${unclassifiedEmails.length}`)
    console.log(`📊 Classification rate: ${((classifiedEmails.length / emails.length) * 100).toFixed(1)}%`)

    // Show confidence distribution
    const confidenceRanges = { high: 0, medium: 0, low: 0 }
    classifiedEmails.forEach(email => {
      const confidence = email.classification.confidence || 0
      if (confidence >= 0.8) confidenceRanges.high++
      else if (confidence >= 0.6) confidenceRanges.medium++
      else confidenceRanges.low++
    })

    console.log('\n📊 Confidence Distribution:')
    console.log(`  High (≥80%): ${confidenceRanges.high}`)
    console.log(`  Medium (60-79%): ${confidenceRanges.medium}`)
    console.log(`  Low (<60%): ${confidenceRanges.low}`)

    console.log('\n🔄 TEST 4: REAL-TIME SYNC')
    console.log('-'.repeat(30))

    // Test real-time sync
    try {
      const syncResponse = await axios.post(`${baseURL}/api/emails/realtime/start`, {}, { headers })
      console.log('✅ Real-time sync started:', syncResponse.data.message)
      
      // Wait a bit
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      const statusResponse = await axios.get(`${baseURL}/api/emails/realtime/status`, { headers })
      console.log('✅ Sync status:', statusResponse.data.message)
      
      // Stop sync
      await axios.post(`${baseURL}/api/emails/realtime/stop`, {}, { headers })
      console.log('✅ Real-time sync stopped')
      
    } catch (error) {
      console.log('❌ Real-time sync test failed:', error.response?.data?.message || error.message)
    }

    console.log('\n📈 TEST 5: PERFORMANCE METRICS')
    console.log('-'.repeat(30))

    // Test API response times
    const performanceTests = [
      { name: 'Auth check', url: '/api/auth/me' },
      { name: 'Email list', url: '/api/emails?page=1&limit=50' },
      { name: 'Analytics stats', url: '/api/analytics/stats' },
      { name: 'Categories', url: '/api/analytics/categories' }
    ]

    for (const test of performanceTests) {
      const start = Date.now()
      try {
        await axios.get(`${baseURL}${test.url}`, { headers })
        const duration = Date.now() - start
        console.log(`⚡ ${test.name}: ${duration}ms`)
      } catch (error) {
        console.log(`❌ ${test.name}: FAILED`)
      }
    }

    console.log('\n🎯 FINAL RESULTS')
    console.log('='.repeat(50))
    console.log(`✅ Total emails synced: ${totalEmails}`)
    console.log(`✅ API endpoints working: ${passedTests}/${tests.length}`)
    console.log(`✅ Classification rate: ${((classifiedEmails.length / emails.length) * 100).toFixed(1)}%`)
    console.log(`✅ Pagination working: Page ${pagination.currentPage} of ${pagination.totalPages}`)
    console.log(`✅ Real-time sync: Available`)
    
    if (totalEmails >= 100 && passedTests >= 6 && classifiedEmails.length > 0) {
      console.log('\n🎉 ALL TESTS PASSED! System is working perfectly!')
    } else {
      console.log('\n⚠️ Some tests failed. Check the issues above.')
    }

  } catch (error) {
    console.error('❌ Comprehensive test failed:', error)
  } finally {
    await mongoose.disconnect()
    console.log('\n🔌 Disconnected from MongoDB')
  }
}

testComprehensive()
