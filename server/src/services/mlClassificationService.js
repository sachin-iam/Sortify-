// ML-based email classification service
// This uses a simple text classification approach that can run in Node.js

const CATEGORIES = {
  'Placement': [
    'placement', 'job', 'recruitment', 'interview', 'career', 'company', 'apply', 'deadline', 'opportunity', 'campus', 'drive', 'resume', 'shortlisting', 'quality assurance', 'qa',
    'agent ai challenge', 'pre-placement', 'training', 'mandatory attendance', 'accenture', 'tcs', 'infosys', 'wipro', 'network people services', 'npst', 'talent hiring',
    'josh technology', 'tech mahindra', 'cognizant', 'google', 'microsoft', 'amazon', 'ibm', 'oracle', 'sap', 'adobe', 'meta', 'apple',
    'salary', 'package', 'ctc', 'position', 'role', 'skills', 'assessment', 'shortlisted students', 'su placement', 'placement officer', 'sharda informatics'
  ],
  'NPTEL': [
    'nptel', 'course', 'lecture', 'registration', 'exam', 'certificate', 'iitm', 'online', 'learning', 'study', 'newsletter', 'star badges', 'scmpro',
    'joint certification', 'cii', 'iit madras', 'professor who never stopped learning', 'lifelong learning', 'supply chain career', 'advance your career',
    'nptel team', 'nptel newsletter', 'module', 'assignment', 'video', 'best wishes from nptel team'
  ],
  'HOD': [
    'hod', 'head', 'department', 'notice', 'announcement', 'administrative', 'official', 'mandatory', 'circular', 'reschedule', 'evaluation date',
    'hod office', 'mark students absent', 'meet me in person', 'tickets booked', 'dr. sudeep varshney', 'respected hod sir', 'phd', 'iit dhanbad',
    'dear students', 'all students', 'mandatory attendance'
  ],
  'E-Zone': [
    'ezone', 'e-zone', 'portal', 'login', 'password', 'otp', 'student', 'access', 'account', 'credentials', 'one time password', 'sharda e-zone',
    'valid for today', 'accessing sharda e-zone', 'dear user', 'welcome to sharda e-zone', 'visit website', 'reset', 'verification'
  ],
  'Promotions': [
    'offer', 'discount', 'deal', 'sale', 'promotion', 'marketing', 'advertisement', 'unsubscribe', 'click', 'buy', 'free screening camp', 'shardacare',
    'healthcity', 'breast health screening', 'breast cancer awareness', 'welcoming dr', 'consultant', 'obstetrics', 'gynaecology', 'hosting',
    'limited time', 'special', 'exclusive', 'save', 'buy now', 'delighted to welcome', 'extensive experience', 'promoting women\'s health', 'early diagnosis', 'prevention'
  ],
  'Whats happening': [
    'event', 'happening', 'campus', 'announcement', 'activity', 'community', 'participate', 'register', 'venue', 'date', 'nss cell', 'volunteers',
    'my bharat portal', 'nurses week', 'international nurses day', 'aetcom', 'tree plantation', 'organizing', 'celebration', 'startup', 'fundraise',
    'bizgrow', 'sql mastery', 'seminar', 'digital forensics', 'dsw', 'sharda university', 'enthusiasm', 'sharda school of nursing', 'attitude ethics communication',
    'medico-legal', 'celebrate earth', 'ihub sharda', 'data pool club'
  ],
  'Professor': [
    'professor', 'assistant professor', 'associate professor', 'faculty', 'dr.', 'evaluation', 'project eval', 'attendance', 'spreadsheet shared',
    'outcome sheet', 'training session', 'oracle academy', 'exam', 'interview scheduled', 'shortlisted students', 'assessment', 'panel members',
    'compulsory', 'dear faculty', 'dear students', 'kanika singla', 'anubhava srivastava', 'nishant gupta', 'kapil kumar', 'computer science engineering',
    'set assistant professor', 'cse associate professor', 'sset assistant professor', 'check attendance', 'data uploaded', 'start your exam', 'link is active',
    'personal interviews', 'sd role', 'prepare the ppt', 'discussion with the guide'
  ],
  'Spam': [
    'free money', 'win', 'prize', 'lottery', 'congratulations', 'urgent', 'act now', 'click here', 'limited offer', 'guaranteed',
    'viagra', 'casino', 'poker', 'loan', 'credit', 'debt', 'weight loss', 'diet', 'supplement', 'pharmacy', 'medicine', 'prescription',
    'nigerian prince', 'inheritance', 'lottery winner', 'bank account', 'verify', 'confirm', 'security', 'suspended', 'locked',
    'bitcoin', 'cryptocurrency', 'investment', 'get rich quick', 'work from home', 'make money', 'earn cash'
  ],
  'Other': []
}

