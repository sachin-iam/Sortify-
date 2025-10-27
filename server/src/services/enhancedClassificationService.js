// Enhanced Email Classification Service with Ensemble Support
// Integrates ensemble model with comprehensive feature extraction

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
 * Check ML service health with caching and ensemble support
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
 * Check if ensemble service is available
 */
const checkEnsembleServiceHealth = async () => {
  try {
    const response = await axios.get(`${ML_SERVICE_BASE_URL}/status`, { 
      timeout: 5000 
    })
    
    // Check if the response indicates ensemble support
    const hasEnsemble = response.data && (
      response.data.ensemble_info || 
      response.data.features?.includes('ensemble') ||
      response.status === 200
    )
    
    return {
      available: hasEnsemble,
      healthy: response.status === 200
    }
  } catch (error) {
    return {
      available: false,
      healthy: false,
      error: error.message
    }
  }
}

/**
 * Enhanced email classification using ensemble approach
 */
export const classifyEmailWithEnsemble = async (subject, snippet, body, userId, emailData = {}) => {
  try {
    console.log('🤖 Using ensemble classification...')
    
    // Check ensemble service health
    const ensembleHealth = await checkEnsembleServiceHealth()
    if (!ensembleHealth.available) {
      console.log('⚠️ Ensemble service not available, falling back to DistilBERT')
      return await classifyEmailWithDistilBERT(subject, snippet, body)
    }
    
    // Prepare comprehensive email data for ensemble classification
    const ensembleRequest = {
      subject: subject || '',
      body: `${snippet || ''} ${body || ''}`.trim(),
      html: emailData.html || emailData.enhancedMetadata?.html || '',
      from_addr: emailData.from || '',
      to_addr: emailData.to || '',
      date: emailData.date ? new Date(emailData.date).toISOString() : null,
      attachments: emailData.attachments || [],
      headers: emailData.enhancedMetadata?.headers || emailData.headers || {},
      user_id: userId
    }
    
    const response = await axios.post(`${ML_SERVICE_BASE_URL}/predict/ensemble`, ensembleRequest, {
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json'
      }
    })

    if (response.data && response.data.label) {
      const prediction = response.data
      console.log(`🤖 Ensemble Classification: "${subject}" -> ${prediction.label} (${prediction.confidence})`)
      
      // Extract feature information for storage
      const extractedFeatures = {
        senderDomain: emailData.enhancedMetadata?.senderDomain || extractDomain(emailData.from || ''),
        attachmentCount: emailData.attachments?.length || 0,
        attachmentTypes: emailData.attachments?.map(att => getFileExtension(att.filename)) || [],
        linkCount: emailData.enhancedMetadata?.urlCount || 0,
        hasExternalLinks: emailData.enhancedMetadata?.hasExternalLinks || false,
        textLength: (subject || '').length + (body || '').length + (snippet || '').length,
        htmlRatio: emailData.html ? emailData.html.length / Math.max(emailData.body?.length || 1, 1) : 0,
        timeOfDay: emailData.date ? new Date(emailData.date).getHours() : 12,
        recipientCount: emailData.enhancedMetadata?.recipientCount || 1,
        subjectLength: (subject || '').length,
        businessKeywords: countKeywords(subject + ' ' + body, ['invoice', 'payment', 'order', 'billing']),
        academicKeywords: countKeywords(subject + ' ' + body, ['assignment', 'course', 'university', 'research']),
        jobKeywords: countKeywords(subject + ' ' + body, ['job', 'career', 'hiring', 'interview'])
      }
      
      return {
        label: prediction.label,
        confidence: prediction.confidence,
        scores: prediction.scores || {},
        model: 'ensemble',
        ensembleScores: prediction.ensembleScores || {},
        featureContributions: prediction.featureContributions || {},
        extractedFeatures,
        enhancedMetadata: emailData.enhancedMetadata
      }
    } else {
      throw new Error('Invalid response from ensemble model')
    }
  } catch (error) {
    console.error('❌ Ensemble classification error:', error.message)
    
    // Fallback to DistilBERT if ensemble fails
    console.log('🔄 Falling back to DistilBERT classification...')
    try {
      const fallbackResult = await classifyEmailWithDistilBERT(subject, snippet, body)
      return {
        ...fallbackResult,
        model: 'fallback-ensemble',
        error: error.message
      }
    } catch (fallbackError) {
      console.error('❌ Fallback classification also failed:', fallbackError.message)
      return {
        label: 'Other',
        confidence: 0.5,
        scores: {},
        model: 'fallback',
        error: error.message
      }
    }
  }
}

