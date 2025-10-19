import dotenv from 'dotenv'

// Load environment variables
dotenv.config()
console.log('Environment variables loaded:', {
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
  MONGO_URI: process.env.MONGO_URI ? 'LOADED' : 'MISSING'
})

import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import compression from 'compression'
import morgan from 'morgan'
import cookieParser from 'cookie-parser'
import rateLimit from 'express-rate-limit'
import { createServer } from 'http'

// Import routes
import authRoutes from './routes/auth.js'
import emailRoutes from './routes/emails.js'
import userRoutes from './routes/users.js'
import analyticsRoutes from './routes/analytics.js'
import bootstrapRoutes from './routes/bootstrap.js'
import realtimeRoutes from './routes/realtime.js'
import categoriesRoutes from './routes/categories.js'
import advancedAnalyticsRoutes from './routes/advancedAnalytics.js'
import bulkOperationsRoutes from './routes/bulkOperations.js'
import notificationsRoutes from './routes/notifications.js'
import performanceRoutes from './routes/performance.js'
import connectionsRoutes from './routes/connections.js'

// Import middleware
import { errorHandler } from './middleware/errorHandler.js'
import { notFound } from './middleware/notFound.js'
import { requestTiming, memoryMonitor, dbQueryMonitor, rateLimiter } from './middleware/performanceMonitor.js'

// Import database connection
import connectDB from './config/database.js'

// Import WebSocket service
import { initializeWebSocket } from './services/websocketService.js'

// Import cleanup service
import { scheduleCleanup } from './services/emailCleanupService.js'


const app = express()
const PORT = process.env.PORT || 5000

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'", "'unsafe-inline'"], // Allow inline scripts for OAuth callback
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}))

// CORS configuration
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true)
    
    const allowedOrigins = [
      process.env.CORS_ORIGIN || 'http://localhost:3000',
      'http://localhost:3001',
      'http://localhost:3002', 
      'http://localhost:5173',
      'http://localhost:5175',
      'http://localhost:3000'
    ]
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true)
    } else {
      console.log('CORS blocked origin:', origin)
      callback(new Error('Not allowed by CORS'))
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
  exposedHeaders: ['Content-Range', 'X-Content-Range'],
  optionsSuccessStatus: 200
}))

// Rate limiting - TEMPORARILY DISABLED to fix 429 errors
// const limiter = rateLimit({
//   windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
//   max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 1000, // limit each IP to 1000 requests per windowMs
//   message: 'Too many requests from this IP, please try again later.',
//   standardHeaders: true,
//   legacyHeaders: false,
//   skip: (req) => {
//     // Skip rate limiting for critical endpoints to avoid 429 loops
//     return req.path === '/api/auth/me' || 
//            req.path === '/api/analytics/stats' || 
//            req.path === '/api/auth/gmail/connect' ||
//            req.path.startsWith('/api/emails') ||
//            req.path.startsWith('/api/analytics/') ||
//            req.path.startsWith('/api/realtime/')
//   }
// })
// app.use('/api/', limiter)

// Body parsing middleware
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))
app.use(cookieParser())

// Compression middleware
app.use(compression())

// Logging middleware
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'))
} else {
  app.use(morgan('combined'))
}

// Performance monitoring middleware
app.use(requestTiming)
app.use(memoryMonitor)
app.use(dbQueryMonitor)

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV,
    version: '2.0.0'
  })
})

// API routes
app.use('/api/auth', authRoutes)
app.use('/api/emails', emailRoutes)
app.use('/api/users', userRoutes)
app.use('/api/analytics', analyticsRoutes)
app.use('/api/bootstrap', bootstrapRoutes)
app.use('/api/realtime', realtimeRoutes)
app.use('/api/realtime', categoriesRoutes)
app.use('/api/analytics', advancedAnalyticsRoutes)
app.use('/api/bulk', bulkOperationsRoutes)
app.use('/api/notifications', notificationsRoutes)
app.use('/api/performance', performanceRoutes)
app.use('/api/connections', connectionsRoutes)

// OAuth callback routes are now handled under /api/auth

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'Sortify Backend API',
    version: '2.0.0',
    status: 'running',
    endpoints: {
      auth: '/api/auth',
      emails: '/api/emails',
      users: '/api/users',
      analytics: '/api/analytics',
      health: '/health',
    },
  })
})

// Error handling middleware
app.use(notFound)
app.use(errorHandler)

// Start server
const startServer = async () => {
  try {
    console.log('🚀 Starting server initialization...')
    console.log('🌐 Port:', PORT)
    console.log('🔐 Environment variables check:', {
      MONGO_URI: process.env.MONGO_URI ? 'SET' : 'MISSING',
      GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID ? 'SET' : 'MISSING',
      JWT_SECRET: process.env.JWT_SECRET ? 'SET' : 'MISSING'
    })
    
    // Connect to database
    console.log('📊 Connecting to database...')
    await connectDB()
    console.log('✅ Database connected successfully')
    
    // Create HTTP server
    console.log('🔧 Creating HTTP server...')
    const server = createServer(app)
    
    // Initialize WebSocket server
    console.log('🔌 Initializing WebSocket server...')
    try {
      initializeWebSocket(server)
      console.log('✅ WebSocket server initialized')
    } catch (wsError) {
      console.warn('⚠️ WebSocket initialization failed:', wsError.message)
      // Continue without WebSocket
    }
    
    // Start email cleanup scheduler (daily cleanup of full content older than 7 days)
    console.log('🧹 Setting up cleanup scheduler...')
    try {
      scheduleCleanup(7, 24)
      console.log('✅ Email cleanup scheduler started')
    } catch (cleanupError) {
      console.warn('⚠️ Cleanup scheduler failed:', cleanupError.message)
      // Continue without cleanup scheduler
    }
    
    // Start listening
    console.log(`🎯 Starting server on port ${PORT}...`)
    server.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 Server running on port ${PORT}`)
      console.log(`📊 Health check: http://localhost:${PORT}/health`)
      console.log(`🔗 API base: http://localhost:${PORT}/api`)
      console.log(`🔌 WebSocket: ws://localhost:${PORT}/ws`)
      console.log(`🌍 Environment: ${process.env.NODE_ENV}`)
      console.log(`✅ All services started successfully`)
    })
    
    // Add error handling for server startup
    server.on('error', (error) => {
      if (error.code === 'EADDRINUSE') {
        console.error(`❌ Port ${PORT} is already in use`)
        console.log(`💡 Try killing existing processes on port ${PORT}:`)
        console.log(`   lsof -ti:${PORT} | xargs kill -9`)
      } else {
        console.error('❌ Server error:', error)
      }
      process.exit(1)
    })
    
  } catch (error) {
    console.error('❌ Failed to start server:', error)
    console.error('Stack trace:', error.stack)
    process.exit(1)
  }
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.error('❌ Unhandled Promise Rejection:', err)
  process.exit(1)
})

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('❌ Uncaught Exception:', err)
  process.exit(1)
})

// Export app for testing
export default app

startServer()
