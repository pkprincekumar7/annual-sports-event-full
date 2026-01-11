import mongoose from 'mongoose'

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
    trim: true
    // No enum restriction - validated against Department collection
  },
  // year field removed - now handled by Batch collection
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
  }
  // participated_in and captain_in removed - computed dynamically from Sports collection
}, {
  timestamps: true
})

// Create indexes for faster lookups
playerSchema.index({ reg_number: 1 }) // Already unique, but explicit index for performance
playerSchema.index({ department_branch: 1 }) // For queries filtering by department
// year index removed - batch filtering now handled by Batch collection

const Player = mongoose.model('Player', playerSchema)

export default Player

