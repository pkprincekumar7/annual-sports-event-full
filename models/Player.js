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
  year_of_admission: {
    type: Number,
    required: true
    // No enum restriction - accepts any numeric year
    // Display format "1st Year (2025)" computed dynamically
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
  }
  // participated_in and captain_in removed - computed dynamically from Sports collection
}, {
  timestamps: true
})

// Create indexes for faster lookups
playerSchema.index({ reg_number: 1 }) // Already unique, but explicit index for performance
playerSchema.index({ department_branch: 1 }) // For queries filtering by department
playerSchema.index({ year_of_admission: 1 }) // For queries filtering by year of admission

const Player = mongoose.model('Player', playerSchema)

export default Player

