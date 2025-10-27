// Enhanced email classification service
// This now uses the real DistilBERT model with fallback to keyword-based classification

import { 
  classifyEmailWithDistilBERT, 
  classifyEmailsWithDistilBERT,
  testDistilBERTConnection 
} from './distilbertClassificationService.js'
import { classifyEmail as mlClassifyEmail, classifyEmails as mlClassifyEmails } from './enhancedMLService.js'
import notificationService from './notificationService.js'
import Category from '../models/Category.js'
import mongoose from 'mongoose'
import axios from 'axios'

const ML_SERVICE_BASE_URL = process.env.ML_SERVICE_URL || 'http://localhost:8000'

// Health check cache
let mlServiceHealthCache = {
  isHealthy: true,
  lastCheck: 0,
  checkInterval: 60000 // Check every minute
}

/**
 * Check ML service health with caching
 */
const checkMLServiceHealth = async () => {
  const now = Date.now()
  
  // Return cached result if recent enough
  if (now - mlServiceHealthCache.lastCheck < mlServiceHealthCache.checkInterval) {
    return mlServiceHealthCache.isHealthy
  }
  
  try {
    const response = await axios.get(`${ML_SERVICE_BASE_URL}/status`, { 
      timeout: 5000 
    })
    
    mlServiceHealthCache.isHealthy = response.status === 200 && 
      response.data && 
      response.data.status === 'ready'
    mlServiceHealthCache.lastCheck = now
    
    console.log(`🔍 ML Service Health Check: ${mlServiceHealthCache.isHealthy ? 'HEALTHY' : 'UNHEALTHY'}`)
    return mlServiceHealthCache.isHealthy
  } catch (error) {
    console.log('🔍 ML Service Health Check: UNHEALTHY -', error.message)
    mlServiceHealthCache.isHealthy = false
    mlServiceHealthCache.lastCheck = now
    return false
  }
}

/**
 * Retry utility function with exponential backoff
 */
const retryWithBackoff = async (fn, maxRetries = 2, baseDelay = 1000) => {
  let lastError
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error
      
      if (attempt === maxRetries) {
        throw error
      }
      
      // Only retry on network errors or 5xx responses
      const shouldRetry = error.code === 'ECONNREFUSED' || 
                         error.code === 'ETIMEDOUT' || 
                         (error.response && error.response.status >= 500)
      
      if (!shouldRetry) {
        throw error
      }
      
      const delay = baseDelay * Math.pow(2, attempt)
      console.log(`🔄 Retry attempt ${attempt + 1}/${maxRetries + 1} in ${delay}ms...`)
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }
  
  throw lastError
}

/**
 * Classify email using the Python ML service with dynamic categories
 */
const classifyEmailWithDynamicML = async (subject, snippet, body, userId) => {
  try {
    console.log('🤖 Using Python ML service for dynamic classification...')
    
    // Check ML service health first
    const isHealthy = await checkMLServiceHealth()
    if (!isHealthy) {
      throw new Error('ML service is not healthy')
    }
    
    // Use retry logic for the request
    const response = await retryWithBackoff(async () => {
      return await axios.post(`${ML_SERVICE_BASE_URL}/predict`, {
        subject: subject || '',
        body: `${snippet || ''} ${body || ''}`.trim(),
        user_id: userId
      }, { 
        timeout: 10000,
        headers: {
          'Content-Type': 'application/json'
        }
      })
    })

    if (response.data && response.data.label) {
      console.log(`✅ Dynamic ML Classification: "${subject}" -> ${response.data.label} (${response.data.confidence})`)
      
      return {
        label: response.data.label,
        confidence: response.data.confidence,
        model: 'dynamic-ml'
      }
    } else {
      throw new Error('Invalid response from ML service')
    }
  } catch (error) {
    console.error('❌ Dynamic ML classification error:', error.message)
    throw error
  }
}

