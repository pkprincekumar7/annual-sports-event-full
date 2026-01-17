import mongoose from 'mongoose'

const batchSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
    // Stores batch name like "1st Year (2025)", "2nd Year (2024)", etc.
  },
  event_id: {
    type: String,
    required: true,
    trim: true,
    lowercase: true
  },
  players: {
    type: [String],
    default: []
    // Array of player registration numbers
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
batchSchema.index({ name: 1, event_id: 1 }, { unique: true }) // Unique batch name per event_id
batchSchema.index({ event_id: 1 }) // For efficient event_id queries

// Pre-validate hook to normalize batch fields
batchSchema.pre('validate', function(next) {
  if (this.isModified('name') && this.name) {
    const normalized = this.name
      .toLowerCase()
      .trim()
      .split(/\s+/)
      .map(word => (word ? word[0].toUpperCase() + word.slice(1) : ''))
      .join(' ')
    this.name = normalized
  }
  if (this.isModified('event_id') && this.event_id) {
    this.event_id = this.event_id.toLowerCase().trim()
  }
  next()
})
batchSchema.index({ players: 1 }) // For queries finding batches by player reg_number

const Batch = mongoose.model('Batch', batchSchema)

export default Batch
