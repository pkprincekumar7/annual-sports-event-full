import mongoose from 'mongoose'

const pointsTableSchema = new mongoose.Schema({
  event_year: {
    type: Number,
    required: true
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
  }
}, {
  timestamps: true
})

// Create indexes for faster lookups
pointsTableSchema.index({ event_year: 1, sports_name: 1, participant: 1 }, { unique: true }) // Compound unique - unique participant per sport per year
pointsTableSchema.index({ event_year: 1, sports_name: 1, points: -1 }) // For efficient sorted points table queries by year
pointsTableSchema.index({ event_year: 1, sports_name: 1 }) // For efficient year + sport queries

// Pre-save hook to lowercase sports_name
pointsTableSchema.pre('save', function(next) {
  if (this.isModified('sports_name')) {
    this.sports_name = this.sports_name.toLowerCase().trim()
  }
  next()
})

const PointsTable = mongoose.model('PointsTable', pointsTableSchema)

export default PointsTable

