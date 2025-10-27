/**
 * Pattern Extraction Service
 * Automatically analyzes existing emails to build classification strategies for new categories
 */

import mongoose from 'mongoose'
import Email from '../models/Email.js'
import Category from '../models/Category.js'
import natural from 'natural'

// Initialize natural language processing tools
const { TfIdf } = natural

/**
 * Extract patterns from existing emails to build classification strategy for a new category
 * @param {string} userId - User ID
 * @param {string} categoryName - Name of the new category
 * @param {number} sampleSize - Number of emails to sample for analysis
 * @param {Array} sampleEmailIds - Optional array of specific email IDs to analyze
 * @returns {Promise<Object>} Classification strategy object
 */
export const extractPatternsForCategory = async (userId, categoryName, sampleSize = 1000, sampleEmailIds = []) => {
  try {
    console.log(`🔍 Extracting patterns for category "${categoryName}" with ${sampleSize} samples...`)

    let emailSample = []
    
    if (sampleEmailIds && sampleEmailIds.length > 0) {
      // Use specific sample emails provided by user
      console.log(`📧 Using ${sampleEmailIds.length} user-provided sample emails`)
      emailSample = await Email.find({ 
        _id: { $in: sampleEmailIds },
        userId: new mongoose.Types.ObjectId(userId),
        isDeleted: false 
      })
      .select('subject from to body text snippet labels date attachments category')
    } else {
      // Get a representative sample of emails from all categories
      emailSample = await Email.find({ 
        userId: new mongoose.Types.ObjectId(userId),
        isDeleted: false 
      })
      .limit(sampleSize)
      .select('subject from to body text snippet labels date attachments category')
      .sort({ date: -1 })
    }

    if (emailSample.length === 0) {
      console.log('📧 No emails found for pattern extraction')
      return generateDefaultStrategy(categoryName)
    }

    console.log(`📊 Analyzing ${emailSample.length} emails for patterns...`)

    // Extract patterns from different aspects
    const headerAnalysis = await extractHeaderPatterns(emailSample)
    const bodyAnalysis = await extractBodyPatterns(emailSample)
    const metadataAnalysis = await extractMetadataPatterns(emailSample)
    const tagsAnalysis = await extractTagsPatterns(emailSample)

    // Build classification strategy
    const classificationStrategy = {
      headerAnalysis,
      bodyAnalysis,
      metadataAnalysis,
      tagsAnalysis,
      confidenceThreshold: 0.7,
      extractedAt: new Date(),
      sampleSize: emailSample.length,
      totalCategoriesAnalyzed: [...new Set(emailSample.map(e => e.category))].length
    }

    // Generate pattern rules based on extracted data
    const patterns = await generatePatternRules(emailSample, classificationStrategy)

    console.log(`✅ Pattern extraction completed for category "${categoryName}"`)

    return {
      classificationStrategy,
      patterns
    }

  } catch (error) {
    console.error('❌ Error extracting patterns:', error)
    return generateDefaultStrategy(categoryName)
  }
}

/**
 * Extract patterns from specific sample emails (for user corrections)
 * @param {Array} emailIds - Array of email IDs to analyze
 * @param {string} userId - User ID
 * @returns {Promise<Object>} Classification strategy object
 */
export const extractPatternsFromSamples = async (emailIds, userId) => {
  try {
    console.log(`🔍 Extracting patterns from ${emailIds.length} sample emails...`)

    const emailSample = await Email.find({ 
      _id: { $in: emailIds },
      userId: new mongoose.Types.ObjectId(userId),
      isDeleted: false 
    })
    .select('subject from to body text snippet labels date attachments category')

    if (emailSample.length === 0) {
      console.log('📧 No sample emails found')
      return generateDefaultStrategy('Custom')
    }

    console.log(`📊 Analyzing ${emailSample.length} sample emails for patterns...`)

    // Extract patterns from different aspects
    const headerAnalysis = await extractHeaderPatterns(emailSample)
    const bodyAnalysis = await extractBodyPatterns(emailSample)
    const metadataAnalysis = await extractMetadataPatterns(emailSample)
    const tagsAnalysis = await extractTagsPatterns(emailSample)

    // Build classification strategy
    const classificationStrategy = {
      headerAnalysis,
      bodyAnalysis,
      metadataAnalysis,
      tagsAnalysis,
      confidenceThreshold: 0.7,
      extractedAt: new Date(),
      sampleSize: emailSample.length,
      source: 'user_samples'
    }

    // Generate pattern rules based on extracted data
    const patterns = await generatePatternRules(emailSample, classificationStrategy)

    console.log(`✅ Pattern extraction completed from sample emails`)

    return {
      classificationStrategy,
      patterns
    }

  } catch (error) {
    console.error('❌ Error extracting patterns from samples:', error)
    return generateDefaultStrategy('Custom')
  }
}

