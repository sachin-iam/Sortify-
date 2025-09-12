/**
 * Email utility functions for validation and processing
 */

export const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

export const extractEmailDomain = (email) => {
  if (!validateEmail(email)) return null
  return email.split('@')[1]
}

export const formatEmailAddress = (email, name = null) => {
  if (name) {
    return `${name} <${email}>`
  }
  return email
}

export const parseEmailAddress = (emailString) => {
  const match = emailString.match(/^(.*?)\s*<(.+?)>$/)
  if (match) {
    return {
      name: match[1].trim(),
      email: match[2].trim()
    }
  }
  return {
    name: null,
    email: emailString.trim()
  }
}

export const getEmailProvider = (email) => {
  const domain = extractEmailDomain(email)
  if (!domain) return 'unknown'
  
  const providers = {
    'gmail.com': 'Gmail',
    'outlook.com': 'Outlook',
    'hotmail.com': 'Outlook',
    'yahoo.com': 'Yahoo',
    'icloud.com': 'iCloud',
    'protonmail.com': 'ProtonMail'
  }
  
  return providers[domain.toLowerCase()] || 'Other'
}

export const truncateText = (text, maxLength = 100) => {
  if (!text) return ''
  if (text.length <= maxLength) return text
  return text.substring(0, maxLength) + '...'
}

export const highlightSearchTerm = (text, searchTerm) => {
  if (!searchTerm || !text) return text
  
  const regex = new RegExp(`(${searchTerm})`, 'gi')
  return text.replace(regex, '<mark class="bg-yellow-200">$1</mark>')
}
