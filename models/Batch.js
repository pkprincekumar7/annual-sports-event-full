import mongoose from 'mongoose'

const batchSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
    // Stores batch name like "1st Year (2025)", "2nd Year (2024)", etc.
  },
  event_year: {
    type: Number,
    required: true
  },
  event_name: {
    type: String,
    required: true,
    trim: true
  },
  players: {
    type: [String],
    default: []
    // Array of player registration numbers
  }
}, {
  timestamps: true
})

// Create indexes for faster lookups
batchSchema.index({ name: 1, event_year: 1, event_name: 1 }, { unique: true }) // Compound unique - unique batch name per event year and name
batchSchema.index({ event_year: 1, event_name: 1 }) // For efficient event year + event name queries
batchSchema.index({ players: 1 }) // For queries finding batches by player reg_number

const Batch = mongoose.model('Batch', batchSchema)

export default Batch
