// Test API endpoints without starting server
import request from 'supertest'
import app from './src/server.js'

const runApiTest = async () => {
  try {
    console.log('🧪 Testing API endpoints...')

    // Test 1: Health check
    console.log('\n🧪 Test 1: Health check...')
    const healthRes = await request(app).get('/health')
    if (healthRes.status !== 200) {
      throw new Error(`Expected 200, got ${healthRes.status}`)
    }
    console.log('✅ Health check works')

    // Test 2: CORS
    console.log('\n🧪 Test 2: CORS...')
    const corsRes = await request(app).options('/api/auth/me')
    if (corsRes.status !== 204) {
      throw new Error(`Expected 204, got ${corsRes.status}`)
    }
    console.log('✅ CORS works')

    // Test 3: Auth endpoints (without auth)
    console.log('\n🧪 Test 3: Auth endpoints...')
    
    // Test /api/auth/me without token (should return 401)
    const meRes = await request(app).get('/api/auth/me')
    if (meRes.status !== 401) {
      throw new Error(`Expected 401, got ${meRes.status}`)
    }
    console.log('✅ /api/auth/me returns 401 without token')

    // Test 4: Gmail connect (should be public)
    console.log('\n🧪 Test 4: Gmail connect...')
    const connectRes = await request(app).get('/api/auth/gmail/connect')
    if (connectRes.status !== 200) {
      throw new Error(`Expected 200, got ${connectRes.status}`)
    }
    console.log('✅ Gmail connect endpoint is public')

    // Test 5: Email endpoints (without auth)
    console.log('\n🧪 Test 5: Email endpoints...')
    const emailsRes = await request(app).get('/api/emails')
    if (emailsRes.status !== 401) {
      throw new Error(`Expected 401, got ${emailsRes.status}`)
    }
    console.log('✅ Email endpoints require authentication')

    // Test 6: Analytics endpoints (without auth)
    console.log('\n🧪 Test 6: Analytics endpoints...')
    const statsRes = await request(app).get('/api/analytics/stats')
    if (statsRes.status !== 401) {
      throw new Error(`Expected 401, got ${statsRes.status}`)
    }
    console.log('✅ Analytics endpoints require authentication')

    console.log('\n🎉 All API endpoint tests passed!')
    console.log('\n📋 Summary:')
    console.log('✅ Health check endpoint')
    console.log('✅ CORS configuration')
    console.log('✅ Auth endpoints (protected)')
    console.log('✅ Gmail connect (public)')
    console.log('✅ Email endpoints (protected)')
    console.log('✅ Analytics endpoints (protected)')
    
  } catch (error) {
    console.error('❌ API test failed:', error.message)
    process.exit(1)
  }
}

runApiTest()
