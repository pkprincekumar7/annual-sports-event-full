import mongoose from 'mongoose'

const eventYearSchema = new mongoose.Schema({
  year: {
    type: Number,
    required: true,
    unique: true
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
  created_by: {
    type: String,
    required: true,
    trim: true
  }
}, {
  timestamps: true
})

// Create indexes for faster lookups
eventYearSchema.index({ year: 1 }, { unique: true })
// Note: Active status is now determined automatically based on dates, not stored in database

const EventYear = mongoose.model('EventYear', eventYearSchema)

export default EventYear

