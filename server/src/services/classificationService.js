// Simple email classification service
// This uses keyword-based classification as a fallback

const CATEGORIES = {
  'Academic': ['assignment', 'homework', 'exam', 'quiz', 'grade', 'course', 'professor', 'university', 'college', 'student', 'academic', 'study', 'research', 'thesis', 'dissertation'],
  'Promotions': ['sale', 'discount', 'offer', 'deal', 'promo', 'coupon', 'buy', 'purchase', 'shop', 'store', 'shopping', 'advertisement', 'marketing', 'newsletter'],
  'Placement': ['job', 'career', 'interview', 'hiring', 'recruitment', 'position', 'opportunity', 'resume', 'cv', 'placement', 'internship', 'company', 'employer'],
  'Spam': ['free', 'win', 'prize', 'congratulations', 'urgent', 'act now', 'limited time', 'click here', 'unsubscribe', 'viagra', 'casino', 'lottery'],
  'Other': []
}

export const classifyEmail = (subject, snippet, body) => {
  const text = `${subject || ''} ${snippet || ''} ${body || ''}`.toLowerCase()
  
  const scores = {}
  
  // Calculate scores for each category
  Object.keys(CATEGORIES).forEach(category => {
    if (category === 'Other') return
    
    scores[category] = 0
    CATEGORIES[category].forEach(keyword => {
      const regex = new RegExp(`\\b${keyword}\\b`, 'gi')
      const matches = text.match(regex)
      if (matches) {
        scores[category] += matches.length
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
      confidence: 0.1
    }
  }
  
  // Calculate confidence based on score
  const confidence = Math.min(maxScore / 10, 0.95)
  
  return {
    label: bestCategory,
    confidence: Math.round(confidence * 100) / 100
  }
}

export const classifyEmails = async (emails) => {
  const classifiedEmails = emails.map(email => {
    const classification = classifyEmail(email.subject, email.snippet, email.body)
    return {
      ...email,
      category: classification.label,
      classification: {
        label: classification.label,
        confidence: classification.confidence
      }
    }
  })
  
  return classifiedEmails
}
