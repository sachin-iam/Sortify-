import { google } from 'googleapis'
import { getOAuthForUser } from './gmailSyncService.js'

/**
 * Create MIME email message for Gmail API
 * @param {Object} params - Email parameters
 * @returns {string} Base64 encoded MIME message
 */
const createMimeMessage = ({ to, from, subject, body, inReplyTo, references, threadId }) => {
  const messageParts = [
    `To: ${to}`,
    `From: ${from}`,
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=utf-8'
  ]

  // Add threading headers for proper Gmail conversation support
  if (inReplyTo) {
    messageParts.push(`In-Reply-To: ${inReplyTo}`)
  }
  
  if (references) {
    messageParts.push(`References: ${references}`)
  }

  messageParts.push('', body) // Empty line before body

  const message = messageParts.join('\r\n')
  
  // Base64 encode the message (URL-safe)
  const encodedMessage = Buffer.from(message)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')

  return encodedMessage
}

/**
 * Send a reply to an email via Gmail API
 * @param {Object} user - User object with Gmail credentials
 * @param {Object} replyData - Reply data
 * @returns {Promise<Object>} Send result
 */
export const sendReply = async (user, replyData) => {
  try {
    const { to, subject, body, inReplyTo, references, threadId } = replyData

    console.log('📧 Sending reply via Gmail API...')
    console.log(`   To: ${to}`)
    console.log(`   Subject: ${subject}`)
    console.log(`   Thread ID: ${threadId || 'N/A'}`)
    console.log(`   In-Reply-To: ${inReplyTo || 'N/A'}`)

    // Get OAuth2 client for user
    const oauth2 = getOAuthForUser(user)
    const gmail = google.gmail({ version: 'v1', auth: oauth2 })

    // Set up token refresh handler
    oauth2.on('tokens', async (tokens) => {
      console.log('   🔄 OAuth token refreshed automatically')
      if (tokens.access_token) {
        user.gmailAccessToken = tokens.access_token
      }
      if (tokens.refresh_token) {
        user.gmailRefreshToken = tokens.refresh_token
      }
      if (tokens.expiry_date) {
        user.gmailTokenExpiry = new Date(tokens.expiry_date)
      }
      await user.save()
    })

    // Create MIME message
    const mimeMessage = createMimeMessage({
      to,
      from: user.email || user.gmailEmail,
      subject: subject.startsWith('Re: ') ? subject : `Re: ${subject}`,
      body,
      inReplyTo,
      references,
      threadId
    })

    // Send the email
    const requestBody = {
      raw: mimeMessage
    }

    // If we have a threadId, include it to maintain conversation threading
    if (threadId) {
      requestBody.threadId = threadId
    }

    const response = await gmail.users.messages.send({
      userId: 'me',
      requestBody
    })

    console.log('✅ Email sent successfully!')
    console.log(`   Message ID: ${response.data.id}`)
    console.log(`   Thread ID: ${response.data.threadId}`)

    return {
      success: true,
      messageId: response.data.id,
      threadId: response.data.threadId,
      labelIds: response.data.labelIds
    }

  } catch (error) {
    console.error('❌ Error sending email via Gmail:', error)
    
    // Handle specific Gmail API errors
    if (error.code === 401 || error.code === 403) {
      throw new Error('Gmail authentication failed. Please reconnect your Gmail account.')
    } else if (error.code === 429) {
      throw new Error('Rate limit exceeded. Please try again in a few moments.')
    } else if (error.code === 400) {
      throw new Error('Invalid email format. Please check your message and try again.')
    }
    
    throw new Error(error.message || 'Failed to send email via Gmail')
  }
}

/**
 * Send a new email (not a reply) via Gmail API
 * @param {Object} user - User object with Gmail credentials
 * @param {Object} emailData - Email data
 * @returns {Promise<Object>} Send result
 */
export const sendEmail = async (user, emailData) => {
  try {
    const { to, subject, body, cc, bcc } = emailData

    console.log('📧 Sending new email via Gmail API...')
    console.log(`   To: ${to}`)
    console.log(`   Subject: ${subject}`)

    // Get OAuth2 client for user
    const oauth2 = getOAuthForUser(user)
    const gmail = google.gmail({ version: 'v1', auth: oauth2 })

    // Set up token refresh handler
    oauth2.on('tokens', async (tokens) => {
      if (tokens.access_token) {
        user.gmailAccessToken = tokens.access_token
      }
      if (tokens.refresh_token) {
        user.gmailRefreshToken = tokens.refresh_token
      }
      if (tokens.expiry_date) {
        user.gmailTokenExpiry = new Date(tokens.expiry_date)
      }
      await user.save()
    })

    // Create message parts
    const messageParts = [
      `To: ${to}`,
      `From: ${user.email || user.gmailEmail}`,
      `Subject: ${subject}`,
      'MIME-Version: 1.0',
      'Content-Type: text/plain; charset=utf-8'
    ]

    if (cc) {
      messageParts.push(`Cc: ${cc}`)
    }
    if (bcc) {
      messageParts.push(`Bcc: ${bcc}`)
    }

    messageParts.push('', body)

    const message = messageParts.join('\r\n')
    const encodedMessage = Buffer.from(message)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '')

    // Send the email
    const response = await gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        raw: encodedMessage
      }
    })

    console.log('✅ Email sent successfully!')
    console.log(`   Message ID: ${response.data.id}`)

    return {
      success: true,
      messageId: response.data.id,
      threadId: response.data.threadId,
      labelIds: response.data.labelIds
    }

  } catch (error) {
    console.error('❌ Error sending email via Gmail:', error)
    throw new Error(error.message || 'Failed to send email via Gmail')
  }
}

