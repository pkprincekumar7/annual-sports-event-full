import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import XLSX from 'xlsx'
import jwt from 'jsonwebtoken'
import connectDB from './config/database.js'
import Player from './models/Player.js'
import EventSchedule from './models/EventSchedule.js'
import logger from './utils/logger.js'

const app = express()
const PORT = process.env.PORT || 3001

// JWT Secret (in production, use environment variable)
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production'
const JWT_EXPIRES_IN = '24h' // Token expires in 24 hours

// Disable ETag generation (Express default)
app.set('etag', false)

// Middleware
// Allow all origins, methods, and headers - most permissive configuration for Netlify
app.use(cors())
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// Registration deadline middleware - block non-GET requests after January 6th, 2026
// Date objects use the server's local timezone
// Parse deadline from env or use default: January 7th, 2026 00:00:00 (local timezone)
const deadlineEnv = process.env.REGISTRATION_DEADLINE || '2026-01-07T00:00:00'
const REGISTRATION_DEADLINE = new Date(deadlineEnv)

app.use('/api', (req, res, next) => {
  const currentDate = new Date() // Uses server's local timezone
  
  // If current date is after the registration deadline
  if (currentDate >= REGISTRATION_DEADLINE) {
    // Allow GET requests and login endpoint
    if (req.method !== 'GET' && req.path !== '/login') {
      return res.status(400).json({
        success: false,
        error: 'Registration for events closed on January 6th, 2026.'
      })
    }
  }
  
  next()
})

// Disable caching for all API responses
app.use('/api', (req, res, next) => {
  // Remove conditional request headers that cause 304 responses
  delete req.headers['if-modified-since']
  delete req.headers['if-none-match']
  delete req.headers['if-match']
  delete req.headers['if-unmodified-since']
  
  // Remove any existing ETag or Last-Modified headers from response
  res.removeHeader('ETag')
  res.removeHeader('Last-Modified')
  
  // Set no-cache headers to prevent 304 responses
  res.set({
    'Cache-Control': 'no-store, no-cache, must-revalidate, private',
    'Pragma': 'no-cache',
    'Expires': '0'
  })
  
  next()
})

// JWT Authentication Middleware
// Verifies JWT token and checks if user exists in the database
const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization']
  const token = authHeader && authHeader.split(' ')[1] // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ 
      success: false, 
      error: 'Access token required. Please login first.' 
    })
  }

  jwt.verify(token, JWT_SECRET, async (err, decoded) => {
    if (err) {
      return res.status(403).json({ 
        success: false, 
        error: 'Invalid or expired token. Please login again.' 
      })
    }
    
    // Verify that the user exists in the players database
    try {
      const userExists = await Player.findOne({ reg_number: decoded.reg_number }).select('-password')
      if (!userExists) {
        return res.status(403).json({ 
          success: false, 
          error: 'User not found in database. Please login again.' 
        })
      }
      
      // Attach user info to request (from database, not just token)
      req.user = {
        reg_number: decoded.reg_number,
        full_name: decoded.full_name,
        isAdmin: decoded.isAdmin
      }
      next()
    } catch (error) {
      logger.error('Error verifying user in database:', error)
      return res.status(500).json({ 
        success: false, 
        error: 'Failed to verify user. Please try again.' 
      })
    }
  })
}

// Admin-only Middleware (must be used after authenticateToken)
const requireAdmin = (req, res, next) => {
  if (req.user.reg_number !== 'admin') {
    return res.status(403).json({ 
      success: false, 
      error: 'Admin access required' 
    })
  }
  next()
}

// Connect to MongoDB
connectDB()

// API endpoint to get current user data (requires authentication)
// More efficient than fetching all players just to get one user
app.get('/api/me', authenticateToken, async (req, res) => {
  try {
    const user = await Player.findOne({ reg_number: req.user.reg_number }).select('-password').lean()
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        error: 'User not found' 
      })
    }
    res.json({ success: true, player: user })
  } catch (error) {
    logger.error('Error fetching current user data:', error)
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch user data',
      details: error.message 
    })
  }
})

// API endpoint to get all players (requires authentication)
app.get('/api/players', authenticateToken, async (req, res) => {
  try {
    const players = await Player.find({}).select('-password').lean()
    res.json({ success: true, players })
  } catch (error) {
    logger.error('Error reading players data:', error)
    res.status(500).json({ 
      success: false, 
      error: 'Failed to read players data',
      details: error.message 
    })
  }
})

// API endpoint to get team sports (for captain assignment - admin only)
app.get('/api/sports', authenticateToken, requireAdmin, (req, res) => {
  try {
    // Only Team Events can have captains
    const teamSports = [
      'Cricket',
      'Volleyball',
      'Badminton',
      'Table Tennis',
      'Kabaddi',
      'Relay 4×100 m',
      'Relay 4×400 m',
    ]
    res.json({ success: true, sports: teamSports })
  } catch (error) {
    logger.error('Error getting sports list:', error)
    res.status(500).json({ 
      success: false, 
      error: 'Failed to get sports list',
      details: error.message 
    })
  }
})

// API endpoint to add captain (Admin only)
app.post('/api/add-captain', authenticateToken, requireAdmin, async (req, res) => {
  try {
    let { reg_number, sport } = req.body

    // Trim fields
    reg_number = reg_number?.trim()
    sport = sport?.trim()

    // Validate required fields
    if (!reg_number || !sport) {
      return res.status(400).json({ 
        success: false, 
        error: 'Registration number and sport are required' 
      })
    }

    // Validate sport is a team sport
    const teamSports = [
      'Cricket',
      'Volleyball',
      'Badminton',
      'Table Tennis',
      'Kabaddi',
      'Relay 4×100 m',
      'Relay 4×400 m',
    ]
    if (!teamSports.includes(sport)) {
      return res.status(400).json({ 
        success: false, 
        error: `Invalid sport. Only team sports can have captains: ${teamSports.join(', ')}` 
      })
    }

    // Find player
    const player = await Player.findOne({ reg_number })
    if (!player) {
      return res.status(404).json({ 
        success: false, 
        error: 'Player not found' 
      })
    }

    // Initialize captain_in array if it doesn't exist
    if (!player.captain_in) {
      player.captain_in = []
    }

    // Check if already a captain for this sport (uniqueness check)
    if (player.captain_in.includes(sport)) {
      return res.status(400).json({ 
        success: false, 
        error: `Player is already a captain for ${sport}` 
      })
    }

    // Check for duplicate elements in captain_in array
    const captainInSet = new Set(player.captain_in)
    if (captainInSet.size !== player.captain_in.length) {
      return res.status(400).json({ 
        success: false, 
        error: 'captain_in array contains duplicate entries. Please fix the data first.' 
      })
    }

    // Check maximum limit: captain_in array can have maximum 10 unique entries
    const currentCaptainCount = player.captain_in.length
    if (currentCaptainCount >= 10) {
      return res.status(400).json({ 
        success: false, 
        error: 'Maximum 10 captain roles allowed. Please remove a captain assignment first.' 
      })
    }

    // Initialize participated_in array if it doesn't exist
    if (!player.participated_in) {
      player.participated_in = []
    }

    // Check for duplicate sport entries in participated_in array (uniqueness check)
    const sportSet = new Set(player.participated_in.map(p => p.sport))
    if (sportSet.size !== player.participated_in.length) {
      return res.status(400).json({ 
        success: false, 
        error: 'participated_in array contains duplicate sport entries. Please fix the data first.' 
      })
    }

    // Check maximum limit: participated_in array can have maximum 10 unique entries (based on sport name)
    const currentParticipationsCount = player.participated_in.length
    if (currentParticipationsCount >= 10) {
      return res.status(400).json({ 
        success: false, 
        error: 'Maximum 10 participations allowed (based on unique sport names). Please remove a participation first.' 
      })
    }

    // Count non-team participations (entries without team_name)
    const nonTeamParticipations = player.participated_in.filter(
      p => !p.team_name
    ).length

    // Count team participations where sport IS in captain_in array (these count towards captain limit)
    const captainTeamParticipations = player.participated_in.filter(
      p => p.team_name && 
      player.captain_in && 
      Array.isArray(player.captain_in) && 
      player.captain_in.includes(p.sport)
    ).length

    // Check: (captain_in length + non-team participated_in) should not exceed 10
    if (currentCaptainCount + nonTeamParticipations >= 10) {
      return res.status(400).json({ 
        success: false, 
        error: `Cannot add captain role. Total (captain roles + non-team participations) cannot exceed 10. Current: ${currentCaptainCount} captain role(s) + ${nonTeamParticipations} non-team participation(s) = ${currentCaptainCount + nonTeamParticipations}.` 
      })
    }

    // Check: team participations (for captain sports) should not exceed captain_in length
    // After adding this new captain role, max team participations for captain sports = currentCaptainCount + 1
    if (captainTeamParticipations >= currentCaptainCount + 1) {
      return res.status(400).json({ 
        success: false, 
        error: `Cannot add captain role. Maximum team participations allowed for sports in captain_in array is ${currentCaptainCount + 1} (equal to captain roles). Current team participations for captain sports: ${captainTeamParticipations}.` 
      })
    }

    // Check if player is already a participant in a team for this sport
    // If they are, the team already has a captain (teams cannot be created/updated without exactly one captain)
    // So we should prevent adding this player as captain if they're not already the captain
    const existingTeamParticipation = player.participated_in.find(
      p => p.sport === sport && p.team_name
    )

    if (existingTeamParticipation) {
      // Player is already in a team for this sport
      // Check if they're already the captain for this sport
      const isAlreadyCaptain = player.captain_in && 
                               Array.isArray(player.captain_in) && 
                               player.captain_in.includes(sport)
      
      if (!isAlreadyCaptain) {
        // Player is in a team but not the captain, which means the team already has a captain
        // We cannot add this player as captain because a team can only have one captain
        return res.status(400).json({ 
          success: false, 
          error: `Cannot add captain role. Player is already in team "${existingTeamParticipation.team_name}" for ${sport}, which already has a captain. A team can only have one captain.` 
        })
      }
      // If they're already the captain, the duplicate check above will catch it
    }

    // Add sport to captain_in array
    player.captain_in.push(sport)
    await player.save()

    // Return player data (excluding password for security)
    const playerData = player.toObject()
    delete playerData.password

    res.json({ 
      success: true, 
      message: `Captain added successfully for ${sport}`,
      player: playerData
    })
  } catch (error) {
    logger.error('Error adding captain:', error)
    res.status(500).json({ 
      success: false, 
      error: 'Failed to add captain',
      details: error.message 
    })
  }
})

