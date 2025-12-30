/**
 * Year Helper Functions (Frontend)
 * Utility functions for year-related operations in the frontend
 */

/**
 * Generate year options for year of admission dropdown
 * Returns years from current year back to 5 years (to support 1st to 5th year students)
 * @param {number|null} currentYear - Current year (defaults to current year if not provided)
 * @returns {Array} Array of year options with value and label
 */
export function generateYearOfAdmissionOptions(currentYear = null) {
  if (!currentYear) {
    currentYear = new Date().getFullYear()
  }

  const options = []
  
  // Generate years from current year back to 5 years (to support 1st to 5th year students)
  // For example, if current year is 2026, generate: 2026, 2025, 2024, 2023, 2022, 2021
  // This allows students admitted in 2021 (5th year) to 2026 (1st year) to register
  for (let year = currentYear; year >= currentYear - 4; year--) {
    options.push({
      value: year.toString(),
      label: year.toString()
    })
  }

  return options
}

/**
 * Compute year display format from year_of_admission
 * @param {number} yearOfAdmission - Year of admission (e.g., 2025, 2024)
 * @param {number|null} currentYear - Current year (defaults to current year if not provided)
 * @returns {string} Display format like "1st Year (2025)" or "5th Year (2021)"
 */
export function computeYearDisplay(yearOfAdmission, currentYear = null) {
  if (!currentYear) {
    currentYear = new Date().getFullYear()
  }
  
  if (!yearOfAdmission) {
    return ''
  }
  
  // Calculate year difference
  const yearDifference = currentYear - parseInt(yearOfAdmission)
  
  // Map to display format (supports up to 5th year, but can display beyond)
  const yearLabels = {
    1: '1st Year',
    2: '2nd Year',
    3: '3rd Year',
    4: '4th Year',
    5: '5th Year'
  }
  
  const label = yearLabels[yearDifference] || `${yearDifference}th Year`
  
  return `${label} (${yearOfAdmission})`
}

/**
 * Check if player can participate in events (1st to 5th year students only)
 * @param {number} yearOfAdmission - Year of admission (e.g., 2025, 2024)
 * @param {number|null} currentYear - Current year (defaults to current year if not provided)
 * @returns {boolean} True if player is in 1st to 5th year, false otherwise
 */
export function canParticipateInEvents(yearOfAdmission, currentYear = null) {
  if (!currentYear) {
    currentYear = new Date().getFullYear()
  }
  
  if (!yearOfAdmission) {
    return false
  }
  
  // Calculate year difference
  const yearDifference = currentYear - parseInt(yearOfAdmission)
  
  // Only 1st to 5th year students can participate
  return yearDifference >= 1 && yearDifference <= 5
}

