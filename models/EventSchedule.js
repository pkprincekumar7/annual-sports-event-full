import mongoose from 'mongoose'

const eventScheduleSchema = new mongoose.Schema({
  match_number: {
    type: Number,
    required: true,
  },
  match_type: {
    type: String,
    enum: ['league', 'knockout'],
    required: true,
  },
  sport: {
    type: String,
    required: true,
  },
  sport_type: {
    type: String,
    enum: ['team', 'individual', 'cultural'],
    required: true,
  },
  team_one: {
    type: String,
    default: null,
  },
  team_two: {
    type: String,
    default: null,
  },
  player_one: {
    type: mongoose.Schema.Types.Mixed,
    default: null,
  },
  player_two: {
    type: mongoose.Schema.Types.Mixed,
    default: null,
  },
  match_date: {
    type: Date,
    required: true,
  },
  winner: {
    type: String,
    default: null,
  },
  status: {
    type: String,
    enum: ['completed', 'draw', 'cancelled', 'scheduled'],
    default: 'scheduled',
  },
}, {
  timestamps: true,
})

// Compound index for match_number and sport to ensure unique sequence per sport
eventScheduleSchema.index({ sport: 1, match_number: 1 }, { unique: true })

// Index for efficient queries
eventScheduleSchema.index({ sport: 1 })
eventScheduleSchema.index({ sport: 1, status: 1 })

const EventSchedule = mongoose.model('EventSchedule', eventScheduleSchema)

export default EventSchedule

