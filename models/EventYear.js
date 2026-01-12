import mongoose from 'mongoose'

const eventYearSchema = new mongoose.Schema({
  event_year: {
    type: Number,
    required: true
  },
  event_name: {
    type: String,
    required: true,
    trim: true
  },
  event_dates: {
    start: {
      type: Date,
      required: true
    },
    end: {
      type: Date,
      required: true
    }
  },
  registration_dates: {
    start: {
      type: Date,
      required: true
    },
    end: {
      type: Date,
      required: true
    }
  },
  event_organizer: {
    type: String,
    trim: true,
    default: 'Events Community'
  },
  event_title: {
    type: String,
    trim: true,
    default: 'Community Entertainment'
  },
  event_highlight: {
    type: String,
    trim: true,
    default: 'Community Entertainment Fest'
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
eventYearSchema.index({ event_year: 1, event_name: 1 }, { unique: true }) // Compound unique index - unique combination of event_year and event_name
eventYearSchema.index({ event_year: 1 }) // For efficient event year queries
// Note: Active status is now determined automatically based on dates, not stored in database

const EventYear = mongoose.model('EventYear', eventYearSchema)

export default EventYear

