import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import connectDB from './config/database.js'
import logger from './utils/logger.js'

// Import middleware
import { authenticateToken, requireAdmin } from './middleware/auth.js'
import { checkRegistrationDeadline } from './middleware/registrationDeadline.js'
import { noCache } from './middleware/noCache.js'

// Import routes
import authRoutes from './routes/auth.js'
import playerRoutes from './routes/players.js'
import sportsRoutes from './routes/sports.js'
import captainRoutes from './routes/captains.js'
import coordinatorRoutes from './routes/coordinators.js'
import batchRoutes from './routes/batches.js'
import teamRoutes from './routes/teams.js'
import participantRoutes from './routes/participants.js'
import eventScheduleRoutes from './routes/eventSchedule.js'
import exportRoutes from './routes/exports.js'
import departmentRoutes from './routes/departments.js'
import eventYearRoutes from './routes/eventYears.js'
import pointsTableRoutes from './routes/pointsTable.js'

const app = express()
const PORT = process.env.PORT || 3001

// Disable ETag generation (Express default)
app.set('etag', false)

// Middleware
// Allow all origins, methods, and headers - most permissive configuration for Netlify
app.use(cors())
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// Apply API middleware
app.use('/api', checkRegistrationDeadline)
app.use('/api', noCache)

// Use route modules
// IMPORTANT: More specific routes must be registered BEFORE generic /api routes
app.use('/api/event-years', eventYearRoutes)
app.use('/api/departments', departmentRoutes)

// Generic /api routes (registered after specific routes)
app.use('/api', authRoutes)
app.use('/api', playerRoutes)
app.use('/api', sportsRoutes)
app.use('/api', captainRoutes)
app.use('/api', coordinatorRoutes)
app.use('/api', batchRoutes)
app.use('/api', teamRoutes)
app.use('/api', participantRoutes)
app.use('/api', eventScheduleRoutes)
app.use('/api', exportRoutes)
app.use('/api', pointsTableRoutes)

// 404 handler for API routes (after all routes)
app.use('/api/*', (req, res) => {
  res.status(404).json({ error: 'Route not found', path: req.originalUrl })
})

// Connect to MongoDB
connectDB()

app.listen(PORT, () => {
  logger.server(`Server running on http://localhost:${PORT}`)
  logger.server(`MongoDB connected. Player data stored in MongoDB.`)
})