// API endpoint to remove captain
app.delete('/api/remove-captain', authenticateToken, requireAdmin, async (req, res) => {
  try {
    let { reg_number, sport } = req.body

    // Trim fields
    reg_number = reg_number?.trim()
    sport = sport?.trim()

    // Validate required fields
    if (!reg_number || !sport) {
      return res.status(400).json({ 
        success: false, 
        error: 'Registration number and sport are required' 
      })
    }

    // Validate sport is a team sport
    const teamSports = [
      'Cricket',
      'Volleyball',
      'Badminton',
      'Table Tennis',
      'Kabaddi',
      'Relay 4×100 m',
      'Relay 4×400 m',
    ]
    if (!teamSports.includes(sport)) {
      return res.status(400).json({ 
        success: false, 
        error: `Invalid sport. Only team sports can have captains: ${teamSports.join(', ')}` 
      })
    }

    // Find player
    const player = await Player.findOne({ reg_number })
    if (!player) {
      return res.status(404).json({ 
        success: false, 
        error: 'Player not found' 
      })
    }

    // Initialize captain_in array if it doesn't exist
    if (!player.captain_in) {
      player.captain_in = []
    }

    // Check if player is a captain for this sport
    if (!player.captain_in.includes(sport)) {
      return res.status(400).json({ 
        success: false, 
        error: `Player is not a captain for ${sport}` 
      })
    }

    // Check if player has created a team for this sport
    if (player.participated_in && Array.isArray(player.participated_in)) {
      const teamParticipation = player.participated_in.find(
        p => p.sport === sport && p.team_name
      )
      
      if (teamParticipation) {
        return res.status(400).json({ 
          success: false, 
          error: `Cannot remove captain role. Player has already created a team (${teamParticipation.team_name}) for ${sport}. Please delete the team first.` 
        })
      }
    }

    // Remove sport from captain_in array
    player.captain_in = player.captain_in.filter(
      s => s !== sport
    )

    await player.save()

    // Return player data (excluding password for security)
    const playerData = player.toObject()
    delete playerData.password

    res.json({ 
      success: true, 
      message: `Captain role removed successfully for ${sport}`,
      player: playerData
    })
  } catch (error) {
    logger.error('Error removing captain:', error)
    res.status(500).json({ 
      success: false, 
      error: 'Failed to remove captain',
      details: error.message 
    })
  }
})

// API endpoint to get captains by sport
app.get('/api/captains-by-sport', authenticateToken, requireAdmin, async (req, res) => {
  try {
    // Query directly for players who are captains (have captain_in array with values)
    const captains = await Player.find({
      reg_number: { $ne: 'admin' },
      captain_in: { $exists: true, $ne: [] }
    }).select('-password').lean()

    // Group captains by sport
    const captainsBySport = {}

    // Define team sports
    const teamSports = [
      'Cricket',
      'Volleyball',
      'Badminton',
      'Table Tennis',
      'Kabaddi',
      'Relay 4×100 m',
      'Relay 4×400 m',
    ]

    // Initialize all team sports
    teamSports.forEach(sport => {
      captainsBySport[sport] = []
    })

    // Group captains by sport
    captains.forEach(player => {
      if (player.captain_in && Array.isArray(player.captain_in)) {
        player.captain_in.forEach(sport => {
          if (teamSports.includes(sport)) {
            if (!captainsBySport[sport]) {
              captainsBySport[sport] = []
            }
            const { password: _, ...playerData } = player
            captainsBySport[sport].push(playerData)
          }
        })
      }
    })

    res.json({ 
      success: true, 
      captainsBySport 
    })
  } catch (error) {
    logger.error('Error fetching captains by sport:', error)
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch captains by sport',
      details: error.message 
    })
  }
})

// API endpoint to validate participations before team registration
app.post('/api/validate-participations', authenticateToken, async (req, res) => {
  try {
    let { reg_numbers, sport } = req.body

    // Trim fields
    sport = sport?.trim()
    if (Array.isArray(reg_numbers)) {
      reg_numbers = reg_numbers.map(rn => rn?.trim()).filter(rn => rn)
    }

    // Validate required fields
    if (!reg_numbers || !Array.isArray(reg_numbers) || reg_numbers.length === 0 || !sport) {
      return res.status(400).json({ 
        success: false, 
        error: 'Registration numbers array and sport are required' 
      })
    }

    const errors = []

    // Fetch all players at once instead of one by one (optimized: single query)
    const players = await Player.find({ reg_number: { $in: reg_numbers } }).select('-password').lean()
    const playersMap = new Map(players.map(p => [p.reg_number, p]))

    // Validate each player
    for (const reg_number of reg_numbers) {
      const player = playersMap.get(reg_number)
      if (!player) {
        errors.push(`Player with reg_number ${reg_number} not found`)
        continue
      }

      // Initialize participated_in array if it doesn't exist
      if (!player.participated_in) {
        player.participated_in = []
      }

      // Check if already participated in this sport (for team events, player can only be in one team per sport)
      const existingParticipation = player.participated_in.find(p => p.sport === sport)
      if (existingParticipation) {
        if (existingParticipation.team_name) {
          // Check if this player is a captain for this sport
          const isCaptain = player.captain_in && Array.isArray(player.captain_in) && player.captain_in.includes(sport)
          if (isCaptain) {
            errors.push(`${player.full_name} (${reg_number}) is a captain and has already created a team (${existingParticipation.team_name}) for ${sport}. A captain cannot create multiple teams for the same sport.`)
          } else {
            errors.push(`${player.full_name} (${reg_number}) is already in a team (${existingParticipation.team_name}) for ${sport}. A player can only belong to one team per sport.`)
          }
        } else {
          errors.push(`${player.full_name} (${reg_number}) is already registered for ${sport}`)
        }
        continue
      }

      // Check for duplicate sport entries in participated_in array (uniqueness check)
      const sportSet = new Set(player.participated_in.map(p => p.sport))
      if (sportSet.size !== player.participated_in.length) {
        errors.push(`${player.full_name} (${reg_number}) has duplicate sport entries in participated_in array. Please fix the data first.`)
        continue
      }

      // Check maximum limit: participated_in array can have maximum 10 unique entries (based on sport name)
      const currentParticipationsCount = player.participated_in.length
      if (currentParticipationsCount >= 10) {
        errors.push(`${player.full_name} (${reg_number}) has reached maximum 10 participations (based on unique sport names). Please remove a participation first.`)
        continue
      }

      // Count non-team participations (entries without team_name)
      const nonTeamParticipations = player.participated_in.filter(
        p => !p.team_name
      ).length

      // Count team participations where sport IS in captain_in array (these count towards captain limit)
      const captainTeamParticipations = player.participated_in.filter(
        p => p.team_name && 
        player.captain_in && 
        Array.isArray(player.captain_in) && 
        player.captain_in.includes(p.sport)
      ).length

      // Get captain count
      const captainCount = player.captain_in && Array.isArray(player.captain_in) 
        ? player.captain_in.length 
        : 0
      
      // Check if this is a team event (has team_name in the request context)
      // For team events: check if sport is in captain_in array
      const isCaptainForSport = player.captain_in && 
        Array.isArray(player.captain_in) && 
        player.captain_in.includes(sport)
      
      if (isCaptainForSport) {
        // This is a team event where the player IS a captain for this sport
        // Check: team participations (for captain sports) should not exceed captain_in length
        if (captainTeamParticipations >= captainCount) {
          errors.push(`${player.full_name} (${reg_number}) has reached maximum team participations for captain sports (${captainCount}). Maximum team participations allowed for sports in captain_in array is equal to captain roles (${captainCount}).`)
          continue
        }
      } else {
        // This could be either:
        // 1. A team event where the player is NOT a captain (allowed, no limit check)
        // 2. A non-team event
        // For non-team events: check (captain_in length + non-team participated_in) should not exceed 10
        // Note: We can't distinguish here, so we'll check non-team limit in update-participation endpoint
        // For team events with non-captain: no limit check needed
      }
    }

    // Check for multiple captains in the same request (reuse playersMap to avoid duplicate query)
    const captainsInRequest = players
      .filter(s => s && s.captain_in && Array.isArray(s.captain_in) && s.captain_in.includes(sport))

    if (captainsInRequest.length > 1) {
      const captainNames = captainsInRequest.map(s => `${s.full_name} (${s.reg_number})`)
      errors.push(`Multiple captains found in the same team registration: ${captainNames.join(', ')}. A team can only have exactly one captain for ${sport}.`)
    }

    // Validate that exactly one captain is in the team
    if (captainsInRequest.length === 0) {
      errors.push(`Team must have exactly one captain for ${sport}. At least one player in the team must be assigned as captain for this sport.`)
    } else if (captainsInRequest.length !== 1) {
      errors.push(`Team must have exactly one captain for ${sport}. Found ${captainsInRequest.length} captains.`)
    }

    // Validate that the logged-in user is included in the team
    // Validate that the logged-in user is the captain for this sport
    // Note: User existence in database is already verified by authenticateToken middleware
    // Only the captain assigned to a sport can create teams for that sport
    const loggedInUserRegNumber = req.user?.reg_number
    if (loggedInUserRegNumber) {
      // Get logged-in user from database (use playersMap if available, otherwise fetch)
      let loggedInUserInDatabase = playersMap.get(loggedInUserRegNumber)
      if (!loggedInUserInDatabase) {
        loggedInUserInDatabase = await Player.findOne({ reg_number: loggedInUserRegNumber }).select('-password').lean()
      }
      
      // Check if logged-in user is included in the team request
      const loggedInUserInRequest = reg_numbers.includes(loggedInUserRegNumber)
      if (!loggedInUserInRequest) {
        errors.push(`You must be included in the team to create it.`)
      }
      
      // Check if logged-in user is a captain for this sport
      const isLoggedInUserCaptain = loggedInUserInDatabase && loggedInUserInDatabase.captain_in && 
        Array.isArray(loggedInUserInDatabase.captain_in) && 
        loggedInUserInDatabase.captain_in.includes(sport)
      
      if (!isLoggedInUserCaptain) {
        errors.push(`You can only create teams for sports where you are assigned as captain. You are not assigned as captain for ${sport}.`)
      }
    }

    if (errors.length > 0) {
      return res.status(400).json({ 
        success: false, 
        error: errors.join('; ')
      })
    }

    res.json({ 
      success: true, 
      message: 'All players can participate'
    })
  } catch (error) {
    logger.error('Error validating participations:', error)
    res.status(500).json({ 
      success: false, 
      error: 'Failed to validate participations',
      details: error.message 
    })
  }
})

