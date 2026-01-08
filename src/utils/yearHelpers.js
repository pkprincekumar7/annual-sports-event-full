/**
 * Year Helper Functions (Frontend)
 * Utility functions for year-related operations in the frontend
 */

/**
 * Generate year options for registration dropdown
 * Returns formatted year strings for exactly 4 years: 2022, 2023, 2024, 2025
 * @param {number|null} currentYear - Current year (not used, kept for compatibility)
 * @returns {Array} Array of year options with value and label as formatted strings
 */
export function generateYearOfAdmissionOptions(currentYear = null) {
  const options = []
  
  // Fixed set of 4 years: 2022, 2023, 2024, 2025
  // Calculate year labels based on current year
  const currentYearValue = currentYear || new Date().getFullYear()
  const yearLabels = {
    1: '1st Year',
    2: '2nd Year',
    3: '3rd Year',
    4: '4th Year'
  }
  
  // Generate options for years 2022, 2023, 2024, 2025
  const years = [2025, 2024, 2023, 2022]
  
  years.forEach((yearOfAdmission, index) => {
    const yearDifference = currentYearValue - yearOfAdmission
    const label = yearLabels[yearDifference] || `${yearDifference}th Year`
    const formattedYear = `${label} (${yearOfAdmission})`
    
    options.push({
      value: formattedYear,
      label: formattedYear
    })
  })

  return options
}

/**
 * Validate date relationships for event year (frontend)
 * Must satisfy: registration_dates.start < registration_dates.end < event_dates.start < event_dates.end
 * @param {Object} registration_dates - Registration dates object with start and end (YYYY-MM-DD format)
 * @param {Object} event_dates - Event dates object with start and end (YYYY-MM-DD format)
 * @returns {Object} { isValid: boolean, error: string|null }
 */
export function validateDateRelationships(registration_dates, event_dates) {
  if (!registration_dates || !event_dates) {
    return { isValid: false, error: 'Registration dates and event dates are required' }
  }

  if (!registration_dates.start || !registration_dates.end || !event_dates.start || !event_dates.end) {
    return { isValid: false, error: 'All date fields are required' }
  }

  const regStart = new Date(registration_dates.start + 'T00:00:00')
  regStart.setHours(0, 0, 0, 0)

  const regEnd = new Date(registration_dates.end + 'T23:59:59')
  regEnd.setHours(23, 59, 59, 999)

  const eventStart = new Date(event_dates.start + 'T00:00:00')
  eventStart.setHours(0, 0, 0, 0)

  const eventEnd = new Date(event_dates.end + 'T23:59:59')
  eventEnd.setHours(23, 59, 59, 999)

  if (regStart >= regEnd) {
    return { isValid: false, error: 'Registration start date must be before registration end date' }
  }

  if (regEnd >= eventStart) {
    return { isValid: false, error: 'Registration end date must be before event start date' }
  }

  if (eventStart >= eventEnd) {
    return { isValid: false, error: 'Event start date must be before event end date' }
  }

  return { isValid: true, error: null }
}

/**
 * Determine which date fields can be updated based on current date and existing event year dates (frontend)
 * @param {Object} existingEventYear - Existing event year object with dates
 * @returns {Object} Object indicating which dates can be updated and tooltip messages
 */
export function getUpdatableDateFields(existingEventYear) {
  const now = new Date()
  now.setHours(0, 0, 0, 0)

  const regStart = new Date(existingEventYear.registration_dates.start)
  regStart.setHours(0, 0, 0, 0)

  const regEnd = new Date(existingEventYear.registration_dates.end)
  regEnd.setHours(23, 59, 59, 999)

  const eventStart = new Date(existingEventYear.event_dates.start)
  eventStart.setHours(0, 0, 0, 0)

  const eventEnd = new Date(existingEventYear.event_dates.end)
  eventEnd.setHours(23, 59, 59, 999)

  // Check if event has ended
  const eventHasEnded = now > eventEnd

  // After event ends: nothing can be updated
  if (eventHasEnded) {
    return {
      canUpdateRegStart: false,
      canUpdateRegEnd: false,
      canUpdateEventStart: false,
      canUpdateEventEnd: false,
      canUpdateNonDateFields: false,
      regStartTooltip: 'Registration has already started',
      regEndTooltip: 'Registration has already ended',
      eventStartTooltip: 'Event has already started',
      eventEndTooltip: 'Event has already ended',
      nonDateFieldsTooltip: 'Event has already ended. Configuration cannot be updated.'
    }
  }

  // After event starts: only event end can be updated
  if (now >= eventStart) {
    return {
      canUpdateRegStart: false,
      canUpdateRegEnd: false,
      canUpdateEventStart: false,
      canUpdateEventEnd: true,
      canUpdateNonDateFields: true,
      regStartTooltip: 'Registration has already started',
      regEndTooltip: 'Registration has already ended',
      eventStartTooltip: 'Event has already started',
      eventEndTooltip: '',
      nonDateFieldsTooltip: ''
    }
  }

  // After registration ends: only event dates can be updated
  if (now >= regEnd) {
    return {
      canUpdateRegStart: false,
      canUpdateRegEnd: false,
      canUpdateEventStart: true,
      canUpdateEventEnd: true,
      canUpdateNonDateFields: true,
      regStartTooltip: 'Registration has already started',
      regEndTooltip: 'Registration has already ended',
      eventStartTooltip: '',
      eventEndTooltip: '',
      nonDateFieldsTooltip: ''
    }
  }

  // After registration starts: reg end and event dates can be updated
  if (now >= regStart) {
    return {
      canUpdateRegStart: false,
      canUpdateRegEnd: true,
      canUpdateEventStart: true,
      canUpdateEventEnd: true,
      canUpdateNonDateFields: true,
      regStartTooltip: 'Registration has already started',
      regEndTooltip: '',
      eventStartTooltip: '',
      eventEndTooltip: '',
      nonDateFieldsTooltip: ''
    }
  }

  // Before registration starts: all dates can be updated
  return {
    canUpdateRegStart: true,
    canUpdateRegEnd: true,
    canUpdateEventStart: true,
    canUpdateEventEnd: true,
    canUpdateNonDateFields: true,
    regStartTooltip: '',
    regEndTooltip: '',
    eventStartTooltip: '',
    eventEndTooltip: '',
    nonDateFieldsTooltip: ''
  }
}
