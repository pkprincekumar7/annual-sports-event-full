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

