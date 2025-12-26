import mongoose from 'mongoose'

const participationSchema = new mongoose.Schema({
  sport: {
    type: String,
    required: true
  },
  team_name: {
    type: String,
    default: null
  }
}, { _id: false })

const playerSchema = new mongoose.Schema({
  reg_number: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  full_name: {
    type: String,
    required: true,
    trim: true
  },
  gender: {
    type: String,
    required: true,
    enum: ['Male', 'Female'],
    trim: true
  },
  department_branch: {
    type: String,
    required: true,
    enum: ['CSE', 'CSE (AI)', 'ECE', 'EE', 'CE', 'ME', 'MTE'],
    trim: true
  },
  year: {
    type: String,
    required: true,
    enum: ['1st Year (2025)', '2nd Year (2024)', '3rd Year (2023)', '4th Year (2022)'],
    trim: true
  },
  mobile_number: {
    type: String,
    required: true,
    match: [/^[0-9]{10}$/, 'Mobile number must be 10 digits'],
    trim: true
  },
  email_id: {
    type: String,
    required: true,
    match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Invalid email format'],
    trim: true
  },
  password: {
    type: String,
    required: true,
    trim: true
  },
  participated_in: {
    type: [participationSchema],
    default: []
  },
  captain_in: {
    type: [String],
    default: []
  }
}, {
  timestamps: true
})

// Create indexes for faster lookups
playerSchema.index({ reg_number: 1 }) // Already unique, but explicit index for performance
playerSchema.index({ captain_in: 1 }) // For queries filtering by captain_in array
playerSchema.index({ 'participated_in.sport': 1, 'participated_in.team_name': 1 }) // Compound index for team queries
playerSchema.index({ 'participated_in.sport': 1 }) // Index for sport-based queries

const Player = mongoose.model('Player', playerSchema)

export default Player

