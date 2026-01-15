import mongoose from 'mongoose'

const eventYearSchema = new mongoose.Schema({
  event_id: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },
  event_year: {
    type: Number,
    required: true
  },
  event_name: {
    type: String,
    required: true,
    trim: true,
    lowercase: true
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
eventYearSchema.index({ event_id: 1 }, { unique: true }) // Unique event identifier
eventYearSchema.index({ event_year: 1 }) // For efficient event year queries
// Note: Active status is now determined automatically based on dates, not stored in database

// Pre-validate hook to normalize event_name and build event_id before required checks
eventYearSchema.pre('validate', function(next) {
  if (this.isModified('event_name') && this.event_name) {
    this.event_name = this.event_name.toLowerCase().trim()
  }
  if ((this.isModified('event_year') || this.isModified('event_name')) && this.event_year && this.event_name) {
    const normalizedName = this.event_name.toLowerCase().trim().replace(/\s+/g, '-')
    this.event_id = `${this.event_year}-${normalizedName}`.toLowerCase()
  }
  next()
})

const EventYear = mongoose.model('EventYear', eventYearSchema)

export default EventYear