// API endpoint to update participated_in field for team events
app.post('/api/update-team-participation', authenticateToken, async (req, res) => {
  try {
    let { reg_numbers, sport, team_name } = req.body

    // Trim fields
    sport = sport?.trim()
    team_name = team_name?.trim()

    // Validate required fields
    if (!reg_numbers || !Array.isArray(reg_numbers) || reg_numbers.length === 0 || !sport || !team_name) {
      return res.status(400).json({ 
        success: false, 
        error: 'Registration numbers array, sport, and team name are required' 
      })
    }

    // Trim and validate team name
    if (team_name.length === 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'Team name cannot be empty' 
      })
    }

    // Trim reg_numbers array
    reg_numbers = reg_numbers.map(rn => rn?.trim()).filter(rn => rn)

    // Check for duplicate players in the team
    const regNumberSet = new Set()
    const duplicates = []
    for (const reg_number of reg_numbers) {
      if (regNumberSet.has(reg_number)) {
        duplicates.push(reg_number)
      } else {
        regNumberSet.add(reg_number)
      }
    }
    if (duplicates.length > 0) {
      return res.status(400).json({ 
        success: false, 
        error: `Duplicate players found in team: ${duplicates.join(', ')}. Each player can only be selected once.` 
      })
    }

    // Check if a team with the same name already exists for this sport
    // Optimized: Query all teams for this sport, then check case-insensitive match in application
    // This avoids regex in MongoDB query which is slower
    const playersWithTeams = await Player.find({
      participated_in: {
        $elemMatch: {
          sport: sport,
          team_name: { $exists: true, $ne: null }
        }
      }
    }).select('participated_in').lean()
    
    // Check for case-insensitive match in application code (more efficient than regex in query)
    const teamExists = playersWithTeams.some(player => 
      player.participated_in?.some(
        p => p.sport === sport && p.team_name && p.team_name.toLowerCase() === team_name.toLowerCase()
      )
    )

    if (teamExists) {
      return res.status(400).json({ 
        success: false, 
        error: `Team name "${team_name}" already exists for ${sport}. Please choose a different team name.` 
      })
    }

    // Fetch all players at once instead of one by one (optimized: exclude password)
    const players = await Player.find({ reg_number: { $in: reg_numbers } }).select('-password')
    const playersMap = new Map(players.map(p => [p.reg_number, p]))

    // Validate all players exist
    const playerData = []
    const errors = []

    for (const reg_number of reg_numbers) {
      const player = playersMap.get(reg_number)
      if (!player) {
        errors.push(`Player with reg_number ${reg_number} not found`)
        continue
      }
      playerData.push(player)
    }

    if (errors.length > 0) {
      return res.status(400).json({ 
        success: false, 
        error: errors.join('; ')
      })
    }

    // Check that all players have the same gender
    if (playerData.length > 0) {
      const firstGender = playerData[0].gender
      const genderMismatches = playerData
        .filter(p => p.gender !== firstGender)
        .map(p => `${p.full_name} (${p.reg_number})`)
      
      if (genderMismatches.length > 0) {
        return res.status(400).json({ 
          success: false, 
          error: `Gender mismatch: ${genderMismatches.join(', ')} must have the same gender (${firstGender}) as other team members.` 
        })
      }

      // Check that all players have the same year
      const firstYear = playerData[0].year
      const yearMismatches = playerData
        .filter(p => p.year !== firstYear)
        .map(p => `${p.full_name} (${p.reg_number})`)
      
      if (yearMismatches.length > 0) {
        return res.status(400).json({ 
          success: false, 
          error: `Year mismatch: ${yearMismatches.join(', ')} must be in the same year (${firstYear}) as other team members.` 
        })
      }
    }

    // Check for multiple captains in the same team
    // A team can only have exactly one captain for a specific sport
    const captainsInTeam = playerData.filter(p => 
      p.captain_in && 
      Array.isArray(p.captain_in) && 
      p.captain_in.includes(sport)
    )

    if (captainsInTeam.length > 1) {
      const captainNames = captainsInTeam.map(p => `${p.full_name} (${p.reg_number})`)
      return res.status(400).json({ 
        success: false, 
        error: `Multiple captains found in the same team: ${captainNames.join(', ')}. A team can only have exactly one captain for ${sport}.` 
      })
    }

    // Validate that exactly one captain is in the team
    if (captainsInTeam.length === 0) {
      return res.status(400).json({ 
        success: false, 
        error: `Team must have exactly one captain for ${sport}. At least one player in the team must be assigned as captain for this sport.` 
      })
    }

    // Validate that the logged-in user is included in the team
    // Validate that the logged-in user is the captain for this sport
    // Note: User existence in database is already verified by authenticateToken middleware
    // Only the captain assigned to a sport can create teams for that sport
    const loggedInUserRegNumber = req.user?.reg_number
    if (loggedInUserRegNumber) {
      // Get logged-in user from already fetched players (reuse playersMap)
      const loggedInUserInDatabase = playersMap.get(loggedInUserRegNumber)
      if (!loggedInUserInDatabase) {
        return res.status(403).json({ 
          success: false, 
          error: `You must be included in the team to create it.` 
        })
      }
      
      // Check if logged-in user is included in the team
      const loggedInUserInTeam = playerData.find(p => p.reg_number === loggedInUserRegNumber)
      if (!loggedInUserInTeam) {
        return res.status(403).json({ 
          success: false, 
          error: `You must be included in the team to create it.` 
        })
      }
      
      // Check if logged-in user is a captain for this sport
      const isLoggedInUserCaptain = loggedInUserInDatabase.captain_in && 
        Array.isArray(loggedInUserInDatabase.captain_in) && 
        loggedInUserInDatabase.captain_in.includes(sport)
      
      if (!isLoggedInUserCaptain) {
        return res.status(403).json({ 
          success: false, 
          error: `You can only create teams for sports where you are assigned as captain. You are not assigned as captain for ${sport}.` 
        })
      }
    }

    // Check if there's already a captain in the existing team (if team already exists)
    // Find all players who are already in this team for this sport
    // Use $elemMatch to ensure we match the same array element
    // Optimized: exclude password and use lean for better performance
    const existingTeamMembers = await Player.find({
      participated_in: {
        $elemMatch: {
          sport: sport,
          team_name: team_name
        }
      }
    }).select('-password').lean()

    // Check if any existing team member is a captain for this sport
    const existingCaptains = existingTeamMembers.filter(s => 
      s.captain_in && 
      Array.isArray(s.captain_in) && 
      s.captain_in.includes(sport)
    )

    // If there's already a captain in the team, and we're trying to add another captain
    if (existingCaptains.length > 0 && captainsInTeam.length > 0) {
      const existingCaptainName = existingCaptains[0].full_name
      const newCaptainName = captainsInTeam[0].full_name
      return res.status(400).json({ 
        success: false, 
        error: `Team "${team_name}" already has a captain (${existingCaptainName}) for ${sport}. Cannot add another captain (${newCaptainName}). A team can only have one captain.` 
      })
    }

    const updatedPlayers = []

    // Process each player (reuse players already fetched above)
    for (const reg_number of reg_numbers) {
      const player = playersMap.get(reg_number)
      if (!player) {
        // This shouldn't happen as we already validated, but check anyway
        errors.push(`Player with reg_number ${reg_number} not found`)
        continue
      }

      // Initialize participated_in array if it doesn't exist
      if (!player.participated_in) {
        player.participated_in = []
      }

      // Check for duplicate sport entries in participated_in array (uniqueness check)
      const sportSet = new Set(player.participated_in.map(p => p.sport))
      if (sportSet.size !== player.participated_in.length) {
        errors.push(`${player.full_name} (${reg_number}) has duplicate sport entries in participated_in array. Please fix the data first.`)
        continue
      }

      // Check maximum limit: participated_in array can have maximum 10 unique entries (based on sport name)
      const currentParticipationsCount = player.participated_in.length
      if (currentParticipationsCount >= 10) {
        errors.push(`${player.full_name} (${reg_number}) has reached maximum 10 participations (based on unique sport names). Please remove a participation first.`)
        continue
      }

      // Check if already participated in this sport (for team events, player can only be in one team per sport)
      const existingParticipation = player.participated_in.find(
        p => p.sport === sport
      )

      if (existingParticipation) {
        if (existingParticipation.team_name) {
          // Check if this player is a captain for this sport
          const isCaptain = player.captain_in && 
            Array.isArray(player.captain_in) && 
            player.captain_in.includes(sport)
          
          if (isCaptain) {
            errors.push(`${player.full_name} (${reg_number}) is a captain and has already created a team (${existingParticipation.team_name}) for ${sport}. A captain cannot create multiple teams for the same sport.`)
          } else {
            errors.push(`${player.full_name} (${reg_number}) is already in a team (${existingParticipation.team_name}) for ${sport}. A player can only belong to one team per sport.`)
          }
        } else {
          errors.push(`${player.full_name} (${reg_number}) is already registered for ${sport}`)
        }
        continue
      }

      // Check if this player is a captain for this sport
      const isCaptainForSport = player.captain_in && 
        Array.isArray(player.captain_in) && 
        player.captain_in.includes(sport)
      
      // Count team participations where sport IS in captain_in array (these count towards captain limit)
      const captainTeamParticipations = player.participated_in.filter(
        p => p.team_name && 
        player.captain_in && 
        Array.isArray(player.captain_in) && 
        player.captain_in.includes(p.sport)
      ).length

      // Get captain count
      const captainCount = player.captain_in && Array.isArray(player.captain_in) 
        ? player.captain_in.length 
        : 0

      // Only check limit if this sport IS in captain_in array
      // If player is a captain for this sport, check: team participations (for captain sports) should not exceed captain_in length
      if (isCaptainForSport) {
        if (captainTeamParticipations >= captainCount) {
          errors.push(`${player.full_name} (${reg_number}) has reached maximum team participations for captain sports (${captainCount}). Maximum team participations allowed for sports in captain_in array is equal to captain roles (${captainCount}).`)
          continue
        }
      }
      // If player is NOT a captain for this sport, they can still join the team (no limit check)

      // Add sport to participated_in array with team_name
      player.participated_in.push({ sport, team_name })
      await player.save()
      updatedPlayers.push(player.reg_number)
    }

    if (errors.length > 0) {
      return res.status(400).json({ 
        success: false, 
        error: errors.join('; '),
        updated_count: updatedPlayers.length
      })
    }

    res.json({ 
      success: true, 
      message: `Participation updated successfully for ${updatedPlayers.length} player(s)`,
      updated_count: updatedPlayers.length
    })
  } catch (error) {
    logger.error('Error updating team participation:', error)
    res.status(500).json({ 
      success: false, 
      error: 'Failed to update team participation',
      details: error.message 
    })
  }
})

