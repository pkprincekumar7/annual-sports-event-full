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
import teamRoutes from './routes/teams.js'
import participantRoutes from './routes/participants.js'
import eventScheduleRoutes from './routes/eventSchedule.js'
import exportRoutes from './routes/exports.js'

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
app.use('/api', authRoutes)
app.use('/api', playerRoutes)
app.use('/api', sportsRoutes)
app.use('/api', captainRoutes)
app.use('/api', teamRoutes)
app.use('/api', participantRoutes)
app.use('/api', eventScheduleRoutes)
app.use('/api', exportRoutes)

// Connect to MongoDB
connectDB()

// Routes moved to route modules:
// - /api/me, /api/players, /api/update-player -> routes/players.js
// - /api/sports, /api/sports-counts -> routes/sports.js
// - /api/add-captain, /api/remove-captain, /api/captains-by-sport -> routes/captains.js

// Routes moved to route modules (see routes/captains.js, routes/teams.js)

// Routes moved to route modules (see routes/teams.js)

// Routes moved to routes/teams.js

// Route moved to routes/participants.js

// Routes moved to routes/players.js

// Route moved to routes/participants.js

// Route moved to routes/teams.js

// Route moved to routes/sports.js

// Routes moved to routes/participants.js

// Routes moved to routes/teams.js

// Route moved to routes/players.js

// Routes moved to routes/exports.js

// ==================== Event Schedule API Endpoints ====================
// Routes moved to routes/eventSchedule.js

// Routes moved to routes/eventSchedule.js

// Routes moved to routes/eventSchedule.js

app.listen(PORT, () => {
  logger.server(`Server running on http://localhost:${PORT}`)
  logger.server(`MongoDB connected. Player data stored in MongoDB.`)
})

