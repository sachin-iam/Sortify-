// Test script for ML classification
import { classifyEmail } from './server/src/services/classificationService.js'

async function testClassification() {
  console.log('🧪 Testing ML Classification Service...\n')
  
  const testEmails = [
    {
      subject: "Assignment due tomorrow",
      snippet: "Please submit your homework assignment by 5 PM",
      body: "Dear students, your assignment is due tomorrow at 5 PM. Please make sure to submit it on time."
    },
    {
      subject: "Job interview scheduled",
      snippet: "Your interview for the software engineer position is scheduled",
      body: "Congratulations! We would like to schedule an interview for the software engineer position at our company."
    },
    {
      subject: "50% OFF - Limited Time Sale!",
      snippet: "Don't miss out on our biggest sale of the year",
      body: "Get 50% off on all items. Limited time offer. Shop now and save big!"
    },
    {
      subject: "You've won $1000!",
      snippet: "Congratulations! You've won our lottery",
      body: "Congratulations! You've won $1000 in our lottery. Click here to claim your prize now!"
    },
    {
      subject: "Meeting reminder",
      snippet: "Team meeting at 3 PM today",
      body: "Just a reminder about our team meeting at 3 PM today in the conference room."
    }
  ]
  
  for (const email of testEmails) {
    try {
      const result = await classifyEmail(email.subject, email.snippet, email.body)
      console.log(`📧 Subject: "${email.subject}"`)
      console.log(`   Classification: ${result.label} (${(result.confidence * 100).toFixed(1)}% confidence)`)
      console.log(`   Snippet: "${email.snippet}"`)
      console.log('')
    } catch (error) {
      console.error(`❌ Error classifying email: ${error.message}`)
    }
  }
  
  console.log('✅ ML Classification test completed!')
}

testClassification().catch(console.error)
