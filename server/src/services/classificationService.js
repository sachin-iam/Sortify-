// Enhanced email classification service
// This now uses the real DistilBERT model with fallback to keyword-based classification

import { 
  classifyEmailWithDistilBERT, 
  classifyEmailsWithDistilBERT,
  testDistilBERTConnection 
} from './distilbertClassificationService.js'
import { classifyEmail as mlClassifyEmail, classifyEmails as mlClassifyEmails } from './enhancedMLService.js'
import notificationService from './notificationService.js'

// Main classification function - now uses DistilBERT model with fallback
export const classifyEmail = async (subject, snippet, body, userId = null) => {
  try {
    // First, try to use the DistilBERT model
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

export const classifyEmails = async (emails) => {
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
        const classification = await classifyEmail(email.subject, email.snippet, email.body)
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
