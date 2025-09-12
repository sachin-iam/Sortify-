/**
 * Application constants and configuration
 */

export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'
export const ML_SERVICE_URL = import.meta.env.VITE_ML_SERVICE_URL || 'http://localhost:8000'

export const EMAIL_CATEGORIES = {
  ACADEMIC: 'Academic',
  PROMOTIONS: 'Promotions', 
  PLACEMENT: 'Placement',
  SPAM: 'Spam',
  OTHER: 'Other'
}

export const EMAIL_PROVIDERS = {
  GMAIL: 'gmail',
  OUTLOOK: 'outlook',
  YAHOO: 'yahoo',
  OTHER: 'other'
}

export const PAGINATION_LIMITS = [10, 25, 50, 100]

export const SORT_OPTIONS = {
  DATE_DESC: { field: 'date', order: 'desc', label: 'Newest First' },
  DATE_ASC: { field: 'date', order: 'asc', label: 'Oldest First' },
  SUBJECT_ASC: { field: 'subject', order: 'asc', label: 'Subject A-Z' },
  SUBJECT_DESC: { field: 'subject', order: 'desc', label: 'Subject Z-A' },
  SENDER_ASC: { field: 'sender', order: 'asc', label: 'Sender A-Z' },
  SENDER_DESC: { field: 'sender', order: 'desc', label: 'Sender Z-A' }
}

export const ANIMATION_VARIANTS = {
  fadeIn: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 }
  },
  slideUp: {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -20 }
  },
  slideDown: {
    initial: { opacity: 0, y: -20 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: 20 }
  },
  scale: {
    initial: { opacity: 0, scale: 0.9 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0.9 }
  }
}

export const TOAST_CONFIG = {
  duration: 4000,
  position: 'top-right',
  style: {
    background: 'rgba(255, 255, 255, 0.9)',
    backdropFilter: 'blur(10px)',
    border: '1px solid rgba(255, 255, 255, 0.2)',
    borderRadius: '12px',
    color: '#1f2937'
  }
}