// API endpoint to update participated_in field
app.post('/api/update-participation', authenticateToken, async (req, res) => {
  try {
    let { reg_number, sport } = req.body

    // Trim fields
    reg_number = reg_number?.trim()
    sport = sport?.trim()

    // Validate required fields
    if (!reg_number || !sport) {
      return res.status(400).json({ 
        success: false, 
        error: 'Registration number and sport are required' 
      })
    }

    // List of Team Events sports (individual registration not allowed)
    const teamSports = [
      'Cricket', 'Volleyball', 'Badminton', 'Table Tennis', 'Kabaddi', 
      'Relay 4×100 m', 'Relay 4×400 m'
    ]

    // Check if the sport is a Team Event (individual registration not allowed)
    if (teamSports.includes(sport)) {
      return res.status(400).json({ 
        success: false, 
        error: `${sport} is a Team Event. Individual registration is not allowed. Please register as a team.` 
      })
    }

    // Find player
    const player = await Player.findOne({ reg_number })
    if (!player) {
      return res.status(404).json({ 
        success: false, 
        error: 'Player not found' 
      })
    }

    // Initialize participated_in array if it doesn't exist
    if (!player.participated_in) {
      player.participated_in = []
    }

    // Check for duplicate sport entries in participated_in array (uniqueness check)
    const sportSet = new Set(player.participated_in.map(p => p.sport))
    if (sportSet.size !== player.participated_in.length) {
      return res.status(400).json({ 
        success: false, 
        error: 'participated_in array contains duplicate sport entries. Please fix the data first.' 
      })
    }

    // Check maximum limit: participated_in array can have maximum 10 unique entries (based on sport name)
    const currentParticipationsCount = player.participated_in.length
    if (currentParticipationsCount >= 10) {
      return res.status(400).json({ 
        success: false, 
        error: 'Maximum 10 participations allowed (based on unique sport names). Please remove a participation first.' 
      })
    }

    // Check if already participated in this sport (same sport cannot be participated twice)
    const existingParticipation = player.participated_in.find(
      p => p.sport === sport
    )

    if (existingParticipation) {
      return res.status(400).json({ 
        success: false, 
        error: `You are already registered for ${sport}. Same sport cannot be participated twice.` 
      })
    }

    // Count non-team participations (entries without team_name)
    const nonTeamParticipations = player.participated_in.filter(
      p => !p.team_name
    ).length

    // Get captain count
    const captainCount = player.captain_in && Array.isArray(player.captain_in) 
      ? player.captain_in.length 
      : 0
    
    // Check maximum limit: (captain_in length + non-team participated_in) should not exceed 10
    if (captainCount + nonTeamParticipations >= 10) {
      const remainingSlots = 10 - captainCount
      if (remainingSlots <= 0) {
        return res.status(400).json({ 
          success: false, 
          error: `Maximum limit reached. You are a captain in ${captainCount} sport(s). You cannot register for any non-team events. Total (captain roles + non-team participations) cannot exceed 10.` 
        })
      } else {
        return res.status(400).json({ 
          success: false, 
          error: `Maximum limit reached. You are a captain in ${captainCount} sport(s) and have ${nonTeamParticipations} non-team participation(s). You can only register for ${remainingSlots} more non-team event(s). Total (captain roles + non-team participations) cannot exceed 10.` 
        })
      }
    }

    // Add sport to participated_in array (without team_name for individual events)
    player.participated_in.push({ sport })
    await player.save()

    // Return player data (excluding password for security)
    const playerData = player.toObject()
    delete playerData.password

    res.json({ 
      success: true, 
      message: `Participation updated successfully for ${sport}`,
      player: playerData
    })
  } catch (error) {
    logger.error('Error updating participation:', error)
    res.status(500).json({ 
      success: false, 
      error: 'Failed to update participation',
      details: error.message 
    })
  }
})

// API endpoint for login
app.post('/api/login', async (req, res) => {
  try {
    let { reg_number, password } = req.body

    // Trim fields
    reg_number = reg_number?.trim()
    password = password?.trim()

    // Validate required fields
    if (!reg_number || !password) {
      return res.status(400).json({ 
        success: false, 
        error: 'Registration number and password are required' 
      })
    }

    // Find player with matching reg_number
    const player = await Player.findOne({ reg_number })

    if (!player) {
      return res.status(401).json({ 
        success: false, 
        error: 'Invalid registration number or password' 
      })
    }

    // Check password
    if (player.password !== password) {
      return res.status(401).json({ 
        success: false, 
        error: 'Invalid registration number or password' 
      })
    }

    // Initialize participated_in and captain_in if they don't exist
    if (!player.participated_in) {
      player.participated_in = []
    }
    if (!player.captain_in) {
      player.captain_in = []
    }
    await player.save()

    // Generate JWT token
    const tokenPayload = {
      reg_number: player.reg_number,
      full_name: player.full_name,
      isAdmin: player.reg_number === 'admin'
    }

    const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN })

    // Return player data (excluding password for security) and token
    const playerData = player.toObject()
    delete playerData.password

    res.json({ 
      success: true, 
      message: 'Login successful',
      player: playerData,
      token: token
    })
  } catch (error) {
    logger.error('Error during login:', error)
    res.status(500).json({ 
      success: false, 
      error: 'Failed to process login',
      details: error.message 
    })
  }
})

// API endpoint to save player data
app.post('/api/save-player', async (req, res) => {
  try {
    let { reg_number, full_name, gender, department_branch, year, mobile_number, email_id, password } = req.body

    // Trim all string fields
    reg_number = reg_number?.trim()
    full_name = full_name?.trim()
    gender = gender?.trim()
    department_branch = department_branch?.trim()
    year = year?.trim()
    mobile_number = mobile_number?.trim()
    email_id = email_id?.trim()
    password = password?.trim()

    // Validate required fields
    if (!reg_number || !full_name || !gender || !department_branch || !year || !mobile_number || !email_id || !password) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required fields' 
      })
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email_id)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid email format' 
      })
    }

    // Validate phone number (should be numeric and reasonable length)
    const phoneRegex = /^[0-9]{10}$/
    if (!phoneRegex.test(mobile_number)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid mobile number. Must be 10 digits.' 
      })
    }

    // Validate gender
    const validGenders = ['Male', 'Female']
    if (!validGenders.includes(gender)) {
      return res.status(400).json({ 
        success: false, 
        error: `Invalid gender. Must be one of: ${validGenders.join(', ')}` 
      })
    }

    // Validate department
    const validDepartments = ['CSE', 'CSE (AI)', 'ECE', 'EE', 'CE', 'ME', 'MTE']
    if (!validDepartments.includes(department_branch)) {
      return res.status(400).json({ 
        success: false, 
        error: `Invalid department/branch. Must be one of: ${validDepartments.join(', ')}` 
      })
    }

    // Validate year
    const validYears = ['1st Year (2025)', '2nd Year (2024)', '3rd Year (2023)', '4th Year (2022)']
    if (!validYears.includes(year)) {
      return res.status(400).json({ 
        success: false, 
        error: `Invalid year. Must be one of: ${validYears.join(', ')}` 
      })
    }

    // Check if player with same reg_number already exists
    const existingPlayer = await Player.findOne({ reg_number })
    if (existingPlayer) {
      // Reject duplicate registration
      return res.status(409).json({ 
        success: false, 
        error: 'Registration number already exists. Please use a different registration number.',
        code: 'DUPLICATE_REG_NUMBER'
      })
    }

    // Create new player object (use trimmed values)
    const newPlayer = new Player({
      reg_number,
      full_name,
      gender,
      department_branch,
      year,
      mobile_number,
      email_id,
      password,
      participated_in: [],
      captain_in: [],
    })
    
    // Save to database
    await newPlayer.save()

    res.json({ 
      success: true, 
      message: 'Player data saved successfully',
      player: newPlayer
    })
  } catch (error) {
    logger.error('Error saving player data:', error)
    res.status(500).json({ 
      success: false, 
      error: 'Failed to save player data',
      details: error.message 
    })
  }
})

// API endpoint to save multiple players (for team events)
app.post('/api/save-players', async (req, res) => {
  try {
    let { players } = req.body

    if (!Array.isArray(players) || players.length === 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid players data' 
      })
    }

    // Define valid values
    const validGenders = ['Male', 'Female']
    const validDepartments = ['CSE', 'CSE (AI)', 'ECE', 'EE', 'CE', 'ME', 'MTE']
    const validYears = ['1st Year (2025)', '2nd Year (2024)', '3rd Year (2023)', '4th Year (2022)']
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    const phoneRegex = /^[0-9]{10}$/

    // Validate and trim each player
    for (let i = 0; i < players.length; i++) {
      const player = players[i]
      
      // Trim all fields
      player.reg_number = player.reg_number?.trim()
      player.full_name = player.full_name?.trim()
      player.gender = player.gender?.trim()
      player.department_branch = player.department_branch?.trim()
      player.year = player.year?.trim()
      player.mobile_number = player.mobile_number?.trim()
      player.email_id = player.email_id?.trim()
      player.password = player.password?.trim()

      // Validate required fields
      if (!player.reg_number || !player.full_name || !player.gender || 
          !player.department_branch || !player.year || !player.mobile_number || !player.email_id || !player.password) {
        return res.status(400).json({ 
          success: false, 
          error: 'Missing required fields in one or more players' 
        })
      }

      // Validate email format
      if (!emailRegex.test(player.email_id)) {
        return res.status(400).json({ 
          success: false, 
          error: `Invalid email format for player ${i + 1}: ${player.email_id}` 
        })
      }

      // Validate phone number
      if (!phoneRegex.test(player.mobile_number)) {
        return res.status(400).json({ 
          success: false, 
          error: `Invalid mobile number for player ${i + 1}. Must be 10 digits.` 
        })
      }

      // Validate gender
      if (!validGenders.includes(player.gender)) {
        return res.status(400).json({ 
          success: false, 
          error: `Invalid gender for player ${i + 1}. Must be one of: ${validGenders.join(', ')}` 
        })
      }

      // Validate department
      if (!validDepartments.includes(player.department_branch)) {
        return res.status(400).json({ 
          success: false, 
          error: `Invalid department/branch for player ${i + 1}. Must be one of: ${validDepartments.join(', ')}` 
        })
      }

      // Validate year
      if (!validYears.includes(player.year)) {
        return res.status(400).json({ 
          success: false, 
          error: `Invalid year for player ${i + 1}. Must be one of: ${validYears.join(', ')}` 
        })
      }
    }

    // Check for duplicates within the incoming array
    const regNumbers = new Set()
    for (const player of players) {
      if (regNumbers.has(player.reg_number)) {
        return res.status(409).json({ 
          success: false, 
          error: `Duplicate registration number found in the provided data: ${player.reg_number}`,
          code: 'DUPLICATE_REG_NUMBER'
        })
      }
      regNumbers.add(player.reg_number)
    }

    // Check for duplicates against existing players
    const incomingRegNumbers = players.map(p => p.reg_number)
    const existingPlayers = await Player.find({ reg_number: { $in: incomingRegNumbers } })
    if (existingPlayers.length > 0) {
      const existingRegNumbers = existingPlayers.map(p => p.reg_number)
      return res.status(409).json({ 
        success: false, 
        error: `Registration number(s) already exist: ${existingRegNumbers.join(', ')}`,
        code: 'DUPLICATE_REG_NUMBER'
      })
    }

    // Create player documents
    const playerDocuments = players.map(player => ({
      ...player,
      participated_in: [],
      captain_in: []
    }))

    // Add new players to database
    await Player.insertMany(playerDocuments)

    res.json({ 
      success: true, 
      message: `${players.length} player(s) saved successfully`,
      count: players.length
    })
  } catch (error) {
    logger.error('Error saving players data:', error)
    res.status(500).json({ 
      success: false, 
      error: 'Failed to save players data',
      details: error.message 
    })
  }
})

