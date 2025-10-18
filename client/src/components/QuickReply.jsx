import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'
import { api } from '../services/api'
import ModernIcon from './ModernIcon'

const QuickReply = ({ email, onReply, onClose }) => {
  const [templates, setTemplates] = useState([])
  const [selectedTemplate, setSelectedTemplate] = useState(null)
  const [replyText, setReplyText] = useState('')
  const [loading, setLoading] = useState(false)
  const [showTemplates, setShowTemplates] = useState(false)
  const [variables, setVariables] = useState({})

  useEffect(() => {
    if (email) {
      fetchTemplates()
      setReplyText('')
      setSelectedTemplate(null)
      setVariables({})
    }
  }, [email])

  const fetchTemplates = async () => {
    try {
      const response = await api.get('/templates?type=reply&limit=10')
      setTemplates(response.data.templates)
    } catch (error) {
      console.error('Error fetching templates:', error)
    }
  }

  const handleTemplateSelect = (template) => {
    setSelectedTemplate(template)
    setReplyText(template.body)
    setVariables({})
    setShowTemplates(false)
  }

  const handleVariableChange = (key, value) => {
    setVariables(prev => ({ ...prev, [key]: value }))
  }

  const processTemplate = (template, vars) => {
    let processedText = template.body
    Object.keys(vars).forEach(key => {
      const placeholder = `{{${key}}}`
      const value = vars[key] || ''
      processedText = processedText.replace(new RegExp(placeholder, 'g'), value)
    })
    return processedText
  }

  const handleSendReply = async () => {
    if (!replyText.trim()) {
      toast.error('Please enter a reply message')
      return
    }

    setLoading(true)
    try {
      // Process template if one is selected
      let finalReplyText = replyText
      if (selectedTemplate) {
        finalReplyText = processTemplate(selectedTemplate, variables)
      }

      // Here you would typically send the reply via your email service
      // For now, we'll just call the onReply callback
      if (onReply) {
        await onReply({
          to: email.from,
          subject: `Re: ${email.subject}`,
          body: finalReplyText,
          templateId: selectedTemplate?._id
        })
      }

      // Update template usage count
      if (selectedTemplate) {
        try {
          await api.post(`/api/templates/${selectedTemplate._id}/use`, { variables })
        } catch (error) {
          console.error('Error updating template usage:', error)
        }
      }

      toast.success('Reply sent successfully!')
      onClose()
    } catch (error) {
      console.error('Error sending reply:', error)
      toast.error('Failed to send reply')
    } finally {
      setLoading(false)
    }
  }

  const getQuickReplies = () => {
    return [
      {
        text: "Thank you for your email. I'll get back to you soon.",
        icon: "👍"
      },
      {
        text: "I received your message and will review it shortly.",
        icon: "📧"
      },
      {
        text: "Thanks for reaching out. I'll respond in detail soon.",
        icon: "💬"
      },
      {
        text: "I'm currently busy but will reply as soon as possible.",
        icon: "⏰"
      }
    ]
  }

  const quickReplies = getQuickReplies()

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={(e) => e.target === e.currentTarget && onClose()}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="bg-white/90 backdrop-blur-xl border border-white/30 rounded-3xl shadow-2xl shadow-blue-100/20 max-w-4xl w-full max-h-[90vh] overflow-hidden"
        >
          {/* Header */}
          <div className="p-6 border-b border-white/30 bg-gradient-to-r from-white/60 to-white/40">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-3">
                  <ModernIcon type="reply" size={24} color="#3b82f6" />
                  Quick Reply
                </h2>
                <p className="text-slate-600 mt-1">
                  Replying to: {email?.from}
                </p>
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-slate-100 rounded-xl transition-colors"
              >
                <svg className="w-6 h-6 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="p-6 space-y-6 overflow-y-auto max-h-[calc(90vh-200px)]">
            {/* Quick Reply Buttons */}
            <div>
              <h3 className="text-lg font-semibold text-slate-800 mb-3">Quick Replies</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {quickReplies.map((reply, index) => (
                  <motion.button
                    key={index}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setReplyText(reply.text)}
                    className="p-3 bg-white/60 border border-white/50 rounded-xl hover:bg-white/80 transition-all duration-300 text-left group"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{reply.icon}</span>
                      <span className="text-slate-700 group-hover:text-slate-900">
                        {reply.text}
                      </span>
                    </div>
                  </motion.button>
                ))}
              </div>
            </div>

            {/* Templates */}
            {templates.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-lg font-semibold text-slate-800">Templates</h3>
                  <button
                    onClick={() => setShowTemplates(!showTemplates)}
                    className="px-3 py-1 bg-blue-100 text-blue-700 rounded-lg text-sm font-medium hover:bg-blue-200 transition-colors"
                  >
                    {showTemplates ? 'Hide' : 'Show'} Templates
                  </button>
                </div>
                
                <AnimatePresence>
                  {showTemplates && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="space-y-2 mb-4"
                    >
                      {templates.slice(0, 5).map((template) => (
                        <motion.button
                          key={template._id}
                          whileHover={{ scale: 1.01 }}
                          onClick={() => handleTemplateSelect(template)}
                          className={`w-full p-3 rounded-xl text-left transition-all duration-300 ${
                            selectedTemplate?._id === template._id
                              ? 'bg-blue-100 border-2 border-blue-300'
                              : 'bg-white/60 border border-white/50 hover:bg-white/80'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <h4 className="font-medium text-slate-800">{template.name}</h4>
                              <p className="text-sm text-slate-600 truncate">{template.subject}</p>
                            </div>
                            <span className="text-xs text-slate-500">{template.usageCount} uses</span>
                          </div>
                        </motion.button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}

            {/* Template Variables */}
            {selectedTemplate && selectedTemplate.variables && selectedTemplate.variables.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold text-slate-800 mb-3">Template Variables</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {selectedTemplate.variables.map((variable) => (
                    <div key={variable.name}>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        {variable.name}
                        {variable.description && (
                          <span className="text-xs text-slate-500 ml-1">({variable.description})</span>
                        )}
                      </label>
                      <input
                        type="text"
                        value={variables[variable.name] || ''}
                        onChange={(e) => handleVariableChange(variable.name, e.target.value)}
                        placeholder={variable.defaultValue || `Enter ${variable.name}`}
                        className="w-full px-3 py-2 bg-white/60 border border-white/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Reply Text Area */}
            <div>
              <h3 className="text-lg font-semibold text-slate-800 mb-3">Your Reply</h3>
              <textarea
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                className="w-full px-4 py-3 bg-white/60 border border-white/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 text-slate-800 resize-none"
                rows={6}
                placeholder="Type your reply here..."
              />
              <div className="flex items-center justify-between mt-2">
                <span className="text-sm text-slate-500">
                  {replyText.length} characters
                </span>
                {selectedTemplate && (
                  <span className="text-sm text-blue-600">
                    Using template: {selectedTemplate.name}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="p-6 border-t border-white/30 bg-gradient-to-r from-white/60 to-white/40">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setSelectedTemplate(null)}
                  className="px-4 py-2 bg-slate-200/60 text-slate-700 rounded-xl font-semibold hover:bg-slate-300/60 transition-colors"
                >
                  Clear Template
                </button>
                <button
                  onClick={() => setReplyText('')}
                  className="px-4 py-2 bg-slate-200/60 text-slate-700 rounded-xl font-semibold hover:bg-slate-300/60 transition-colors"
                >
                  Clear Text
                </button>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={onClose}
                  className="px-6 py-2 bg-slate-200/60 text-slate-700 rounded-xl font-semibold hover:bg-slate-300/60 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSendReply}
                  disabled={loading || !replyText.trim()}
                  className="px-6 py-2 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {loading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Sending...
                    </>
                  ) : (
                    <>
                      <ModernIcon type="send" size={16} color="#ffffff" />
                      Send Reply
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

export default QuickReply