/**
 * Extract header patterns (sender domains, subject patterns)
 */
const extractHeaderPatterns = async (emails) => {
  const senderDomains = new Map()
  const senderPatterns = new Map()
  const subjectPatterns = new Map()

  emails.forEach(email => {
    // Extract sender domains
    if (email.from) {
      const domain = email.from.split('@')[1]
      if (domain) {
        senderDomains.set(domain, (senderDomains.get(domain) || 0) + 1)
      }
    }

    // Extract sender email patterns
    const sender = email.from || ''
    senderPatterns.set(sender, (senderPatterns.get(sender) || 0) + 1)

    // Analyze subject patterns
    if (email.subject) {
      const subject = email.subject.toLowerCase()
      // Extract common words and phrases
      const words = subject.split(/\s+/)
      words.forEach(word => {
        if (word.length > 3) { // Filter out short words
          subjectPatterns.set(word, (subjectPatterns.get(word) || 0) + 1)
        }
      })
    }
  })

  return {
    senderDomains: Array.from(senderDomains.entries())
      .sort(([,a], [,b]) => b - a)
      .slice(0, 20)
      .map(([domain]) => domain),
    senderPatterns: Array.from(senderPatterns.entries())
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .map(([pattern]) => pattern),
    subjectPatterns: Array.from(subjectPatterns.entries())
      .sort(([,a], [,b]) => b - a)
      .slice(0, 50)
      .map(([pattern]) => pattern)
  }
}

/**
 * Extract body patterns using TF-IDF
 */
const extractBodyPatterns = async (emails) => {
  const tfidf = new TfIdf()
  const emailsWithContent = emails.filter(email => 
    email.body || email.text || email.snippet
  )

  if (emailsWithContent.length === 0) {
    return {
      keywords: [],
      phrases: [],
      tfidfScores: {}
    }
  }

  // Add documents to TF-IDF
  emailsWithContent.forEach((email, index) => {
    const content = (email.body || email.text || email.snippet || '').toLowerCase()
    if (content.trim()) {
      tfidf.addDocument(content)
    }
  })

  // Extract keywords by calculating TF-IDF scores
  const keywordScores = new Map()
  const phraseScores = new Map()

  emailsWithContent.forEach((email, docIndex) => {
    const content = (email.body || email.text || email.snippet || '').toLowerCase()
    
    if (!content.trim()) return

    // Get top terms for this document
    const terms = tfidf.listTerms(docIndex).slice(0, 20)
    
    terms.forEach(term => {
      if (term.term.length > 3 && term.tfidf > 0.1) {
        keywordScores.set(term.term, (keywordScores.get(term.term) || 0) + term.tfidf)
      }
    })

    // Extract phrases (simple bigram approach)
    const words = content.split(/\s+/)
    for (let i = 0; i < words.length - 1; i++) {
      const phrase = `${words[i]} ${words[i + 1]}`
      if (phrase.length > 6 && phrase.length < 50) {
        phraseScores.set(phrase, (phraseScores.get(phrase) || 0) + 1)
      }
    }
  })

  return {
    keywords: Array.from(keywordScores.entries())
      .sort(([,a], [,b]) => b - a)
      .slice(0, 100)
      .map(([keyword]) => keyword),
    phrases: Array.from(phraseScores.entries())
      .sort(([,a], [,b]) => b - a)
      .slice(0, 50)
      .map(([phrase]) => phrase),
    tfidfScores: Object.fromEntries(
      Array.from(keywordScores.entries())
        .sort(([,a], [,b]) => b - a)
        .slice(0, 200)
    )
  }
}

