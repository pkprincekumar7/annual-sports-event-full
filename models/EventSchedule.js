import mongoose from 'mongoose'

const qualifierSchema = new mongoose.Schema({
  participant: {
    type: String,
    required: true,
    trim: true
  },
  position: {
    type: Number,
    required: true,
    min: 1
  }
}, { _id: false })

const eventScheduleSchema = new mongoose.Schema({
  event_year: {
    type: Number,
    required: true
  },
  match_number: {
    type: Number,
    required: true
  },
  match_type: {
    type: String,
    enum: ['league', 'knockout', 'final'],
    required: true
  },
  sports_name: {
    type: String,
    required: true,
    trim: true,
    lowercase: true
  },
  teams: {
    type: [String],
    default: []
    // Array of team names (for dual_team and multi_team)
  },
  players: {
    type: [String],
    default: []
    // Array of player reg_numbers (for dual_player and multi_player)
  },
  match_date: {
    type: Date,
    required: true
  },
  winner: {
    type: String,
    default: null
    // For dual_team/dual_player: single winner (team_name or player reg_number)
  },
  qualifiers: {
    type: [qualifierSchema],
    default: []
    // For multi_team/multi_player: multiple qualifiers with positions
  },
  status: {
    type: String,
    enum: ['completed', 'draw', 'cancelled', 'scheduled'],
    default: 'scheduled'
  }
}, {
  timestamps: true
})

// Create indexes for faster lookups
eventScheduleSchema.index({ event_year: 1, sports_name: 1, match_number: 1 }, { unique: true }) // Compound unique - unique match numbers per sport per year
eventScheduleSchema.index({ event_year: 1, sports_name: 1 }) // For efficient year + sport queries
eventScheduleSchema.index({ event_year: 1, sports_name: 1, status: 1 }) // For efficient year + sport + status queries
eventScheduleSchema.index({ event_year: 1 }) // For efficient year queries

// Pre-save hook to lowercase sports_name
eventScheduleSchema.pre('save', function(next) {
  if (this.isModified('sports_name')) {
    this.sports_name = this.sports_name.toLowerCase().trim()
  }
  next()
})

const EventSchedule = mongoose.model('EventSchedule', eventScheduleSchema)

export default EventSchedule