/**
 * Helper function to extract domain from email address
 */
const extractDomain = (emailAddress) => {
  if (!emailAddress) return 'unknown'
  
  const emailRegex = /<([^>]+)>|^([^\s<>]+@[^\s<>]+)/
  const match = emailAddress.match(emailRegex)
  
  if (match) {
    const email = match[1] || match[2]
    if (email && email.includes('@')) {
      return email.split('@')[1].toLowerCase()
    }
  }
  
  return 'unknown'
}

/**
 * Helper function to get file extension
 */
const getFileExtension = (filename) => {
  if (!filename) return ''
  const lastDot = filename.lastIndexOf('.')
  return lastDot > 0 ? filename.substring(lastDot) : ''
}

/**
 * Helper function to count keywords in text
 */
const countKeywords = (text, keywords) => {
  if (!text) return 0
  const lowerText = text.toLowerCase()
  return keywords.reduce((count, keyword) => {
    return count + (lowerText.includes(keyword.toLowerCase()) ? 1 : 0)
  }, 0)
}

/**
 * Enhanced email classification with automatic feature extraction
 */
export const classifyEmail = async (subject, snippet, body, userId = null, emailData = {}) => {
  try {
    // Check if we have enhanced metadata for ensemble classification
    const hasEnhancedData = emailData.enhancedMetadata || 
                           emailData.attachments?.length > 0 || 
                           emailData.from || 
                           emailData.html
    
    if (hasEnhancedData) {
      console.log('📊 Enhanced data available, using ensemble classification')
      return await classifyEmailWithEnsemble(subject, snippet, body, userId, emailData)
    }
    
    // Fallback to standard classification
    console.log('📝 Using standard classification')
    
    // Check ML service health first
    const isHealthy = await checkMLServiceHealth()
    if (isHealthy) {
      try {
        return await classifyEmailWithDynamicML(subject, snippet, body, userId)
      } catch (error) {
        console.log('⚠️ Dynamic ML failed, trying DistilBERT...')
      }
    }
    
    // Try DistilBERT
    try {
      return await classifyEmailWithDistilBERT(subject, snippet, body)
    } catch (error) {
      console.log('⚠️ DistilBERT failed, using keyword fallback...')
    }
    
    // Final fallback to keyword-based classification
    return await mlClassifyEmail(subject, snippet, body)
    
  } catch (error) {
    console.error('❌ All classification methods failed:', error.message)
    return {
      label: 'Other',
      confidence: 0.3,
      scores: {},
      model: 'fallback',
      error: error.message
    }
  }
}

/**
 * Classify email using the Python ML service with dynamic categories (enhanced)
 */
const classifyEmailWithDynamicML = async (subject, snippet, body, userId) => {
  try {
    console.log('🤖 Using Python ML service for dynamic classification...')
    
    // Check ML service health first
    const isHealthy = await checkMLServiceHealth()
    if (!isHealthy) {
      throw new Error('ML service is not healthy')
    }
    
    const response = await axios.post(`${ML_SERVICE_BASE_URL}/predict`, {
      subject: subject || '',
      body: `${snippet || ''} ${body || ''}`.trim(),
      user_id: userId
    }, { 
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json'
      }
    })

    if (response.data && response.data.label) {
      const prediction = response.data
      console.log(`🤖 Dynamic ML Classification: "${subject}" -> ${prediction.label} (${prediction.confidence})`)
      
      return {
        label: prediction.label,
        confidence: prediction.confidence,
        scores: prediction.scores || {},
        model: 'dynamic-ml'
      }
    } else {
      throw new Error('Invalid response from dynamic ML model')
    }
  } catch (error) {
    console.error('❌ Dynamic ML classification error:', error.message)
    throw error
  }
}