/**
 * Extract metadata patterns (time, length, etc.)
 */
const extractMetadataPatterns = async (emails) => {
  const hourDistribution = new Map()
  const dayDistribution = new Map()
  const lengthDistribution = new Map()
  const attachmentPatterns = new Map()

  emails.forEach(email => {
    // Analyze time patterns
    if (email.date) {
      const hour = email.date.getHours()
      const day = email.date.getDay()
      
      hourDistribution.set(hour, (hourDistribution.get(hour) || 0) + 1)
      dayDistribution.set(day, (dayDistribution.get(day) || 0) + 1)
    }

    // Analyze content length patterns
    const contentLength = (email.body || email.text || email.snippet || '').length
    const lengthBucket = Math.floor(contentLength / 100) * 100 // Bucket by 100 chars
    lengthDistribution.set(lengthBucket, (lengthDistribution.get(lengthBucket) || 0) + 1)

    // Analyze attachment patterns
    if (email.attachments && email.attachments.length > 0) {
      email.attachments.forEach(attachment => {
        if (attachment.mimeType) {
          const mimeType = attachment.mimeType
          attachmentPatterns.set(mimeType, (attachmentPatterns.get(mimeType) || 0) + 1)
        }
      })
    }
  })

  // Calculate statistics for better classification
  const emailLengths = emails.map(email => 
    (email.body || email.text || email.snippet || '').length
  ).filter(length => length > 0)
  
  const avgLength = emailLengths.length > 0 
    ? emailLengths.reduce((sum, len) => sum + len, 0) / emailLengths.length 
    : 1000

  const [minLength, maxLength] = emailLengths.length > 0
    ? [Math.min(...emailLengths), Math.max(...emailLengths)]
    : [0, 2000]

  return {
    timePatterns: {
      hourDistribution: Object.fromEntries(hourDistribution),
      dayDistribution: Object.fromEntries(dayDistribution),
      peakHours: Array.from(hourDistribution.entries())
        .sort(([,a], [,b]) => b - a)
        .slice(0, 5)
        .map(([hour]) => hour),
      keywords: ['deadline', 'urgent', 'reminder', 'asap', 'tomorrow']
    },
    lengthPatterns: {
      distribution: Object.fromEntries(lengthDistribution),
      averageLength: avgLength,
      minLength: Math.max(0, avgLength - 500),
      maxLength: maxLength + 500,
      typicalRange: [Math.max(0, avgLength - 300), avgLength + 300]
    },
    attachmentPatterns: {
      mimeTypes: Object.fromEntries(attachmentPatterns),
      commonTypes: Array.from(attachmentPatterns.entries())
        .sort(([,a], [,b]) => b - a)
        .slice(0, 10)
        .map(([type]) => type),
      keywords: ['attachment', 'file', 'document', 'pdf', 'attachment']
    }
  }
}

/**
 * Extract tags and entity patterns from emails
 */
