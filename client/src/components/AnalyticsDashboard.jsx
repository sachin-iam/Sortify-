import React, { useState, useEffect } from 'react'
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { motion } from 'framer-motion'
import { analyticsService } from '../services/analyticsService'
import toast from 'react-hot-toast'
import ModernIcon from './ModernIcon'

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#84cc16', '#f97316']

const AnalyticsDashboard = () => {
  const [categoryData, setCategoryData] = useState([])
  const [accuracyData, setAccuracyData] = useState({})
  const [misclassifications, setMisclassifications] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('overview')

  useEffect(() => {
    loadAnalyticsData()
  }, [])

  const loadAnalyticsData = async () => {
    try {
      setLoading(true)
      
      const [categories, accuracy, misclassificationsData] = await Promise.all([
        analyticsService.getCategoryCounts(),
        analyticsService.getClassificationAccuracy(),
        analyticsService.getMisclassifications(50)
      ])

      setCategoryData(categories.data || [])
      setAccuracyData(accuracy.data || {})
      setMisclassifications(misclassificationsData.data || [])
    } catch (error) {
      toast.error('Failed to load analytics data')
      console.error('Error loading analytics:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleExport = async (format) => {
    try {
      const result = await analyticsService.exportAnalyticsData(format)
      toast.success(`${format.toUpperCase()} file exported successfully!`)
    } catch (error) {
      toast.error(`Failed to export ${format.toUpperCase()} file`)
    }
  }

  if (loading) {
    return (
      <div className="card-glass p-8">
        <div className="text-center">
          <div className="spinner w-12 h-12 mx-auto mb-4"></div>
          <p className="text-slate-800">Loading analytics data...</p>
        </div>
      </div>
    )
  }

  return (
    <motion.div
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="card-glass p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-3">
            <ModernIcon type="analytics" size={28} color="#3b82f6" />
            Analytics Dashboard
          </h2>
          <div className="flex space-x-2">
            <button 
              onClick={() => handleExport('csv')}
              className="btn-glass"
            >
              <ModernIcon type="export" size={20} color="#3b82f6" glassEffect={false} />
              <span className="ml-2">CSV</span>
            </button>
            <button 
              onClick={() => handleExport('pdf')}
              className="btn-glass"
            >
              <ModernIcon type="file" size={20} color="#ef4444" glassEffect={false} />
              <span className="ml-2">PDF</span>
            </button>
            <button 
              onClick={() => handleExport('excel')}
              className="btn-glass"
            >
              <ModernIcon type="table" size={20} color="#10b981" glassEffect={false} />
              <span className="ml-2">Excel</span>
            </button>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="card-glass p-2">
        <div className="flex space-x-2">
          <button 
            className={`px-6 py-3 rounded-lg font-semibold transition-all duration-300 ${
              activeTab === 'overview' 
                ? 'bg-slate-200/50 text-slate-800' 
                : 'text-slate-600 hover:text-slate-800 hover:bg-slate-100/50'
            }`}
            onClick={() => setActiveTab('overview')}
          >
            Overview
          </button>
          <button 
            className={`px-6 py-3 rounded-lg font-semibold transition-all duration-300 ${
              activeTab === 'accuracy' 
                ? 'bg-slate-200/50 text-slate-800' 
                : 'text-slate-600 hover:text-slate-800 hover:bg-slate-100/50'
            }`}
            onClick={() => setActiveTab('accuracy')}
          >
            Accuracy
          </button>
          <button 
            className={`px-6 py-3 rounded-lg font-semibold transition-all duration-300 ${
              activeTab === 'misclassifications' 
                ? 'bg-slate-200/50 text-slate-800' 
                : 'text-slate-600 hover:text-slate-800 hover:bg-slate-100/50'
            }`}
            onClick={() => setActiveTab('misclassifications')}
          >
            Misclassifications
          </button>
        </div>
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.1 }}
              className="card-glass text-center p-6"
            >
              <div className="mb-2">
                <ModernIcon type="email" size={32} color="#3b82f6" />
              </div>
              <h3 className="text-2xl font-bold text-slate-800">{categoryData.reduce((sum, item) => sum + item.count, 0)}</h3>
              <p className="text-slate-600">Total Emails</p>
            </motion.div>
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="card-glass text-center p-6"
            >
              <div className="mb-2">
                <ModernIcon type="folder" size={32} color="#10b981" />
              </div>
              <h3 className="text-2xl font-bold text-slate-800">{categoryData.length}</h3>
              <p className="text-slate-600">Categories</p>
            </motion.div>
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="card-glass text-center p-6"
            >
              <div className="mb-2">
                <ModernIcon type="target" size={32} color="#f59e0b" />
              </div>
              <h3 className="text-2xl font-bold text-slate-800">{accuracyData.overallAccuracy || 0}%</h3>
              <p className="text-slate-600">Overall Accuracy</p>
            </motion.div>
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="card-glass text-center p-6"
            >
              <div className="mb-2">
                <ModernIcon type="robot" size={32} color="#8b5cf6" />
              </div>
              <h3 className="text-2xl font-bold text-slate-800">{accuracyData.total || 0}</h3>
              <p className="text-slate-600">Classified Emails</p>
            </motion.div>
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="card-glass p-6"
            >
              <h3 className="text-lg font-semibold text-slate-800 mb-4">Email Distribution by Category</h3>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={categoryData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ label, percent }) => `${label} (${(percent * 100).toFixed(0)}%)`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="count"
                  >
                    {categoryData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </motion.div>

            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.6 }}
              className="card-glass p-6"
            >
              <h3 className="text-lg font-semibold text-slate-800 mb-4">Category Counts</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={categoryData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                  <XAxis dataKey="label" stroke="rgba(255,255,255,0.7)" />
                  <YAxis stroke="rgba(255,255,255,0.7)" />
                  <Tooltip 
                    contentStyle={{
                      backgroundColor: 'rgba(0,0,0,0.8)',
                      border: '1px solid rgba(255,255,255,0.2)',
                      borderRadius: '8px',
                      color: 'white'
                    }}
                  />
                  <Bar dataKey="count" fill="#3b82f6" />
                </BarChart>
              </ResponsiveContainer>
            </motion.div>
          </div>
        </div>
      )}

      {/* Accuracy Tab */}
      {activeTab === 'accuracy' && (
        <div className="space-y-6">
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="card-glass p-6"
          >
            <h3 className="text-lg font-semibold text-slate-800 mb-4">Classification Accuracy</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center">
                <div className="text-3xl font-bold text-slate-800 mb-2">{accuracyData.overallAccuracy || 0}%</div>
                <p className="text-slate-600">Overall Accuracy</p>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-slate-800 mb-2">{accuracyData.correct || 0}</div>
                <p className="text-slate-600">Correct Classifications</p>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-slate-800 mb-2">{accuracyData.total || 0}</div>
                <p className="text-slate-600">Total Classifications</p>
              </div>
            </div>
          </motion.div>

          {accuracyData.accuracyBreakdown && (
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.1 }}
              className="card-glass p-6"
            >
              <h4 className="text-lg font-semibold text-slate-800 mb-4">Accuracy by Category</h4>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-white/10">
                      <th className="text-left py-3 text-slate-600">Category</th>
                      <th className="text-left py-3 text-slate-600">Correct</th>
                      <th className="text-left py-3 text-slate-600">Total</th>
                      <th className="text-left py-3 text-slate-600">Accuracy</th>
                    </tr>
                  </thead>
                  <tbody>
                    {accuracyData.accuracyBreakdown.map((item, index) => (
                      <tr key={index} className="border-b border-white/5">
                        <td className="py-3 text-slate-800">{item.category}</td>
                        <td className="py-3 text-slate-600">{item.correct}</td>
                        <td className="py-3 text-slate-600">{item.total}</td>
                        <td className="py-3 text-slate-600">{item.accuracy}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </motion.div>
          )}
        </div>
      )}

      {/* Misclassifications Tab */}
      {activeTab === 'misclassifications' && (
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="card-glass p-6"
        >
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-slate-800 mb-2">Recent Misclassifications</h3>
            <p className="text-slate-600">Emails where ML classification doesn't match manual labels</p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left py-3 text-slate-600">Subject</th>
                  <th className="text-left py-3 text-slate-600">From</th>
                  <th className="text-left py-3 text-slate-600">Date</th>
                  <th className="text-left py-3 text-slate-600">ML Classification</th>
                  <th className="text-left py-3 text-slate-600">Manual Labels</th>
                </tr>
              </thead>
              <tbody>
                {misclassifications.map((email, index) => (
                  <tr key={index} className="border-b border-white/5">
                    <td className="py-3 text-slate-800 max-w-xs truncate">{email.subject}</td>
                    <td className="py-3 text-slate-600">{email.from}</td>
                    <td className="py-3 text-slate-600">{new Date(email.date).toLocaleDateString()}</td>
                    <td className="py-3">
                      <div className="flex flex-col">
                        <span className="text-slate-800">{email.classification?.label}</span>
                        <span className="text-xs text-slate-500">
                          ({email.classification?.confidence ? (email.classification.confidence * 100).toFixed(1) + '%' : 'N/A'})
                        </span>
                      </div>
                    </td>
                    <td className="py-3">
                      <div className="flex flex-wrap gap-1">
                        {email.labels?.map((label, labelIndex) => (
                          <span key={labelIndex} className="px-2 py-1 bg-slate-100/50 text-slate-600 rounded text-xs">
                            {label}
                          </span>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {misclassifications.length === 0 && (
              <div className="text-center py-12">
                <div className="text-6xl mb-4">🎉</div>
                <p className="text-slate-600">No misclassifications found!</p>
              </div>
            )}
          </div>
        </motion.div>
      )}
    </motion.div>
  )
}

export default AnalyticsDashboard
