import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'
import { api } from '../services/api'
import ModernIcon from './ModernIcon'

const EmailTemplates = ({ onTemplateSelect, onClose, selectedCategory = 'All' }) => {
  const [templates, setTemplates] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedType, setSelectedType] = useState('all')
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState(null)
  const [stats, setStats] = useState(null)

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    subject: '',
    body: '',
    category: 'General',
    type: 'reply',
    description: '',
    tags: []
  })

  useEffect(() => {
    fetchTemplates()
    fetchCategories()
    fetchStats()
  }, [selectedCategory, selectedType])

  const fetchTemplates = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (selectedCategory !== 'All') params.append('category', selectedCategory)
      if (selectedType !== 'all') params.append('type', selectedType)
      if (searchQuery) params.append('search', searchQuery)

      const response = await api.get(`/api/templates?${params}`)
      setTemplates(response.data.templates)
    } catch (error) {
      console.error('Error fetching templates:', error)
      toast.error('Failed to load email templates')
    } finally {
      setLoading(false)
    }
  }

  const fetchCategories = async () => {
    try {
      const response = await api.get('/api/templates/categories')
      setCategories(response.data.categories)
    } catch (error) {
      console.error('Error fetching categories:', error)
    }
  }

  const fetchStats = async () => {
    try {
      const response = await api.get('/api/templates/stats')
      setStats(response.data.stats)
    } catch (error) {
      console.error('Error fetching stats:', error)
    }
  }

  const handleCreateTemplate = async (e) => {
    e.preventDefault()
    try {
      const response = await api.post('/api/templates', formData)
      toast.success('Template created successfully!')
      setShowCreateForm(false)
      resetForm()
      fetchTemplates()
      fetchStats()
    } catch (error) {
      console.error('Error creating template:', error)
      toast.error(error.response?.data?.message || 'Failed to create template')
    }
  }

  const handleUpdateTemplate = async (e) => {
    e.preventDefault()
    try {
      await api.put(`/api/templates/${editingTemplate._id}`, formData)
      toast.success('Template updated successfully!')
      setEditingTemplate(null)
      resetForm()
      fetchTemplates()
      fetchStats()
    } catch (error) {
      console.error('Error updating template:', error)
      toast.error(error.response?.data?.message || 'Failed to update template')
    }
  }

  const handleDeleteTemplate = async (templateId) => {
    if (!window.confirm('Are you sure you want to delete this template?')) return

    try {
      await api.delete(`/api/templates/${templateId}`)
      toast.success('Template deleted successfully!')
      fetchTemplates()
      fetchStats()
    } catch (error) {
      console.error('Error deleting template:', error)
      toast.error('Failed to delete template')
    }
  }

  const handleUseTemplate = async (template) => {
    try {
      const response = await api.post(`/api/templates/${template._id}/use`)
      const processedTemplate = response.data.template
      
      if (onTemplateSelect) {
        onTemplateSelect(processedTemplate)
      }
      
      toast.success('Template applied!')
      fetchTemplates() // Refresh to update usage count
    } catch (error) {
      console.error('Error using template:', error)
      toast.error('Failed to use template')
    }
  }

  const handleDuplicateTemplate = async (template) => {
    try {
      const newName = `${template.name} (Copy)`
      await api.post(`/api/templates/${template._id}/duplicate`, { newName })
      toast.success('Template duplicated successfully!')
      fetchTemplates()
    } catch (error) {
      console.error('Error duplicating template:', error)
      toast.error('Failed to duplicate template')
    }
  }

  const resetForm = () => {
    setFormData({
      name: '',
      subject: '',
      body: '',
      category: 'General',
      type: 'reply',
      description: '',
      tags: []
    })
  }

  const startEdit = (template) => {
    setEditingTemplate(template)
    setFormData({
      name: template.name,
      subject: template.subject,
      body: template.body,
      category: template.category,
      type: template.type,
      description: template.description || '',
      tags: template.tags || []
    })
    setShowCreateForm(true)
  }

  const getTypeIcon = (type) => {
    const icons = {
      'reply': '↩️',
      'forward': '↪️',
      'compose': '✏️',
      'auto': '🤖'
    }
    return icons[type] || '📧'
  }

  const getTypeColor = (type) => {
    const colors = {
      'reply': 'from-blue-500 to-blue-600',
      'forward': 'from-green-500 to-green-600',
      'compose': 'from-purple-500 to-purple-600',
      'auto': 'from-orange-500 to-orange-600'
    }
    return colors[type] || 'from-gray-500 to-gray-600'
  }

  const filteredTemplates = templates.filter(template => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      return (
        template.name.toLowerCase().includes(query) ||
        template.subject.toLowerCase().includes(query) ||
        template.body.toLowerCase().includes(query) ||
        (template.tags && template.tags.some(tag => tag.toLowerCase().includes(query)))
      )
    }
    return true
  })

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
          className="bg-white/90 backdrop-blur-xl border border-white/30 rounded-3xl shadow-2xl shadow-blue-100/20 max-w-6xl w-full max-h-[90vh] overflow-hidden"
        >
          {/* Header */}
          <div className="p-6 border-b border-white/30 bg-gradient-to-r from-white/60 to-white/40">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-3">
                  <ModernIcon type="settings" size={24} color="#3b82f6" />
                  Email Templates
                </h2>
                <p className="text-slate-600 mt-1">
                  {stats ? `${stats.totalTemplates} templates • ${stats.totalUsage} uses` : 'Manage your email templates'}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowCreateForm(true)}
                  className="px-4 py-2 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all duration-300 flex items-center gap-2"
                >
                  <ModernIcon type="plus" size={16} color="#ffffff" />
                  New Template
                </button>
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

            {/* Filters */}
            <div className="flex items-center gap-4 mt-4">
              <div className="flex-1">
                <input
                  type="text"
                  placeholder="Search templates..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full px-4 py-2 bg-white/60 border border-white/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 text-slate-800"
                />
              </div>
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                className="px-4 py-2 bg-white/60 border border-white/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 text-slate-800"
              >
                <option value="all">All Types</option>
                <option value="reply">Reply</option>
                <option value="forward">Forward</option>
                <option value="compose">Compose</option>
                <option value="auto">Auto</option>
              </select>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto max-h-[calc(90vh-200px)]">
            {loading ? (
              <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
              </div>
            ) : (
              <div className="p-6">
                {filteredTemplates.length === 0 ? (
                  <div className="text-center py-12">
                    <ModernIcon type="mail" size={48} color="#94a3b8" />
                    <h3 className="text-xl font-semibold text-slate-600 mt-4">No templates found</h3>
                    <p className="text-slate-500 mt-2">
                      {searchQuery ? 'Try adjusting your search terms' : 'Create your first email template'}
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredTemplates.map((template) => (
                      <motion.div
                        key={template._id}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        className="bg-white/60 border border-white/50 rounded-2xl p-4 hover:bg-white/80 transition-all duration-300 group"
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <div className={`w-8 h-8 bg-gradient-to-r ${getTypeColor(template.type)} rounded-lg flex items-center justify-center text-sm`}>
                              {getTypeIcon(template.type)}
                            </div>
                            <div>
                              <h3 className="font-semibold text-slate-800 group-hover:text-slate-900">
                                {template.name}
                              </h3>
                              <p className="text-xs text-slate-500 capitalize">{template.type}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="text-xs text-slate-500">
                              {template.usageCount} uses
                            </span>
                          </div>
                        </div>

                        <div className="space-y-2 mb-4">
                          <div>
                            <p className="text-sm font-medium text-slate-700">Subject:</p>
                            <p className="text-sm text-slate-600 truncate">{template.subject}</p>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-slate-700">Body:</p>
                            <p className="text-sm text-slate-600 line-clamp-2">
                              {template.body.length > 100 ? template.body.substring(0, 100) + '...' : template.body}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center justify-between">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            template.category === 'Academic' ? 'bg-blue-100 text-blue-800' :
                            template.category === 'Promotions' ? 'bg-green-100 text-green-800' :
                            template.category === 'Placement' ? 'bg-purple-100 text-purple-800' :
                            template.category === 'Spam' ? 'bg-red-100 text-red-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {template.category}
                          </span>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleUseTemplate(template)}
                              className="p-1.5 hover:bg-blue-100 rounded-lg transition-colors"
                              title="Use template"
                            >
                              <ModernIcon type="play" size={16} color="#3b82f6" />
                            </button>
                            <button
                              onClick={() => startEdit(template)}
                              className="p-1.5 hover:bg-green-100 rounded-lg transition-colors"
                              title="Edit template"
                            >
                              <ModernIcon type="edit" size={16} color="#10b981" />
                            </button>
                            <button
                              onClick={() => handleDuplicateTemplate(template)}
                              className="p-1.5 hover:bg-purple-100 rounded-lg transition-colors"
                              title="Duplicate template"
                            >
                              <ModernIcon type="copy" size={16} color="#8b5cf6" />
                            </button>
                            <button
                              onClick={() => handleDeleteTemplate(template._id)}
                              className="p-1.5 hover:bg-red-100 rounded-lg transition-colors"
                              title="Delete template"
                            >
                              <ModernIcon type="trash" size={16} color="#ef4444" />
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Create/Edit Form Modal */}
          {showCreateForm && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="absolute inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="bg-white/90 backdrop-blur-xl border border-white/30 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden"
              >
                <div className="p-6 border-b border-white/30">
                  <h3 className="text-xl font-bold text-slate-800">
                    {editingTemplate ? 'Edit Template' : 'Create New Template'}
                  </h3>
                </div>

                <form onSubmit={editingTemplate ? handleUpdateTemplate : handleCreateTemplate} className="p-6 space-y-4 overflow-y-auto max-h-[60vh]">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Name</label>
                      <input
                        type="text"
                        value={formData.name}
                        onChange={(e) => setFormData({...formData, name: e.target.value})}
                        className="w-full px-3 py-2 bg-white/60 border border-white/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Category</label>
                      <select
                        value={formData.category}
                        onChange={(e) => setFormData({...formData, category: e.target.value})}
                        className="w-full px-3 py-2 bg-white/60 border border-white/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                      >
                        <option value="General">General</option>
                        <option value="Academic">Academic</option>
                        <option value="Promotions">Promotions</option>
                        <option value="Placement">Placement</option>
                        <option value="Spam">Spam</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Type</label>
                      <select
                        value={formData.type}
                        onChange={(e) => setFormData({...formData, type: e.target.value})}
                        className="w-full px-3 py-2 bg-white/60 border border-white/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                      >
                        <option value="reply">Reply</option>
                        <option value="forward">Forward</option>
                        <option value="compose">Compose</option>
                        <option value="auto">Auto</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
                      <input
                        type="text"
                        value={formData.description}
                        onChange={(e) => setFormData({...formData, description: e.target.value})}
                        className="w-full px-3 py-2 bg-white/60 border border-white/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                        placeholder="Optional description"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Subject</label>
                    <input
                      type="text"
                      value={formData.subject}
                      onChange={(e) => setFormData({...formData, subject: e.target.value})}
                      className="w-full px-3 py-2 bg-white/60 border border-white/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                      placeholder="Email subject (use {{variable}} for dynamic content)"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Body</label>
                    <textarea
                      value={formData.body}
                      onChange={(e) => setFormData({...formData, body: e.target.value})}
                      className="w-full px-3 py-2 bg-white/60 border border-white/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50 h-32 resize-none"
                      placeholder="Email body (use {{variable}} for dynamic content)"
                      required
                    />
                  </div>

                  <div className="flex items-center justify-end gap-3 pt-4">
                    <button
                      type="button"
                      onClick={() => {
                        setShowCreateForm(false)
                        setEditingTemplate(null)
                        resetForm()
                      }}
                      className="px-4 py-2 bg-slate-200/60 text-slate-700 rounded-lg font-semibold hover:bg-slate-300/60 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-6 py-2 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg font-semibold shadow-lg hover:shadow-xl transition-all duration-300"
                    >
                      {editingTemplate ? 'Update Template' : 'Create Template'}
                    </button>
                  </div>
                </form>
              </motion.div>
            </motion.div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

export default EmailTemplates