// Main classification function - now prioritizes dynamic ML service when userId is provided
export const classifyEmail = async (subject, snippet, body, userId = null) => {
  try {
    // First, if userId is provided, try the dynamic ML service (includes user's custom categories)
    if (userId) {
      try {
        console.log('🤖 Attempting dynamic ML classification for user categories...')
        const dynamicResult = await classifyEmailWithDynamicML(subject, snippet, body, userId)
        
        console.log(`✅ Dynamic ML Classification: "${subject}" -> ${dynamicResult.label} (${dynamicResult.confidence})`)
        
        // Send notification if user ID is provided
        if (dynamicResult.label) {
          notificationService.sendClassificationNotification(userId, {
            emailId: 'temp',
            category: dynamicResult.label,
            confidence: dynamicResult.confidence
          })
        }
        
        return dynamicResult
      } catch (dynamicError) {
        console.log('🔄 Dynamic ML failed, trying DistilBERT...', dynamicError.message)
      }
    }
    
    // Try to use the DistilBERT model
    console.log('🤖 Attempting DistilBERT classification...')
    const distilbertResult = await classifyEmailWithDistilBERT(subject, snippet, body)
    
    if (distilbertResult.model === 'distilbert') {
      console.log(`✅ DistilBERT Classification: "${subject}" -> ${distilbertResult.label} (${distilbertResult.confidence})`)
      
      // Send notification if user ID is provided
      if (userId && distilbertResult.label) {
        notificationService.sendClassificationNotification(userId, {
          emailId: 'temp',
          category: distilbertResult.label,
          confidence: distilbertResult.confidence
        })
      }
      
      return {
        label: distilbertResult.label,
        confidence: distilbertResult.confidence,
        model: 'distilbert'
      }
    } else {
      // Fallback to keyword-based classification
      console.log('🔄 DistilBERT failed, falling back to keyword-based classification...')
      const fallbackResult = await mlClassifyEmail(subject, snippet, body)
      
      console.log(`🔄 Fallback Classification: "${subject}" -> ${fallbackResult.label} (${fallbackResult.confidence})`)
      
      // Send notification if user ID is provided
      if (userId && fallbackResult.label) {
        notificationService.sendClassificationNotification(userId, {
          emailId: 'temp',
          category: fallbackResult.label,
          confidence: fallbackResult.confidence
        })
      }
      
      return {
        label: fallbackResult.label,
        confidence: fallbackResult.confidence,
        model: 'fallback'
      }
    }
  } catch (error) {
    console.error('❌ Classification error:', error)
    // Final fallback to simple classification
    return {
      label: 'Other',
      confidence: 0.5,
      model: 'error-fallback'
    }
  }
}

export const classifyEmails = async (emails, userId = null) => {
  try {
    // First, try to use DistilBERT for batch processing
    console.log(`🤖 Attempting DistilBERT batch classification for ${emails.length} emails...`)
    const distilbertResults = await classifyEmailsWithDistilBERT(emails)
    
    if (distilbertResults && distilbertResults.length > 0) {
      console.log(`✅ DistilBERT batch classification completed: ${distilbertResults.length} emails processed`)
      return distilbertResults
    } else {
      throw new Error('DistilBERT batch classification returned empty results')
    }
  } catch (error) {
    console.error('❌ DistilBERT batch classification error:', error)
    console.log('🔄 Falling back to keyword-based batch classification...')
    
    try {
      // Fallback to keyword-based batch processing
      return await mlClassifyEmails(emails)
    } catch (fallbackError) {
      console.error('❌ Keyword-based batch classification error:', fallbackError)
      console.log('🔄 Falling back to individual classification...')
      
      // Final fallback to individual classification
      const classifiedEmails = await Promise.all(emails.map(async email => {
        const classification = await classifyEmail(email.subject, email.snippet, email.body, userId)
    return {
      ...email,
      category: classification.label,
      classification: {
        label: classification.label,
            confidence: classification.confidence,
            model: classification.model || 'individual-fallback'
      }
    }
      }))
  
  return classifiedEmails
    }
  }
}

/**
 * Get ML service health status (exported for use by other services)
 */
export const getMLServiceHealth = async () => {
  const isHealthy = await checkMLServiceHealth()
  return {
    isHealthy,
    lastCheck: mlServiceHealthCache.lastCheck,
    serviceUrl: ML_SERVICE_BASE_URL
  }
}
