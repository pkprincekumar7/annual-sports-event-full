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
  is_active: {
    type: Boolean,
    default: false
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
eventYearSchema.index({ is_active: 1 }) // For efficient queries of active year

// Pre-save hook to ensure only one active year at a time
eventYearSchema.pre('save', async function(next) {
  if (this.is_active && this.isModified('is_active')) {
    // Deactivate all other years
    await mongoose.model('EventYear').updateMany(
      { _id: { $ne: this._id } },
      { $set: { is_active: false } }
    )
  }
  next()
})

const EventYear = mongoose.model('EventYear', eventYearSchema)

export default EventYear

