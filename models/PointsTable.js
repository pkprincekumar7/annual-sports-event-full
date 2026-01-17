import mongoose from 'mongoose'

const pointsTableSchema = new mongoose.Schema({
  event_id: {
    type: String,
    required: true,
    trim: true,
    lowercase: true
  },
  sports_name: {
    type: String,
    required: true,
    trim: true,
    lowercase: true
  },
  participant: {
    type: String,
    required: true,
    trim: true
    // team_name (for team sports) or player reg_number (for individual sports)
  },
  participant_type: {
    type: String,
    required: true,
    enum: ['team', 'player']
  },
  points: {
    type: Number,
    required: true,
    default: 0
  },
  matches_played: {
    type: Number,
    required: true,
    default: 0
  },
  matches_won: {
    type: Number,
    required: true,
    default: 0
  },
  matches_lost: {
    type: Number,
    required: true,
    default: 0
  },
  matches_draw: {
    type: Number,
    required: true,
    default: 0
  },
  matches_cancelled: {
    type: Number,
    required: true,
    default: 0
  },
  createdBy: {
    type: String,
    trim: true,
    default: null
  },
  updatedBy: {
    type: String,
    trim: true,
    default: null
  }
}, {
  timestamps: true
})

// Create indexes for faster lookups
pointsTableSchema.index({ event_id: 1, sports_name: 1, participant: 1 }, { unique: true }) // Unique participant per sport/event_id
pointsTableSchema.index({ event_id: 1, sports_name: 1, points: -1 }) // For efficient sorted points table queries by event_id
pointsTableSchema.index({ event_id: 1, sports_name: 1 }) // For efficient event_id + sport queries

// Pre-save hook to normalize sports_name and event_id
pointsTableSchema.pre('save', function(next) {
  if (this.isModified('sports_name')) {
    this.sports_name = this.sports_name.toLowerCase().trim()
  }
  if (this.isModified('event_id') && this.event_id) {
    this.event_id = this.event_id.toLowerCase().trim()
  }
  next()
})

const PointsTable = mongoose.model('PointsTable', pointsTableSchema)

export default PointsTable

