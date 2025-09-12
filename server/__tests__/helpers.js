import mongoose from 'mongoose'
import User from '../src/models/User.js'
import Email from '../src/models/Email.js'
import jwt from 'jsonwebtoken'

export const createTestUser = async (agent, userData = {}) => {
  const user = new User({
    name: 'Test User',
    email: 'test@example.com',
    password: 'hashedpassword',
    ...userData
  })
  await user.save()
  
  const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET || 'test-secret')
  return { user, token }
}

export const createTestUserWithGmailTokens = async (agent, userData = {}) => {
  const user = new User({
    name: 'Test User',
    email: 'test@gmail.com',
    password: 'hashedpassword',
    gmailConnected: true,
    gmailAccessToken: 'test-access-token',
    gmailRefreshToken: 'test-refresh-token',
    gmailTokenExpiry: new Date(Date.now() + 3600000),
    ...userData
  })
  await user.save()
  
  const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET || 'test-secret')
  return { user, token }
}

export const createTestUserWithoutGmail = async (agent, userData = {}) => {
  const user = new User({
    name: 'Test User',
    email: 'test@example.com',
    password: 'hashedpassword',
    gmailConnected: false,
    ...userData
  })
  await user.save()
  
  const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET || 'test-secret')
  return { user, token }
}

export const fullMessage = (id, subject) => ({
  id,
  threadId: `thread-${id}`,
  snippet: `Snippet for ${subject}`,
  payload: {
    headers: [
      { name: 'Subject', value: subject },
      { name: 'From', value: 'sender@example.com' },
      { name: 'To', value: 'recipient@example.com' },
      { name: 'Date', value: new Date().toISOString() }
    ],
    body: {
      data: Buffer.from(`<p>HTML body for ${subject}</p>`).toString('base64')
    },
    parts: [
      {
        mimeType: 'text/html',
        body: {
          data: Buffer.from(`<p>HTML body for ${subject}</p>`).toString('base64')
        }
      },
      {
        mimeType: 'text/plain',
        body: {
          data: Buffer.from(`Text body for ${subject}`).toString('base64')
        }
      }
    ]
  },
  labelIds: ['INBOX']
})

export const seedTestEmails = async (userId, count = 5) => {
  const emails = []
  for (let i = 0; i < count; i++) {
    emails.push({
      userId,
      provider: 'gmail',
      gmailId: `test-${i}`,
      subject: `Test Email ${i}`,
      from: 'sender@example.com',
      to: 'recipient@example.com',
      snippet: `Snippet ${i}`,
      date: new Date(),
      category: 'Academic',
      classification: { label: 'Academic', confidence: 0.8 }
    })
  }
  await Email.insertMany(emails)
  return emails
}