// API endpoint to remove participation for non-team events
app.delete('/api/remove-participation', authenticateToken, requireAdmin, async (req, res) => {
  try {
    let { reg_number, sport } = req.body

    // Trim fields
    reg_number = reg_number?.trim()
    sport = sport?.trim()

    // Validate required fields
    if (!reg_number || !sport) {
      return res.status(400).json({ 
        success: false, 
        error: 'Registration number and sport are required' 
      })
    }

    // Find player
    const player = await Player.findOne({ reg_number })
    if (!player) {
      return res.status(404).json({ 
        success: false, 
        error: 'Player not found' 
      })
    }

    // Initialize participated_in array if it doesn't exist
    if (!player.participated_in) {
      player.participated_in = []
    }

    // Find the participation entry for this sport (non-team event - no team_name)
    const participationIndex = player.participated_in.findIndex(
      p => p.sport === sport && !p.team_name
    )

    if (participationIndex === -1) {
      return res.status(404).json({ 
        success: false, 
        error: `Player is not registered for ${sport} as a non-team event` 
      })
    }

    // Remove the participation entry
    player.participated_in.splice(participationIndex, 1)
    await player.save()

    // Return player data (excluding password for security)
    const playerData = player.toObject()
    delete playerData.password

    res.json({ 
      success: true, 
      message: `Participation removed successfully for ${sport}`,
      player: playerData
    })
  } catch (error) {
    logger.error('Error removing participation:', error)
    res.status(500).json({ 
      success: false, 
      error: 'Failed to remove participation',
      details: error.message 
    })
  }
})

// API endpoint to get all teams for a specific sport
app.get('/api/teams/:sport', authenticateToken, async (req, res) => {
  try {
    // Decode the sport name from URL parameter
    let sport = decodeURIComponent(req.params.sport)
    logger.api('Received request for teams - sport:', sport)

    if (!sport) {
      return res.status(400).json({ 
        success: false, 
        error: 'Sport name is required' 
      })
    }

    // Query directly for players who have participated in this sport with a team_name
    // Use $elemMatch to ensure we match the same array element that has both sport and team_name
    // Optimized: exclude password field
    const playersInTeams = await Player.find({
      reg_number: { $ne: 'admin' },
      participated_in: {
        $elemMatch: {
          sport: sport,
          team_name: { $exists: true, $ne: null }
        }
      }
    }).select('-password').lean()

    // Group players by team name
    const teamsMap = new Map()

    for (const player of playersInTeams) {
      // Find participation in this sport with a team_name
      const participation = player.participated_in.find(
        p => p.sport === sport && p.team_name
      )

      if (participation && participation.team_name) {
        const teamName = participation.team_name

        // Initialize team if it doesn't exist
        if (!teamsMap.has(teamName)) {
          teamsMap.set(teamName, [])
        }

        // Add player to team (excluding password)
        const { password: _, ...playerData } = player
        teamsMap.get(teamName).push(playerData)
      }
    }

    // Convert map to array of teams
    const teams = Array.from(teamsMap.entries()).map(([teamName, players]) => ({
      team_name: teamName,
      players: players,
      player_count: players.length
    }))

    // Sort teams by team name
    teams.sort((a, b) => a.team_name.localeCompare(b.team_name))

    logger.api(`Found ${teams.length} teams for sport: ${sport}`)

    res.json({ 
      success: true, 
      sport: sport,
      teams: teams,
      total_teams: teams.length
    })
  } catch (error) {
    logger.error('Error getting teams:', error)
    res.status(500).json({ 
      success: false, 
      error: 'Failed to get teams',
      details: error.message 
    })
  }
})

// API endpoint to get all sports counts at once (teams and participants) - no admin required
app.get('/api/sports-counts', authenticateToken, async (req, res) => {
  try {
    logger.api('Received request for all sports counts')

    // Get all team sports counts
    const teamSports = ['Cricket', 'Volleyball', 'Badminton', 'Table Tennis', 'Kabaddi', 'Relay 4×100 m', 'Relay 4×400 m']
    const teamsCounts = {}

    // Get all individual/cultural sports
    const individualSports = [
      'Carrom', 'Chess', 'Sprint 100 m', 'Sprint 200 m', 'Sprint 400 m',
      'Long Jump', 'High Jump', 'Javelin', 'Shot Put', 'Discus Throw',
      'Essay Writing', 'Story Writing', 'Group Discussion', 'Debate',
      'Extempore', 'Quiz', 'Dumb Charades', 'Painting', 'Singing'
    ]
    const participantsCounts = {}

    // Fetch teams counts for all team sports in parallel
    const teamPromises = teamSports.map(async (sport) => {
      try {
        const playersInTeams = await Player.find({
          reg_number: { $ne: 'admin' },
          participated_in: {
            $elemMatch: {
              sport: sport,
              team_name: { $exists: true, $ne: null }
            }
          }
        }).select('-password').lean()

        // Group by team name to count unique teams
        const teamsSet = new Set()
        for (const player of playersInTeams) {
          const participation = player.participated_in.find(
            p => p.sport === sport && p.team_name
          )
          if (participation && participation.team_name) {
            teamsSet.add(participation.team_name)
          }
        }
        return { sport, count: teamsSet.size }
      } catch (error) {
        logger.error(`Error getting teams count for ${sport}:`, error)
        return { sport, count: 0 }
      }
    })

    // Fetch participants counts for all individual/cultural sports in parallel
    const participantPromises = individualSports.map(async (sport) => {
      try {
        const result = await Player.aggregate([
          {
            $match: {
              reg_number: { $ne: 'admin' }
            }
          },
          {
            $unwind: '$participated_in'
          },
          {
            $match: {
              'participated_in.sport': sport,
              $or: [
                { 'participated_in.team_name': { $exists: false } },
                { 'participated_in.team_name': null },
                { 'participated_in.team_name': '' }
              ]
            }
          },
          {
            $count: 'total'
          }
        ])
        const count = result.length > 0 ? result[0].total : 0
        return { sport, count }
      } catch (error) {
        logger.error(`Error getting participants count for ${sport}:`, error)
        return { sport, count: 0 }
      }
    })

    // Wait for all promises to resolve
    const teamResults = await Promise.all(teamPromises)
    const participantResults = await Promise.all(participantPromises)

    // Build the counts objects
    teamResults.forEach(({ sport, count }) => {
      teamsCounts[sport] = count
    })

    participantResults.forEach(({ sport, count }) => {
      participantsCounts[sport] = count
    })

    logger.api('All sports counts fetched successfully')

    res.json({
      success: true,
      teams_counts: teamsCounts,
      participants_counts: participantsCounts
    })
  } catch (error) {
    logger.error('Error getting all sports counts:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to get sports counts',
      details: error.message
    })
  }
})

// API endpoint to get total participants count for a specific sport (non-team events) - no admin required
app.get('/api/participants-count/:sport', authenticateToken, async (req, res) => {
  try {
    // Decode the sport name from URL parameter
    let sport = decodeURIComponent(req.params.sport)
    logger.api('Received request for participants count - sport:', sport)

    if (!sport) {
      return res.status(400).json({ 
        success: false, 
        error: 'Sport name is required' 
      })
    }

    // Count players who have participated in this sport without team_name
    // For non-team events, team_name is either missing, null, or empty string
    // Use aggregation pipeline for more reliable counting
    const result = await Player.aggregate([
      {
        $match: {
          reg_number: { $ne: 'admin' }
        }
      },
      {
        $unwind: '$participated_in'
      },
      {
        $match: {
          'participated_in.sport': sport,
          $or: [
            { 'participated_in.team_name': { $exists: false } },
            { 'participated_in.team_name': null },
            { 'participated_in.team_name': '' }
          ]
        }
      },
      {
        $count: 'total'
      }
    ])
    
    const count = result.length > 0 ? result[0].total : 0
    
    logger.api(`Participants count for ${sport}: ${count}`)

    res.json({ 
      success: true, 
      sport: sport,
      total_participants: count
    })
  } catch (error) {
    logger.error('Error getting participants count:', error)
    res.status(500).json({ 
      success: false, 
      error: 'Failed to get participants count',
      details: error.message 
    })
  }
})

// API endpoint to get all participants for a specific sport (non-team events)
app.get('/api/participants/:sport', authenticateToken, requireAdmin, async (req, res) => {
  try {
    // Decode the sport name from URL parameter
    let sport = decodeURIComponent(req.params.sport)
    logger.api('Received request for participants - sport:', sport)

    if (!sport) {
      return res.status(400).json({ 
        success: false, 
        error: 'Sport name is required' 
      })
    }

    // Query directly for players who have participated in this sport without team_name
    // Use $elemMatch to match array elements where sport matches and team_name is null/doesn't exist/empty
    // Optimized: exclude password field
    const players = await Player.find({
      reg_number: { $ne: 'admin' },
      participated_in: {
        $elemMatch: {
          sport: sport,
          $or: [
            { team_name: { $exists: false } },
            { team_name: null },
            { team_name: '' }
          ]
        }
      }
    }).select('-password').lean()

    // Map to participants (excluding password)
    const participants = players.map(player => {
      const { password: _, ...playerData } = player
      return playerData
    })

    // Sort participants by name
    participants.sort((a, b) => a.full_name.localeCompare(b.full_name))

    res.json({ 
      success: true, 
      sport: sport,
      participants: participants,
      total_participants: participants.length
    })
  } catch (error) {
    logger.error('Error getting participants:', error)
    res.status(500).json({ 
      success: false, 
      error: 'Failed to get participants',
      details: error.message 
    })
  }
})