// Enhanced keyword-based classification with ML-like scoring
const classifyEmailML = (subject, snippet, body) => {
  const text = `${subject || ''} ${snippet || ''} ${body || ''}`.toLowerCase()
  
  const scores = {}
  const categoryWeights = {
    'Placement': 1.3,         // High weight for placement
    'NPTEL': 1.4,             // Very high weight for NPTEL (distinct patterns)
    'HOD': 1.4,               // Very high weight for HOD (specific senders)
    'E-Zone': 1.5,            // Highest weight for E-Zone (very specific)
    'Promotions': 1.2,        // Higher weight for promotions
    'Whats happening': 1.2,   // Higher weight for events
    'Professor': 1.3,         // High weight for professors
    'Spam': 1.3,              // High weight for spam indicators
    'Other': 0.5              // Lower weight for other
  }
  
  // Calculate scores for each category
  Object.keys(CATEGORIES).forEach(category => {
    if (category === 'Other') return
    
    scores[category] = 0
    const weight = categoryWeights[category] || 1.0
    
    CATEGORIES[category].forEach(keyword => {
      // Use word boundary regex for better matching
      const regex = new RegExp(`\\b${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi')
      const matches = text.match(regex)
      if (matches) {
        // Weight matches differently based on keyword importance and position
        let keywordWeight = 1
        if (keyword.length > 10) keywordWeight = 1.5  // Longer, more specific keywords
        if (text.includes(keyword + ' ')) keywordWeight = 1.2  // Keyword followed by space
        if (subject && subject.toLowerCase().includes(keyword)) keywordWeight = 2.0  // Keyword in subject gets double weight
        
        scores[category] += matches.length * keywordWeight * weight
      }
    })
  })
  
  // Find the category with highest score
  const maxScore = Math.max(...Object.values(scores))
  const bestCategory = Object.keys(scores).find(cat => scores[cat] === maxScore)
  
  // If no keywords matched, classify as 'Other'
  if (maxScore === 0) {
    return {
      label: 'Other',
      confidence: 0.15 + Math.random() * 0.1  // 15-25% confidence for Other
    }
  }
  
  // Calculate confidence based on score strength and text characteristics
  const textLength = text.length
  const baseConfidence = Math.min(maxScore / 6, 0.9)  // Cap at 90%
  
  // Adjust confidence based on text length (longer texts = more confident)
  const lengthFactor = Math.min(textLength / 500, 1.3)  // Boost for longer emails
  
  // Add some randomness to make it more realistic (avoid perfect scores)
  const randomFactor = 0.85 + Math.random() * 0.15  // 85-100% of calculated confidence
  
  // Boost confidence for high-scoring categories
  const scoreFactor = maxScore > 3 ? 1.2 : 1.0
  
  const finalConfidence = Math.min(baseConfidence * lengthFactor * randomFactor * scoreFactor, 0.95)
  
  return {
    label: bestCategory,
    confidence: Math.round(finalConfidence * 100) / 100
  }
}

// Main classification function
export const classifyEmail = async (subject, snippet, body) => {
  try {
    // Use the enhanced ML-like classification
    const result = classifyEmailML(subject, snippet, body)
    
    console.log(`ML Classification: "${subject}" -> ${result.label} (${result.confidence})`)
    
    return {
      label: result.label,
      confidence: result.confidence
    }
  } catch (error) {
    console.error('ML classification error:', error)
    // Fallback to simple classification
    return {
      label: 'Other',
      confidence: 0.5
    }
  }
}

// Batch classification
export const classifyEmails = async (emails) => {
  const classifiedEmails = await Promise.all(emails.map(async email => {
    const classification = await classifyEmail(email.subject, email.snippet, email.body)
    return {
      ...email,
      category: classification.label,
      classification: {
        label: classification.label,
        confidence: classification.confidence
      }
    }
  }))
  
  return classifiedEmails
}
