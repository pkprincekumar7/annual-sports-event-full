import mongoose from 'mongoose'

const departmentSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  code: {
    type: String,
    trim: true,
    default: ''
  },
  display_order: {
    type: Number,
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
  // Note: created_by field removed - using createdBy instead for consistency
}, {
  timestamps: true
})

// Create indexes for faster lookups
departmentSchema.index({ name: 1 }, { unique: true })
departmentSchema.index({ display_order: 1 }) // For efficient queries sorted by display_order

const Department = mongoose.model('Department', departmentSchema)

export default Department