// API endpoint to update/replace a player in a team
app.post('/api/update-team-player', authenticateToken, requireAdmin, async (req, res) => {
  try {
    let { team_name, sport, old_reg_number, new_reg_number } = req.body

    // Trim fields
    sport = sport?.trim()
    team_name = team_name?.trim()
    old_reg_number = old_reg_number?.trim()
    new_reg_number = new_reg_number?.trim()

    // Validate required fields
    if (!team_name || !sport || !old_reg_number || !new_reg_number) {
      return res.status(400).json({ 
        success: false, 
        error: 'Team name, sport, old registration number, and new registration number are required' 
      })
    }

    // Find old player
    const oldPlayer = await Player.findOne({ reg_number: old_reg_number })
    if (!oldPlayer) {
      return res.status(404).json({ 
        success: false, 
        error: 'Old player not found' 
      })
    }

    // Find new player
    const newPlayer = await Player.findOne({ reg_number: new_reg_number })
    if (!newPlayer) {
      return res.status(404).json({ 
        success: false, 
        error: 'New player not found' 
      })
    }

    // Check if old player is in the team
    if (!oldPlayer.participated_in || !Array.isArray(oldPlayer.participated_in)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Old player is not registered for any sport' 
      })
    }

    const oldPlayerParticipation = oldPlayer.participated_in.find(
      p => p.sport === sport && p.team_name === team_name
    )

    if (!oldPlayerParticipation) {
      return res.status(400).json({ 
        success: false, 
        error: 'Old player is not in this team' 
      })
    }

    // Get all current team members (excluding the old player)
    // Use $elemMatch to ensure we match the same array element
    // Optimized: exclude password field
    const currentTeamMembers = await Player.find({
      participated_in: {
        $elemMatch: {
          sport: sport,
          team_name: team_name
        }
      },
      reg_number: { $ne: old_reg_number }
    }).select('-password').lean()

    // Validate new player

    // Check if new player is already in this team
    if (currentTeamMembers.some(m => m.reg_number === new_reg_number)) {
      return res.status(400).json({ 
        success: false, 
        error: 'New player is already in this team' 
      })
    }

    // Check if new player has already participated in this sport
    if (newPlayer.participated_in && Array.isArray(newPlayer.participated_in)) {
      const existingParticipation = newPlayer.participated_in.find(
        p => p.sport === sport
      )
      if (existingParticipation) {
        if (existingParticipation.team_name) {
          return res.status(400).json({ 
            success: false, 
            error: `New player is already in a team (${existingParticipation.team_name}) for ${sport}. A player can only belong to one team per sport.` 
          })
        } else {
          return res.status(400).json({ 
            success: false, 
            error: `New player is already registered for ${sport}` 
          })
        }
      }
    }

    // Check for duplicate sport entries in participated_in array (uniqueness check)
    if (newPlayer.participated_in && Array.isArray(newPlayer.participated_in)) {
      const sportSet = new Set(newPlayer.participated_in.map(p => p.sport))
      if (sportSet.size !== newPlayer.participated_in.length) {
        return res.status(400).json({ 
          success: false, 
          error: 'New player has duplicate sport entries in participated_in array. Please fix the data first.' 
        })
      }

      // Check maximum limit: participated_in array can have maximum 10 unique entries (based on sport name)
      if (newPlayer.participated_in.length >= 10) {
        return res.status(400).json({ 
          success: false, 
          error: 'New player has reached maximum 10 participations (based on unique sport names). Please remove a participation first.' 
        })
      }
    }

    // Count non-team participations (entries without team_name)
    const nonTeamParticipations = newPlayer.participated_in && Array.isArray(newPlayer.participated_in)
      ? newPlayer.participated_in.filter(p => !p.team_name).length
      : 0

    // Check if new player is a captain for this sport
    const isNewPlayerCaptainForSport = newPlayer.captain_in && 
      Array.isArray(newPlayer.captain_in) && 
      newPlayer.captain_in.includes(sport)

    // Count team participations where sport IS in captain_in array (these count towards captain limit)
    const captainTeamParticipations = newPlayer.participated_in && Array.isArray(newPlayer.participated_in)
      ? newPlayer.participated_in.filter(
          p => p.team_name && 
          newPlayer.captain_in && 
          Array.isArray(newPlayer.captain_in) && 
          newPlayer.captain_in.includes(p.sport)
        ).length
      : 0

    // Get captain count
    const captainCount = newPlayer.captain_in && Array.isArray(newPlayer.captain_in) 
      ? newPlayer.captain_in.length 
      : 0

    // Only check limit if new player IS a captain for this sport
    // If new player is a captain for this sport, check: team participations (for captain sports) should not exceed captain_in length
    if (isNewPlayerCaptainForSport) {
      if (captainTeamParticipations >= captainCount) {
        return res.status(400).json({ 
          success: false, 
          error: `New player has reached maximum team participations for captain sports (${captainCount}). Maximum team participations allowed for sports in captain_in array is equal to captain roles (${captainCount}).` 
        })
      }
    }
    // If new player is NOT a captain for this sport, they can still join the team (no limit check)

    // Check maximum limit: (captain_in length + non-team participated_in) should not exceed 10
    if (captainCount + nonTeamParticipations >= 10) {
      return res.status(400).json({ 
        success: false, 
        error: `New player has reached maximum limit. Total (captain roles + non-team participations) cannot exceed 10. Current: ${captainCount} captain role(s) + ${nonTeamParticipations} non-team participation(s).` 
      })
    }

    // Validate gender match with team
    if (currentTeamMembers.length > 0) {
      const teamGender = currentTeamMembers[0].gender
      if (newPlayer.gender !== teamGender) {
        return res.status(400).json({ 
          success: false, 
          error: `Gender mismatch: New player must have the same gender (${teamGender}) as other team members.` 
        })
      }

      // Validate year match with team
      const teamYear = currentTeamMembers[0].year
      if (newPlayer.year !== teamYear) {
        return res.status(400).json({ 
          success: false, 
          error: `Year mismatch: New player must be in the same year (${teamYear}) as other team members.` 
        })
      }
    }

    // Check for multiple captains in the team
    const isNewPlayerCaptain = newPlayer.captain_in && 
      Array.isArray(newPlayer.captain_in) && 
      newPlayer.captain_in.includes(sport)

    const existingCaptains = currentTeamMembers.filter(s => 
      s.captain_in && 
      Array.isArray(s.captain_in) && 
      s.captain_in.includes(sport)
    )

    if (existingCaptains.length > 0 && isNewPlayerCaptain) {
      const existingCaptainName = existingCaptains[0].full_name
      return res.status(400).json({ 
        success: false, 
        error: `Team already has a captain (${existingCaptainName}) for ${sport}. Cannot add another captain. A team can only have one captain.` 
      })
    }

    // Remove old player from team
    const oldPlayerPartIndex = oldPlayer.participated_in.findIndex(
      p => p.sport === sport && p.team_name === team_name
    )
    if (oldPlayerPartIndex !== -1) {
      oldPlayer.participated_in.splice(oldPlayerPartIndex, 1)
    }

    // Add new player to team
    if (!newPlayer.participated_in) {
      newPlayer.participated_in = []
    }
    newPlayer.participated_in.push({ sport, team_name })
    await newPlayer.save()

    // Return updated data
    const newPlayerData = newPlayer.toObject()
    delete newPlayerData.password

    res.json({ 
      success: true, 
      message: `Player updated successfully in team ${team_name}`,
      old_player: { reg_number: old_reg_number, full_name: oldPlayer.full_name },
      new_player: newPlayerData
    })
  } catch (error) {
    logger.error('Error updating team player:', error)
    res.status(500).json({ 
      success: false, 
      error: 'Failed to update team player',
      details: error.message 
    })
  }
})

// API endpoint to delete a team (remove all players' associations to the team)
app.delete('/api/delete-team', authenticateToken, requireAdmin, async (req, res) => {
  try {
    let { team_name, sport } = req.body

    // Trim fields
    sport = sport?.trim()
    team_name = team_name?.trim()

    // Validate required fields
    if (!team_name || !sport) {
      return res.status(400).json({ 
        success: false, 
        error: 'Team name and sport are required' 
      })
    }

    // Find all players who are in this team
    // Use $elemMatch to ensure we match the same array element
    // Optimized: exclude password field
    const playersInTeam = await Player.find({
      participated_in: {
        $elemMatch: {
          sport: sport,
          team_name: team_name
        }
      }
    }).select('-password')

    if (playersInTeam.length === 0) {
      return res.status(404).json({ 
        success: false, 
        error: 'Team not found or has no members' 
      })
    }

    const teamMembers = []
    let deletedCount = 0

    // Remove participation from each player
    for (const player of playersInTeam) {
      if (!player.participated_in || !Array.isArray(player.participated_in)) {
        continue
      }

      // Find participation in this team
      const participationIndex = player.participated_in.findIndex(
        p => p.sport === sport && p.team_name === team_name
      )

      if (participationIndex !== -1) {
        // Remove this participation
        player.participated_in.splice(participationIndex, 1)
        await player.save()
        teamMembers.push({
          reg_number: player.reg_number,
          full_name: player.full_name
        })
        deletedCount++
      }
    }

    res.json({ 
      success: true, 
      message: `Team "${team_name}" deleted successfully. Removed ${deletedCount} player(s) from the team.`,
      deleted_count: deletedCount,
      team_members: teamMembers
    })
  } catch (error) {
    logger.error('Error deleting team:', error)
    res.status(500).json({ 
      success: false, 
      error: 'Failed to delete team',
      details: error.message 
    })
  }
})

