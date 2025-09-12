import { spawn } from 'child_process'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Simple test runner for ES modules
const runTest = async (testFile) => {
  return new Promise((resolve, reject) => {
    const child = spawn('node', [testFile], {
      stdio: 'inherit',
      env: { ...process.env, NODE_ENV: 'test' }
    })

    child.on('close', (code) => {
      if (code === 0) {
        resolve()
      } else {
        reject(new Error(`Test failed with code ${code}`))
      }
    })
  })
}

// Run all tests
const runAllTests = async () => {
  const testFiles = [
    '__tests__/auth.me.nolimit.test.js',
    '__tests__/gmail.connect.callback.saveTokens.test.js',
    '__tests__/gmail.syncAll.ok.test.js',
    '__tests__/gmail.syncAll.guard.test.js',
    '__tests__/auth.disconnect.purge.test.js'
  ]

  console.log('🧪 Running tests...\n')

  for (const testFile of testFiles) {
    try {
      console.log(`Running ${testFile}...`)
      await runTest(join(__dirname, testFile))
      console.log(`✅ ${testFile} passed\n`)
    } catch (error) {
      console.log(`❌ ${testFile} failed: ${error.message}\n`)
      process.exit(1)
    }
  }

  console.log('🎉 All tests passed!')
}

runAllTests().catch(console.error)
