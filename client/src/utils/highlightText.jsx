/**
 * Highlight matching text in search results
 * @param {string} text - The text to search in
 * @param {string} searchTerm - The term to highlight
 * @returns {JSX.Element} - Text with highlighted matches
 */
export const highlightText = (text, searchTerm) => {
  if (!text) return ''
  if (!searchTerm || !searchTerm.trim()) return text

  try {
    // Escape special regex characters to prevent errors
    const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const escapedSearchTerm = escapeRegex(searchTerm.trim())
    
    // Create regex for case-insensitive matching
    const regex = new RegExp(`(${escapedSearchTerm})`, 'gi')
    
    // Split text by matches
    const parts = text.split(regex)
    
    // Return JSX with highlighted parts
    return (
      <>
        {parts.map((part, index) => {
          // Check if this part matches the search term (case-insensitive)
          if (part.toLowerCase() === searchTerm.trim().toLowerCase()) {
            return (
              <mark 
                key={index}
                className="bg-yellow-300 text-slate-900 font-semibold rounded px-0.5"
              >
                {part}
              </mark>
            )
          }
          return <span key={index}>{part}</span>
        })}
      </>
    )
  } catch (error) {
    console.error('Error highlighting text:', error)
    return text
  }
}

/**
 * Check if text contains search term
 * @param {string} text - The text to search in
 * @param {string} searchTerm - The term to search for
 * @returns {boolean} - True if text contains search term
 */
export const containsSearchTerm = (text, searchTerm) => {
  if (!text || !searchTerm) return false
  return text.toLowerCase().includes(searchTerm.toLowerCase())
}