const extractTagsPatterns = async (emails) => {
  const tagFrequency = new Map()
  const entityPatterns = new Map()
  const labelPatterns = new Map()

  emails.forEach(email => {
    // Extract from email labels if available
    if (email.labels && Array.isArray(email.labels)) {
      email.labels.forEach(label => {
        const normalizedLabel = label.toLowerCase().trim()
        labelPatterns.set(normalizedLabel, (labelPatterns.get(normalizedLabel) || 0) + 1)
      })
    }

    // Extract potential tags from subject and body
    const fullText = `${email.subject || ''} ${email.body || email.text || email.snippet || ''}`.toLowerCase()
    
    // Common entity patterns (emails, URLs, phone numbers, etc.)
    const emailMatches = fullText.match(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g) || []
    const urlMatches = fullText.match(/\bhttps?:\/\/[^\s]+\b/g) || []
    
    // Count entity occurrences
    emailMatches.forEach(email => {
      entityPatterns.set(`email:${email}`, (entityPatterns.get(`email:${email}`) || 0) + 1)
    })
    
    urlMatches.forEach(url => {
      entityPatterns.set(`url:${url}`, (entityPatterns.get(`url:${url}`) || 0) + 1)
    })

    // Extract common tag patterns (words in brackets, hashtags, etc.)
    const tagMatches = fullText.match(/\[([^\]]+)\]|#(\w+)|@(\w+)/g) || []
    tagMatches.forEach(tag => {
      const cleanTag = tag.replace(/[\[\]#@]/g, '').toLowerCase()
      if (cleanTag.length > 2) {
        tagFrequency.set(cleanTag, (tagFrequency.get(cleanTag) || 0) + 1)
      }
    })

    // Extract organization/company patterns
    const orgPatterns = fullText.match(/\b(inc|corp|ltd|llc|co|org|university|college)\b/g) || []
    orgPatterns.forEach(org => {
      tagFrequency.set(`org:${org}`, (tagFrequency.get(`org:${org}`) || 0) + 1)
    })
  })

  return {
    commonTags: Array.from(tagFrequency.entries())
      .sort(([,a], [,b]) => b - a)
      .slice(0, 50)
      .map(([tag]) => tag),
    
    labelPatterns: Array.from(labelPatterns.entries())
      .sort(([,a], [,b]) => b - a)
      .slice(0, 20)
      .map(([label]) => label),
      
    entityPatterns: {
      emails: Array.from(entityPatterns.entries())
        .filter(([key]) => key.startsWith('email:'))
        .slice(0, 10)
        .map(([key]) => key.replace('email:', '')),
      urls: Array.from(entityPatterns.entries())
        .filter(([key]) => key.startsWith('url:'))
        .slice(0, 10)
        .map(([key]) => key.replace('url:', '')),
      keywords: ['@mention', '[tag]', '#hashtag', 'organization', 'company']
    },
    
    confidenceThresholds: {
      tagMatch: 0.85,
      entityMatch: 0.90,
      labelMatch: 0.80
    }
  }
}

/**
 * Generate pattern rules for classification
 */
const generatePatternRules = async (emails, strategy) => {
  const rules = []

  // Header-based rules
  strategy.headerAnalysis.senderDomains.slice(0, 10).forEach(domain => {
    rules.push({
      field: 'from',
      pattern: `@${domain.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`,
      confidence: Math.min(0.8, 0.3 + (domain ? 0.5 : 0)),
      type: 'regex'
    })
  })

  strategy.headerAnalysis.subjectPatterns.slice(0, 20).forEach(pattern => {
    if (pattern.length > 4) {
      rules.push({
        field: 'subject',
        pattern: pattern.toLowerCase(),
        confidence: 0.4,
        type: 'contains'
      })
    }
  })

  // Body-based rules
  strategy.bodyAnalysis.keywords.slice(0, 30).forEach(keyword => {
    rules.push({
      field: 'body',
      pattern: keyword.toLowerCase(),
      confidence: 0.3,
      type: 'contains'
    })
  })

  strategy.bodyAnalysis.phrases.slice(0, 15).forEach(phrase => {
    rules.push({
      field: 'body',
      pattern: phrase.toLowerCase(),
      confidence: 0.5,
      type: 'contains'
    })
  })

  return {
    extractedAt: new Date(),
    sampleSize: emails.length,
    rules: rules
  }
}

/**
 * Generate default strategy when no patterns can be extracted
 */
const generateDefaultStrategy = (categoryName) => {
  return {
    classificationStrategy: {
      headerAnalysis: {
        senderDomains: [],
        senderPatterns: [],
        subjectPatterns: []
      },
      bodyAnalysis: {
        keywords: [categoryName.toLowerCase()],
        phrases: [],
        tfidfScores: {}
      },
      metadataAnalysis: {
        timePatterns: {},
        lengthPatterns: { averageLength: 0 },
        attachmentPatterns: { mimeTypes: {}, commonTypes: [] }
      },
      confidenceThreshold: 0.6
    },
    patterns: {
      extractedAt: new Date(),
      sampleSize: 0,
      rules: [{
        field: 'subject',
        pattern: categoryName.toLowerCase(),
        confidence: 0.5,
        type: 'contains'
      }]
    }
  }
}

export default {
  extractPatternsForCategory
}
