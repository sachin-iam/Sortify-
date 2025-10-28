import { useState } from 'react'
import { CheckCircle, XCircle, AlertTriangle, RefreshCw, Bug } from 'lucide-react'

const CategoryDiagnostic = () => {
  const [loading, setLoading] = useState(false)
  const [fixing, setFixing] = useState(false)
  const [diagnosis, setDiagnosis] = useState(null)
  const [fixResult, setFixResult] = useState(null)
  const [error, setError] = useState(null)

  const runDiagnostic = async () => {
    setLoading(true)
    setError(null)
    setDiagnosis(null)
    setFixResult(null)

    try {
      const token = localStorage.getItem('token')
      const response = await fetch('http://localhost:5000/api/diagnostic/whats-happening', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        throw new Error(`Diagnostic failed: ${response.statusText}`)
      }

      const data = await response.json()
      setDiagnosis(data.diagnosis)
    } catch (err) {
      setError(err.message)
      console.error('Diagnostic error:', err)
    } finally {
      setLoading(false)
    }
  }

  const applyFix = async () => {
    setFixing(true)
    setError(null)
    setFixResult(null)

    try {
      const token = localStorage.getItem('token')
      const response = await fetch('http://localhost:5000/api/diagnostic/fix-whats-happening', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        throw new Error(`Fix failed: ${response.statusText}`)
      }

      const data = await response.json()
      setFixResult(data.results)
      
      // Re-run diagnostic to show updated status
      setTimeout(runDiagnostic, 1000)
    } catch (err) {
      setError(err.message)
      console.error('Fix error:', err)
    } finally {
      setFixing(false)
    }
  }

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Bug className="w-6 h-6 text-purple-600" />
          <h3 className="text-xl font-semibold text-gray-900">Category Diagnostic Tool</h3>
        </div>
        <button
          onClick={runDiagnostic}
          disabled={loading}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
            loading
              ? 'bg-gray-300 cursor-not-allowed'
              : 'bg-purple-600 hover:bg-purple-700 text-white'
          }`}
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          {loading ? 'Running...' : 'Run Diagnostic'}
        </button>
      </div>

      <p className="text-gray-600 mb-4">
        Check for classification issues with "What's Happening" emails and other categories.
      </p>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4 flex items-start gap-2">
          <XCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-red-800">Error</p>
            <p className="text-red-700 text-sm">{error}</p>
          </div>
        </div>
      )}

      {diagnosis && (
        <div className="space-y-4">
          {/* Status Summary */}
          <div className={`rounded-lg p-4 border ${
            diagnosis.issue 
              ? 'bg-yellow-50 border-yellow-200' 
              : 'bg-green-50 border-green-200'
          }`}>
            <div className="flex items-start gap-2">
              {diagnosis.issue ? (
                <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
              ) : (
                <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
              )}
              <div className="flex-1">
                <p className={`font-semibold ${
                  diagnosis.issue ? 'text-yellow-800' : 'text-green-800'
                }`}>
                  {diagnosis.issue || 'No issues detected'}
                </p>
                {diagnosis.issue && (
                  <button
                    onClick={applyFix}
                    disabled={fixing}
                    className={`mt-3 px-4 py-2 rounded-lg font-medium transition-all ${
                      fixing
                        ? 'bg-gray-300 cursor-not-allowed'
                        : 'bg-yellow-600 hover:bg-yellow-700 text-white'
                    }`}
                  >
                    {fixing ? 'Fixing...' : '🔧 Apply Fix'}
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Statistics */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div className="bg-purple-50 rounded-lg p-4">
              <p className="text-sm text-purple-600 font-medium">What's Happening Emails</p>
              <p className="text-2xl font-bold text-purple-900">
                {diagnosis.totalWhatsHappeningEmails || 0}
              </p>
            </div>
            
            <div className="bg-blue-50 rounded-lg p-4">
              <p className="text-sm text-blue-600 font-medium">Category Exists</p>
              <p className="text-2xl font-bold text-blue-900">
                {diagnosis.categoryExists ? '✓ Yes' : '✗ No'}
              </p>
            </div>

            <div className="bg-indigo-50 rounded-lg p-4">
              <p className="text-sm text-indigo-600 font-medium">Total Categories</p>
              <p className="text-2xl font-bold text-indigo-900">
                {diagnosis.allCategories?.length || 0}
              </p>
            </div>
          </div>

          {/* Category Distribution */}
          {diagnosis.categoryCounts && Object.keys(diagnosis.categoryCounts).length > 0 && (
            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="font-semibold text-gray-900 mb-3">Current Category Distribution</h4>
              <div className="space-y-2">
                {Object.entries(diagnosis.categoryCounts)
                  .sort((a, b) => b[1] - a[1])
                  .map(([category, count]) => (
                    <div key={category} className="flex items-center justify-between">
                      <span className="text-gray-700">{category}</span>
                      <span className="font-semibold text-gray-900">{count} emails</span>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Recommendations */}
          {diagnosis.recommendations && diagnosis.recommendations.length > 0 && (
            <div className="bg-blue-50 rounded-lg p-4">
              <h4 className="font-semibold text-blue-900 mb-2">Recommendations</h4>
              <ul className="list-disc list-inside space-y-1">
                {diagnosis.recommendations.map((rec, index) => (
                  <li key={index} className="text-blue-800 text-sm">{rec}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Sample Emails */}
          {diagnosis.sampleEmails && diagnosis.sampleEmails.length > 0 && (
            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="font-semibold text-gray-900 mb-3">Sample Emails</h4>
              <div className="space-y-3">
                {diagnosis.sampleEmails.slice(0, 5).map((email, index) => (
                  <div key={index} className="bg-white rounded-lg p-3 border border-gray-200">
                    <p className="text-xs text-gray-500 mb-1">From:</p>
                    <p className="text-sm text-gray-800 font-medium truncate">{email.from}</p>
                    <p className="text-xs text-gray-500 mt-2 mb-1">Subject:</p>
                    <p className="text-sm text-gray-700 truncate">{email.subject}</p>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded">
                        {email.category}
                      </span>
                      <span className="text-xs text-gray-500">
                        {new Date(email.date).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {fixResult && (
        <div className="mt-4 bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-start gap-2">
            <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-green-800">Fix Applied Successfully!</p>
              <div className="mt-2 space-y-1 text-sm text-green-700">
                <p>• Category: {fixResult.categoryName}</p>
                <p>• Emails reclassified: {fixResult.emailsReclassified}</p>
                <p className="mt-3 text-green-800 font-medium">
                  ✓ Please refresh your browser to see the updated email list!
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default CategoryDiagnostic

