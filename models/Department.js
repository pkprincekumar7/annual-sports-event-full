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
  is_active: {
    type: Boolean,
    default: true
  },
  display_order: {
    type: Number,
    default: 0
  },
  created_by: {
    type: String,
    required: true,
    trim: true
  }
}, {
  timestamps: true
})

// Create indexes for faster lookups
departmentSchema.index({ name: 1 }, { unique: true })
departmentSchema.index({ is_active: 1, display_order: 1 }) // For efficient queries of active departments sorted by display_order

const Department = mongoose.model('Department', departmentSchema)

export default Department

