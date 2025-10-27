/**
 * Thread Grouping Service
 * Groups emails by Gmail threadId and date (same day)
 */

/**
 * Normalize date to YYYY-MM-DD format for day-based grouping
 */
const normalizeDate = (date) => {
  const d = new Date(date)
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Group emails into threads by threadId + date
 * @param {Array} emails - Array of email documents
 * @returns {Array} - Array of thread containers
 */
export const groupEmailsIntoThreads = (emails) => {
  // Map to store threads: key = "threadId_date"
  const threadMap = new Map()

  // Process each email
  emails.forEach(email => {
    const threadId = email.threadId || email._id.toString()
    const dateKey = normalizeDate(email.date)
    const key = `${threadId}_${dateKey}`

    if (threadMap.has(key)) {
      // Add to existing thread
      const thread = threadMap.get(key)
      thread.messageIds.push(email._id)
      thread.emails.push(email)
      thread.messageCount++

      // Update to latest message if this email is newer
      if (new Date(email.date) > new Date(thread.latestDate)) {
        thread.latestDate = email.date
        thread.subject = email.subject
        thread.from = email.from
        thread.snippet = email.snippet
      }

      // If any message is unread, mark thread as unread
      if (!email.isRead) {
        thread.isRead = false
      }

      // Preserve archived status - if any message is not archived, thread is not archived
      if (!email.isArchived) {
        thread.isArchived = false
      }
    } else {
      // Create new thread container
      threadMap.set(key, {
        _id: key, // Unique container ID
        threadId: threadId,
        dateKey: dateKey,
        date: email.date,
        latestDate: email.date,
        messageCount: 1,
        messageIds: [email._id],
        emails: [email], // Store full email objects for reference
        subject: email.subject,
        from: email.from,
        to: email.to,
        snippet: email.snippet,
        category: email.category,
        classification: email.classification,
        isRead: email.isRead,
        labels: email.labels,
        isArchived: email.isArchived || false,
        archivedAt: email.archivedAt,
        // Flag to identify as thread container
        isThread: true
      })
    }
  })

  // Convert map to array and sort by latest date (newest first)
  const threads = Array.from(threadMap.values())
    .sort((a, b) => new Date(b.latestDate) - new Date(a.latestDate))

  // Remove the full emails array from response (not needed in list view)
  return threads.map(thread => {
    const { emails, ...threadData } = thread
    return threadData
  })
}

/**
 * Get all messages in a specific thread for a given date
 * @param {Object} Email - Mongoose Email model
 * @param {String} threadId - Gmail thread ID
 * @param {String} userId - User ID
 * @param {String} dateKey - Date in YYYY-MM-DD format (optional, if not provided gets all from thread)
 * @returns {Array} - Array of email documents sorted chronologically
 */
export const getThreadMessages = async (Email, threadId, userId, dateKey = null) => {
  const query = {
    userId,
    threadId,
    isDeleted: { $ne: true }
  }

  // If dateKey provided, filter by same day
  if (dateKey) {
    // Parse the date key
    const [year, month, day] = dateKey.split('-').map(Number)
    const startOfDay = new Date(year, month - 1, day, 0, 0, 0)
    const endOfDay = new Date(year, month - 1, day, 23, 59, 59, 999)

    query.date = {
      $gte: startOfDay,
      $lte: endOfDay
    }
  }

  // Fetch all messages in the thread, sorted chronologically (oldest first)
  const messages = await Email.find(query)
    .sort({ date: 1 }) // Ascending order (oldest first)
    .lean()

  return messages
}

/**
 * Get thread summary for a specific thread container ID
 * Used when clicking on a thread in the list
 */
export const parseThreadContainerId = (containerId) => {
  // Container ID format: "threadId_YYYY-MM-DD"
  const lastUnderscoreIndex = containerId.lastIndexOf('_')
  
  if (lastUnderscoreIndex === -1) {
    // Not a valid container ID, treat as regular email ID
    return null
  }

  const threadId = containerId.substring(0, lastUnderscoreIndex)
  const dateKey = containerId.substring(lastUnderscoreIndex + 1)

  return { threadId, dateKey }
}

export default {
  groupEmailsIntoThreads,
  getThreadMessages,
  parseThreadContainerId,
  normalizeDate
}