// API endpoint to update player data
app.put('/api/update-player', authenticateToken, requireAdmin, async (req, res) => {
  try {
    let { reg_number, full_name, gender, department_branch, year, mobile_number, email_id } = req.body

    // Trim all string fields
    reg_number = reg_number?.trim()
    full_name = full_name?.trim()
    gender = gender?.trim()
    department_branch = department_branch?.trim()
    year = year?.trim()
    mobile_number = mobile_number?.trim()
    email_id = email_id?.trim()

    // Validate required fields (password is not required for update)
    if (!reg_number || !full_name || !gender || !department_branch || !year || !mobile_number || !email_id) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required fields' 
      })
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email_id)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid email format' 
      })
    }

    // Validate phone number (should be numeric and reasonable length)
    const phoneRegex = /^[0-9]{10}$/
    if (!phoneRegex.test(mobile_number)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid mobile number. Must be 10 digits.' 
      })
    }

    // Validate gender
    const validGenders = ['Male', 'Female']
    if (!validGenders.includes(gender)) {
      return res.status(400).json({ 
        success: false, 
        error: `Invalid gender. Must be one of: ${validGenders.join(', ')}` 
      })
    }

    // Validate department
    const validDepartments = ['CSE', 'CSE (AI)', 'ECE', 'EE', 'CE', 'ME', 'MTE']
    if (!validDepartments.includes(department_branch)) {
      return res.status(400).json({ 
        success: false, 
        error: `Invalid department/branch. Must be one of: ${validDepartments.join(', ')}` 
      })
    }

    // Validate year
    const validYears = ['1st Year (2025)', '2nd Year (2024)', '3rd Year (2023)', '4th Year (2022)']
    if (!validYears.includes(year)) {
      return res.status(400).json({ 
        success: false, 
        error: `Invalid year. Must be one of: ${validYears.join(', ')}` 
      })
    }

    // Find player with matching reg_number
    const player = await Player.findOne({ reg_number })
    if (!player) {
      return res.status(404).json({ 
        success: false, 
        error: 'Player not found' 
      })
    }

    // Check if gender or year is being changed (not allowed)
    if (player.gender !== gender) {
      return res.status(400).json({ 
        success: false, 
        error: 'Gender cannot be modified. Please keep the original gender value.' 
      })
    }

    if (player.year !== year) {
      return res.status(400).json({ 
        success: false, 
        error: 'Year cannot be modified. Please keep the original year value.' 
      })
    }

    // Update only allowed player fields (gender and year are read-only)
    player.full_name = full_name
    // gender and year are preserved from original player (cannot be changed)
    player.department_branch = department_branch
    // year is preserved from original player (cannot be changed)
    player.mobile_number = mobile_number
    player.email_id = email_id
    // password, participated_in, captain_in, gender, and year are preserved automatically

    await player.save()

    // Return updated player (excluding password)
    const playerData = player.toObject()
    delete playerData.password

    res.json({ 
      success: true, 
      message: 'Player data updated successfully',
      player: playerData
    })
  } catch (error) {
    logger.error('Error updating player data:', error)
    res.status(500).json({ 
      success: false, 
      error: 'Failed to update player data',
      details: error.message 
    })
  }
})

// API endpoint to export players data to Excel
app.get('/api/export-excel', authenticateToken, requireAdmin, async (req, res) => {
  try {
    // Read existing data and filter out admin user
    // Optimized: exclude password field
    const nonAdminPlayers = await Player.find({ reg_number: { $ne: 'admin' } }).select('-password').lean()

    // Define all sports in order with exact column headers as specified
    const sportColumns = [
      { header: 'CRICKET', sport: 'Cricket' },
      { header: 'VOLLEYBALL', sport: 'Volleyball' },
      { header: 'BADMINTON', sport: 'Badminton' },
      { header: 'TABLE TENNIS', sport: 'Table Tennis' },
      { header: 'KABADDI', sport: 'Kabaddi' },
      { header: 'RELAY 4×100 M', sport: 'Relay 4×100 m' },
      { header: 'RELAY 4×400 M', sport: 'Relay 4×400 m' },
      { header: 'CARROM', sport: 'Carrom' },
      { header: 'CHESS', sport: 'Chess' },
      { header: 'SPRINT 100 M', sport: 'Sprint 100 m' },
      { header: 'SPRINT 200 M', sport: 'Sprint 200 m' },
      { header: 'SPRINT 400 M', sport: 'Sprint 400 m' },
      { header: 'LONG JUMP', sport: 'Long Jump' },
      { header: 'HIGH JUMP', sport: 'High Jump' },
      { header: 'JAVELIN', sport: 'Javelin' },
      { header: 'SHOT PUT', sport: 'Shot Put' },
      { header: 'DISCUS THROW', sport: 'Discus Throw' },
      { header: 'ESSAY WRITING', sport: 'Essay Writing' },
      { header: 'STORY WRITING', sport: 'Story Writing' },
      { header: 'GROUP DISCUSSION', sport: 'Group Discussion' },
      { header: 'DEBATE', sport: 'Debate' },
      { header: 'EXTEMPORE', sport: 'Extempore' },
      { header: 'QUIZ', sport: 'Quiz' },
      { header: 'DUMB CHARADES', sport: 'Dumb Charades' },
      { header: 'PAINTING', sport: 'Painting' },
      { header: 'SINGING', sport: 'Singing' }
    ]

    // Team sports (can have CAPTAIN or PARTICIPANT)
    const teamSports = [
      'Cricket',
      'Volleyball',
      'Badminton',
      'Table Tennis',
      'Kabaddi',
      'Relay 4×100 m',
      'Relay 4×400 m'
    ]

    // Prepare data for Excel
    const excelData = nonAdminPlayers.map(player => {
      const row = {
        'REG Number': player.reg_number || '',
        'Full Name': player.full_name || '',
        'Gender': player.gender || '',
        'Department/Branch': player.department_branch || '',
        'Year': player.year || '',
        'Mobile Number': player.mobile_number || '',
        'Email Id': player.email_id || ''
      }

      // Add sport columns with exact headers as specified
      sportColumns.forEach(({ header, sport }) => {
        const isTeamSport = teamSports.includes(sport)
        const isCaptain = player.captain_in && 
                         Array.isArray(player.captain_in) && 
                         player.captain_in.includes(sport)
        const isParticipant = player.participated_in && 
                             Array.isArray(player.participated_in) && 
                             player.participated_in.some(p => p.sport === sport)

        if (isTeamSport) {
          // Team sports: CAPTAIN, PARTICIPANT, or NA
          if (isCaptain) {
            row[header] = 'CAPTAIN'
          } else if (isParticipant) {
            row[header] = 'PARTICIPANT'
          } else {
            row[header] = 'NA'
          }
          
          // Add team name column for team sports (right after the sport column)
          const teamHeader = `${header}_TEAM`
          const teamParticipation = player.participated_in && 
                                   Array.isArray(player.participated_in) && 
                                   player.participated_in.find(p => p.sport === sport && p.team_name)
          row[teamHeader] = teamParticipation && teamParticipation.team_name ? teamParticipation.team_name : 'NA'
        } else {
          // Individual/Cultural sports: PARTICIPANT or NA
          if (isParticipant) {
            row[header] = 'PARTICIPANT'
          } else {
            row[header] = 'NA'
          }
        }
      })

      return row
    })

    // Create workbook and worksheet
    const worksheet = XLSX.utils.json_to_sheet(excelData)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Players Report')

    // Generate Excel buffer
    const excelBuffer = XLSX.write(workbook, { 
      type: 'buffer', 
      bookType: 'xlsx' 
    })

    // Set response headers
    const filename = `Players_Report_${new Date().toISOString().split('T')[0]}.xlsx`
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)

    // Send Excel file
    res.send(excelBuffer)
  } catch (error) {
    logger.error('Error exporting Excel:', error)
    res.status(500).json({ 
      success: false, 
      error: 'Failed to export Excel file',
      details: error.message 
    })
  }
})

// ==================== Event Schedule API Endpoints ====================

// Get all matches for a sport
app.get('/api/event-schedule/:sport', authenticateToken, async (req, res) => {
  try {
    const { sport } = req.params
    const matches = await EventSchedule.find({ sport })
      .sort({ match_number: 1 })
      .lean()
    
    logger.api(`Fetched ${matches.length} matches for sport: ${sport}`)
    res.json({ success: true, matches })
  } catch (error) {
    logger.error('Error fetching event schedule:', error)
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch event schedule',
      details: error.message 
    })
  }
})