/**
 * Enhanced batch classification with ensemble support
 */
export const classifyEmailsWithEnsemble = async (emails, userId = null) => {
  try {
    console.log(`🤖 Batch classifying ${emails.length} emails with ensemble...`)
    
    // Check if any emails have enhanced data for ensemble classification
    const hasEnhancedData = emails.some(email => 
      email.enhancedMetadata || 
      email.attachments?.length > 0 || 
      email.html
    )
    
    if (hasEnhancedData) {
      // Use ensemble for enhanced emails, fallback for others
      const results = []
      
      for (const email of emails) {
        try {
          const classification = await classifyEmail(
            email.subject, 
            email.snippet, 
            email.body || email.text,
            userId,
            email
          )
          
          results.push({
            ...email,
            category: classification.label,
            classification: {
              label: classification.label,
              confidence: classification.confidence,
              scores: classification.scores,
              model: classification.model,
              ensembleScores: classification.ensembleScores,
              featureContributions: classification.featureContributions
            },
            extractedFeatures: classification.extractedFeatures,
            enhancedMetadata: email.enhancedMetadata || classification.enhancedMetadata
          })
        } catch (error) {
          console.error(`❌ Individual classification failed for email: ${email.subject}`)
          results.push({
            ...email,
            category: 'Other',
            classification: {
              label: 'Other',
              confidence: 0.5,
              scores: {},
              model: 'fallback'
            }
          })
        }
      }
      
      return results
    } else {
      // Fallback to standard batch classification
      const response = await axios.post(`${ML_SERVICE_BASE_URL}/predict/batch`, {
        emails: emails.map(email => ({
          subject: email.subject || '',
          body: `${email.snippet || ''} ${email.body || email.text || ''}`.trim()
        }))
      }, { 
        timeout: 30000,
        headers: {
          'Content-Type': 'application/json'
        }
      })

      if (response.data && Array.isArray(response.data)) {
        const results = []
        
        for (let i = 0; i < emails.length; i++) {
          const email = emails[i]
          const prediction = response.data[i]
          
          if (prediction) {
            results.push({
              ...email,
              category: prediction.label,
              classification: {
                label: prediction.label,
                confidence: prediction.confidence,
                scores: prediction.scores || {},
                model: 'batch-distilbert'
              }
            })
          } else {
            results.push({
              ...email,
              category: 'Other',
              classification: {
                label: 'Other',
                confidence: 0.5,
                scores: {},
                model: 'fallback'
              }
            })
          }
        }
        
        return results
      } else {
        throw new Error('Invalid batch response from ensemble model')
      }
    }
  } catch (error) {
    console.error('❌ Ensemble batch classification error:', error.message)
    
    // Fallback to individual classification
    console.log('🔄 Falling back to individual classification...')
    const results = []
    
    for (const email of emails) {
      try {
        const classification = await classifyEmail(
          email.subject, 
          email.snippet, 
          email.body || email.text,
          userId,
          email
        )
        
        results.push({
          ...email,
          category: classification.label,
          classification: {
            label: classification.label,
            confidence: classification.confidence,
            scores: classification.scores,
            model: classification.model
          }
        })
      } catch (error) {
        console.error(`❌ Fallback classification failed for email: ${email.subject}`)
        results.push({
          ...email,
          category: 'Other',
          classification: {
            label: 'Other',
            confidence: 0.5,
            scores: {},
            model: 'fallback'
          }
        })
      }
    }
    
    return results
  }
}

/**
 * Get ensemble model metrics
 */
export const getEnsembleMetrics = async () => {
  try {
    const response = await axios.get(`${ML_SERVICE_BASE_URL}/performance`, { timeout: 5000 })
    return {
      success: true,
      metrics: response.data
    }
  } catch (error) {
    console.error('❌ Failed to fetch ensemble metrics:', error.message)
    return {
      success: false,
      error: error.message,
      metrics: null
    }
  }
}

// Export legacy functions for backward compatibility
export {
  classifyEmailWithDistilBERT,
  classifyEmailsWithDistilBERT,
  testDistilBERTConnection
}
