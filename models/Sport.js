import mongoose from 'mongoose'

const teamParticipatedSchema = new mongoose.Schema({
  team_name: {
    type: String,
    required: true,
    trim: true
  },
  captain: {
    type: String,
    required: true,
    trim: true
  },
  players: {
    type: [String],
    required: true,
    validate: {
      validator: function(players) {
        return players.length > 0 && players.every(p => typeof p === 'string' && p.trim().length > 0)
      },
      message: 'Players array must contain at least one player reg_number'
    }
  }
}, { _id: false })

const sportSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    lowercase: true
  },
  event_year: {
    type: Number,
    required: true
  },
  type: {
    type: String,
    required: true,
    enum: ['dual_team', 'multi_team', 'dual_player', 'multi_player']
  },
  category: {
    type: String,
    required: true,
    enum: ['team events', 'individual events', 'literary and cultural activities']
  },
  imageUri: {
    type: String,
    trim: true,
    default: null
    // Optional: URI/path to sport image (e.g., '/images/Cricket.jpg')
  },
  team_size: {
    type: Number,
    default: null,
    validate: {
      validator: function(value) {
        // team_size is only applicable for dual_team and multi_team types
        if (this.type === 'dual_team' || this.type === 'multi_team') {
          return value === null || (value > 0 && Number.isInteger(value))
        }
        // For other types, team_size must be null
        return value === null
      },
      message: 'team_size is only applicable for dual_team and multi_team types'
    }
  },
  eligible_captains: {
    type: [String],
    default: []
  },
  teams_participated: {
    type: [teamParticipatedSchema],
    default: []
  },
  players_participated: {
    type: [String],
    default: []
  }
}, {
  timestamps: true
})

// Create indexes for faster lookups
sportSchema.index({ name: 1, event_year: 1 }, { unique: true }) // Compound unique - unique sport name per year
sportSchema.index({ event_year: 1, type: 1 }) // For efficient year + type queries
sportSchema.index({ event_year: 1, category: 1 }) // For efficient year + category queries
sportSchema.index({ event_year: 1 }) // For efficient year queries

// Pre-save hook to lowercase name
sportSchema.pre('save', function(next) {
  if (this.isModified('name')) {
    this.name = this.name.toLowerCase().trim()
  }
  next()
})

const Sport = mongoose.model('Sport', sportSchema)

export default Sport

