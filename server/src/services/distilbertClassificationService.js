// DistilBERT model classification service
// This service integrates with the actual DistilBERT model running on port 8000

import axios from 'axios'

const DISTILBERT_API_URL = process.env.MODEL_SERVICE_URL || 'http://localhost:8000'

// Test the DistilBERT model connection
export const testDistilBERTConnection = async () => {
  try {
    const response = await axios.get(`${DISTILBERT_API_URL}/health`, { timeout: 5000 })
    return {
      connected: true,
      status: response.data.status,
      modelLoaded: response.data.model_loaded,
      categoriesCount: response.data.categories_count
    }
  } catch (error) {
    console.error('❌ DistilBERT model connection failed:', error.message)
    return {
      connected: false,
      error: error.message
    }
  }
}

// Get available categories from DistilBERT model
export const getDistilBERTCategories = async () => {
  try {
    const response = await axios.get(`${DISTILBERT_API_URL}/categories`, { timeout: 5000 })
    return {
      success: true,
      categories: response.data
    }
  } catch (error) {
    console.error('❌ Failed to fetch DistilBERT categories:', error.message)
    return {
      success: false,
      error: error.message,
      categories: []
    }
  }
}

// Classify a single email using DistilBERT model
export const classifyEmailWithDistilBERT = async (subject, snippet, body) => {
  try {
    console.log('🤖 Using DistilBERT model for classification...')
    
    const response = await axios.post(`${DISTILBERT_API_URL}/predict`, {
      subject: subject || '',
      body: `${snippet || ''} ${body || ''}`.trim()
    }, { 
      timeout: 30000, // Increased timeout for DistilBERT model
      headers: {
        'Content-Type': 'application/json'
      }
    })

    if (response.data && response.data.label) {
      const prediction = response.data
      console.log(`🤖 DistilBERT Classification: "${subject}" -> ${prediction.label} (${prediction.confidence})`)
      
      return {
        label: prediction.label,
        confidence: prediction.confidence,
        scores: prediction.scores || {},
        model: 'distilbert'
      }
    } else {
      throw new Error('Invalid response from DistilBERT model')
    }
  } catch (error) {
    console.error('❌ DistilBERT classification error:', error.message)
    
    // Fallback to 'Other' category if DistilBERT fails
    return {
      label: 'Other',
      confidence: 0.5,
      scores: {},
      model: 'fallback',
      error: error.message
    }
  }
}

// Classify multiple emails using DistilBERT model
export const classifyEmailsWithDistilBERT = async (emails) => {
  try {
    console.log(`🤖 Batch classifying ${emails.length} emails with DistilBERT...`)
    
    const response = await axios.post(`${DISTILBERT_API_URL}/predict/batch`, {
      emails: emails.map(email => ({
        subject: email.subject || '',
        body: `${email.snippet || ''} ${email.body || email.text || ''}`.trim()
      }))
    }, { 
      timeout: 30000, // Longer timeout for batch processing
      headers: {
        'Content-Type': 'application/json'
      }
    })

    if (response.data && response.data.predictions) {
      const results = []
      
      for (let i = 0; i < emails.length; i++) {
        const email = emails[i]
        const prediction = response.data.predictions[i]
        
        if (prediction) {
          results.push({
            ...email,
            category: prediction.label,
            classification: {
              label: prediction.label,
              confidence: prediction.confidence,
              scores: prediction.scores || {},
              model: 'distilbert'
            }
          })
        } else {
          // Fallback for failed predictions
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
      
      console.log(`✅ DistilBERT batch classification completed: ${results.length} emails processed`)
      return results
    } else {
      throw new Error('Invalid batch response from DistilBERT model')
    }
  } catch (error) {
    console.error('❌ DistilBERT batch classification error:', error.message)
    
    // Fallback to individual classification
    console.log('🔄 Falling back to individual DistilBERT classification...')
    const results = []
    
    for (const email of emails) {
      try {
        const classification = await classifyEmailWithDistilBERT(
          email.subject, 
          email.snippet, 
          email.body || email.text
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
      } catch (individualError) {
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
  }
}

// Get model metrics from DistilBERT
export const getDistilBERTMetrics = async () => {
  try {
    const response = await axios.get(`${DISTILBERT_API_URL}/metrics`, { timeout: 5000 })
    return {
      success: true,
      metrics: response.data
    }
  } catch (error) {
    console.error('❌ Failed to fetch DistilBERT metrics:', error.message)
    return {
      success: false,
      error: error.message,
      metrics: null
    }
  }
}