// Create a new match
app.post('/api/event-schedule', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { match_type, sport, sport_type, team_one, team_two, player_one, player_two, match_date } = req.body
    
    // Validate required fields
    if (!match_type || !sport || !sport_type || !match_date) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: match_type, sport, sport_type, match_date'
      })
    }
    
    // Declare player objects outside the if/else block for later use
    let playerOneObj = null
    let playerTwoObj = null
    
    // Validate team/player fields based on sport_type
    if (sport_type === 'team') {
      if (!team_one || !team_two) {
        return res.status(400).json({
          success: false,
          error: 'team_one and team_two are required for team events'
        })
      }
      // Validate that both teams are different
      if (team_one === team_two) {
        return res.status(400).json({
          success: false,
          error: 'team_one and team_two must be different'
        })
      }
    } else {
      if (!player_one || !player_two) {
        return res.status(400).json({
          success: false,
          error: 'player_one and player_two are required for individual/cultural events'
        })
      }
      // Validate that both players are different
      if (player_one === player_two) {
        return res.status(400).json({
          success: false,
          error: 'player_one and player_two must be different'
        })
      }
      
      // Validate that both players have the same gender and fetch their names
      const player1 = await Player.findOne({ reg_number: player_one }).select('gender full_name').lean()
      const player2 = await Player.findOne({ reg_number: player_two }).select('gender full_name').lean()
      
      if (!player1) {
        return res.status(400).json({
          success: false,
          error: `Player with registration number ${player_one} not found`
        })
      }
      if (!player2) {
        return res.status(400).json({
          success: false,
          error: `Player with registration number ${player_two} not found`
        })
      }
      
      if (player1.gender !== player2.gender) {
        return res.status(400).json({
          success: false,
          error: `Gender mismatch: Both players must have the same gender. Player one is ${player1.gender}, player two is ${player2.gender}.`
        })
      }
      
      // Prepare player objects with name and reg_number
      playerOneObj = {
        name: player1.full_name || '',
        reg_number: player_one
      }
      playerTwoObj = {
        name: player2.full_name || '',
        reg_number: player_two
      }
    }
    
    // Validate match date - must be today or after today
    const matchDateObj = new Date(match_date)
    const today = new Date()
    today.setHours(0, 0, 0, 0) // Reset time to start of day for comparison
    matchDateObj.setHours(0, 0, 0, 0)
    
    if (matchDateObj < today) {
      return res.status(400).json({
        success: false,
        error: 'Match date must be today or a future date'
      })
    }
    
    // Get next match number for this sport
    const lastMatch = await EventSchedule.findOne({ sport })
      .sort({ match_number: -1 })
      .lean()
    
    const match_number = lastMatch ? lastMatch.match_number + 1 : 1
    
    // Validate eligibility based on previous matches (per sport)
    // For knockout matches: check if participant lost any previous completed match IN THIS SPORT
    // - If a previous match is "completed" and participant is NOT the winner, they are disqualified
    // - If previous match is "draw", "cancelled", or "scheduled", participant is still eligible
    // - If previous match is "completed" and participant IS the winner, they are eligible
    // - Lost matches in other sports do NOT affect eligibility
    // For league matches: no eligibility check needed - losers can be added
    
    if (match_type === 'knockout') {
      // Check previous matches for team_one/player_one (only for this sport)
      const participantOne = sport_type === 'team' ? team_one : player_one
      const previousMatchesOne = await EventSchedule.find({
        sport, // Only check matches for the same sport
        match_type: 'knockout',
        $or: [
          { team_one: participantOne },
          { team_two: participantOne },
          { 'player_one.reg_number': participantOne },
          { 'player_two.reg_number': participantOne }
        ]
      }).lean()
      
      // Check if participant lost any completed match in this sport
      for (const match of previousMatchesOne) {
        const matchWinner = match.winner?.reg_number || match.winner
        if (match.status === 'completed' && matchWinner && matchWinner !== participantOne) {
          return res.status(400).json({
            success: false,
            error: `${participantOne} cannot be added to ${sport}. They lost a previous knockout match in ${sport} (Match #${match.match_number}).`
          })
        }
      }
      
      // Check previous matches for team_two/player_two (only for this sport)
      const participantTwo = sport_type === 'team' ? team_two : player_two
      const previousMatchesTwo = await EventSchedule.find({
        sport, // Only check matches for the same sport
        match_type: 'knockout',
        $or: [
          { team_one: participantTwo },
          { team_two: participantTwo },
          { 'player_one.reg_number': participantTwo },
          { 'player_two.reg_number': participantTwo }
        ]
      }).lean()
      
      // Check if participant lost any completed match in this sport
      for (const match of previousMatchesTwo) {
        const matchWinner = match.winner?.reg_number || match.winner
        if (match.status === 'completed' && matchWinner && matchWinner !== participantTwo) {
          return res.status(400).json({
            success: false,
            error: `${participantTwo} cannot be added to ${sport}. They lost a previous knockout match in ${sport} (Match #${match.match_number}).`
          })
        }
      }
    }
    // For league matches, no eligibility check needed - losers can be added
    
    // Create new match
    const matchData = {
      match_number,
      match_type,
      sport,
      sport_type,
      match_date: new Date(match_date),
      status: 'scheduled',
    }
    
    // Add team or player data based on sport type
    if (sport_type === 'team') {
      matchData.team_one = team_one
      matchData.team_two = team_two
      matchData.player_one = null
      matchData.player_two = null
    } else {
      matchData.player_one = playerOneObj
      matchData.player_two = playerTwoObj
      matchData.team_one = null
      matchData.team_two = null
    }
    
    const newMatch = new EventSchedule(matchData)
    
    await newMatch.save()
    
    logger.api(`Created new match #${match_number} for ${sport}`)
    res.json({ 
      success: true, 
      match: newMatch,
      message: `Match #${match_number} scheduled successfully` 
    })
  } catch (error) {
    logger.error('Error creating event schedule:', error)
    logger.error('Error stack:', error.stack)
    logger.error('Error details:', JSON.stringify(error, null, 2))
    
    // Handle duplicate key error (match_number + sport)
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        error: 'Match number already exists for this sport'
      })
    }
    
    // Handle validation errors
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        details: error.message,
        errors: error.errors
      })
    }
    
    res.status(500).json({ 
      success: false, 
      error: 'Failed to create event schedule',
      details: error.message,
      errorName: error.name
    })
  }
})

// Delete a match
app.delete('/api/event-schedule/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params
    
    // First, find the match to check its status
    const match = await EventSchedule.findById(id)
    
    if (!match) {
      return res.status(404).json({
        success: false,
        error: 'Match not found'
      })
    }
    
    // Only allow deletion of scheduled matches
    if (match.status !== 'scheduled') {
      return res.status(400).json({
        success: false,
        error: `Cannot delete match with status "${match.status}". Only scheduled matches can be deleted.`
      })
    }
    
    // Delete the match
    await EventSchedule.findByIdAndDelete(id)
    
    logger.api(`Deleted match #${match.match_number} for ${match.sport}`)
    res.json({ 
      success: true, 
      message: 'Match deleted successfully' 
    })
  } catch (error) {
    logger.error('Error deleting event schedule:', error)
    res.status(500).json({ 
      success: false, 
      error: 'Failed to delete event schedule',
      details: error.message 
    })
  }
})

// Update match winner and status
app.put('/api/event-schedule/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params
    const { winner, status } = req.body
    
    // First, find the match to validate
    const match = await EventSchedule.findById(id)
    
    if (!match) {
      return res.status(404).json({
        success: false,
        error: 'Match not found'
      })
    }
    
    // Check if match date is in the future
    const matchDateObj = new Date(match.match_date)
    const now = new Date()
    matchDateObj.setHours(0, 0, 0, 0)
    now.setHours(0, 0, 0, 0)
    const isFutureMatch = matchDateObj > now
    
    const updateData = {}
    
    // Validate and set status
    if (status !== undefined) {
      // Prevent status updates for future matches
      if (isFutureMatch) {
        return res.status(400).json({
          success: false,
          error: 'Cannot update status for future matches. Please wait until the match date.'
        })
      }
      if (!['completed', 'draw', 'cancelled', 'scheduled'].includes(status)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid status. Must be one of: completed, draw, cancelled, scheduled'
        })
      }
      updateData.status = status
      
      // If status is being changed from completed and winner exists, clear winner
      if (match.status === 'completed' && status !== 'completed' && match.winner) {
        updateData.winner = null
      }
    }
    
    // Validate and set winner
    if (winner !== undefined) {
      // Prevent winner selection for future matches
      if (isFutureMatch) {
        return res.status(400).json({
          success: false,
          error: 'Cannot declare winner for future matches. Please wait until the match date.'
        })
      }
      
      // Winner can only be set if status is completed
      const targetStatus = status || match.status
      if (targetStatus !== 'completed') {
        return res.status(400).json({
          success: false,
          error: 'Winner can only be set when match status is "completed"'
        })
      }
      
      // Validate winner matches one of the teams/players
      let isValidWinner = false
      if (match.sport_type === 'team') {
        isValidWinner = winner === match.team_one || winner === match.team_two
      } else {
        // For non-team events, winner should match player_one or player_two format
        const playerOneName = match.player_one && match.player_one.name
          ? `${match.player_one.name} (${match.player_one.reg_number})`
          : null
        const playerTwoName = match.player_two && match.player_two.name
          ? `${match.player_two.name} (${match.player_two.reg_number})`
          : null
        isValidWinner = winner === playerOneName || winner === playerTwoName
      }
      
      if (!isValidWinner) {
        return res.status(400).json({
          success: false,
          error: 'Winner must be one of the participating teams/players'
        })
      }
      
      updateData.winner = winner
      // Ensure status is completed when winner is set
      if (!updateData.status) {
        updateData.status = 'completed'
      }
    }
    
    // If winner is being cleared (set to null or empty), allow it
    if (winner === null || winner === '') {
      updateData.winner = null
    }
    
    const updatedMatch = await EventSchedule.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true, runValidators: true }
    )
    
    if (!updatedMatch) {
      return res.status(404).json({
        success: false,
        error: 'Match not found'
      })
    }
    
    logger.api(`Updated match #${updatedMatch.match_number} for ${updatedMatch.sport}`)
    res.json({ 
      success: true, 
      match: updatedMatch,
      message: 'Match updated successfully' 
    })
  } catch (error) {
    logger.error('Error updating event schedule:', error)
    res.status(500).json({ 
      success: false, 
      error: 'Failed to update event schedule',
      details: error.message 
    })
  }
})

// Get teams/players list for a sport (for dropdown in form)
app.get('/api/event-schedule/:sport/teams-players', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { sport } = req.params
    // Decode the sport name in case it's URL encoded
    const decodedSport = decodeURIComponent(sport)
    
    logger.api(`Fetching teams/players for sport: ${decodedSport}`)
    
    // Get sport type from existing matches or determine from sport name
    const existingMatch = await EventSchedule.findOne({ sport: decodedSport }).lean()
    const sportType = existingMatch ? existingMatch.sport_type : 
      (['Cricket', 'Volleyball', 'Badminton', 'Table Tennis', 'Kabaddi', 'Relay 4×100 m', 'Relay 4×400 m'].includes(decodedSport) ? 'team' : 'individual')
    
    logger.api(`Sport type determined as: ${sportType}`)
    
    if (sportType === 'team') {
      // Get all unique team names for this sport
      const players = await Player.find({
        reg_number: { $ne: 'admin' },
        'participated_in.sport': decodedSport,
        'participated_in.team_name': { $exists: true, $ne: null, $ne: '' }
      }).select('participated_in').lean()
      
      logger.api(`Found ${players.length} players with teams for ${decodedSport}`)
      
      const teamsSet = new Set()
      players.forEach(player => {
        if (player.participated_in && Array.isArray(player.participated_in)) {
          const participation = player.participated_in.find(p => p.sport === decodedSport && p.team_name)
          if (participation && participation.team_name) {
            teamsSet.add(participation.team_name)
          }
        }
      })
      
      const teamsArray = Array.from(teamsSet).sort()
      logger.api(`Found ${teamsArray.length} unique teams:`, teamsArray)
      res.json({ success: true, teams: teamsArray, players: [] })
    } else {
      // Get all players who participated in this sport (individual/cultural)
      // Use $elemMatch to find players where participated_in has this sport with no team_name
      const players = await Player.find({
        reg_number: { $ne: 'admin' },
        participated_in: {
          $elemMatch: {
            sport: decodedSport,
            $or: [
              { team_name: { $exists: false } },
              { team_name: null },
              { team_name: '' }
            ]
          }
        }
      }).select('reg_number full_name gender').lean()
      
      logger.api(`Found ${players.length} individual participants for ${decodedSport}`)
      
      const playersList = players.map(p => ({
        reg_number: p.reg_number,
        full_name: p.full_name,
        gender: p.gender
      }))
      
      logger.api(`Players list:`, playersList.map(p => `${p.full_name} (${p.reg_number})`))
      res.json({ success: true, teams: [], players: playersList })
    }
  } catch (error) {
    logger.error('Error fetching teams/players:', error)
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch teams/players',
      details: error.message 
    })
  }
})

app.listen(PORT, () => {
  logger.server(`Server running on http://localhost:${PORT}`)
  logger.server(`MongoDB connected. Player data stored in MongoDB.`)
})

