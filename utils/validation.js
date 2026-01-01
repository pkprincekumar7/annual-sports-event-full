/**
 * Validation Utilities
 * Reusable validation functions for request data
 */

import {
  VALID_GENDERS,
  MATCH_TYPES,
  MATCH_STATUSES,
  SPORT_TYPES,
} from '../constants/index.js'
import { validateDepartmentExists, canParticipateInEvents } from './playerHelpers.js'

/**
 * Validate email format
 */
export const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

/**
 * Validate phone number (10 digits)
 */
export const isValidPhone = (phone) => {
  const phoneRegex = /^[0-9]{10}$/
  return phoneRegex.test(phone)
}

/**
 * Validate player registration data
 * Updated to use year_of_admission and validate against Department collection
 */
export const validatePlayerData = async (data) => {
  const errors = []

  if (!data.reg_number?.trim()) {
    errors.push('Registration number is required')
  }

  if (!data.full_name?.trim()) {
    errors.push('Full name is required')
  }

  if (!data.gender?.trim()) {
    errors.push('Gender is required')
  } else if (!VALID_GENDERS.includes(data.gender.trim())) {
    errors.push(`Invalid gender. Must be one of: ${VALID_GENDERS.join(', ')}`)
  }

  if (!data.department_branch?.trim()) {
    errors.push('Department/branch is required')
  } else {
    // Validate against Department collection
    const deptValidation = await validateDepartmentExists(data.department_branch)
    if (!deptValidation.exists) {
      errors.push(`Department "${data.department_branch}" does not exist`)
    }
  }

  // Validate year_of_admission (numeric)
  if (data.year_of_admission === undefined || data.year_of_admission === null) {
    errors.push('Year of admission is required')
  } else {
    const yearOfAdmission = parseInt(data.year_of_admission)
    if (isNaN(yearOfAdmission)) {
      errors.push('Year of admission must be a valid number')
    } else {
      // Validate reasonable range (e.g., 2015-2030)
      const currentYear = new Date().getFullYear()
      if (yearOfAdmission < 2015 || yearOfAdmission > currentYear + 1) {
        errors.push(`Year of admission must be between 2015 and ${currentYear + 1}`)
      } else {
        // Validate participation eligibility (1st to 5th year only)
        if (!canParticipateInEvents(yearOfAdmission)) {
          errors.push('Only 1st to 5th year students can register and participate in events')
        }
      }
    }
  }

  if (!data.mobile_number?.trim()) {
    errors.push('Mobile number is required')
  } else if (!isValidPhone(data.mobile_number.trim())) {
    errors.push('Invalid mobile number. Must be 10 digits.')
  }

  if (!data.email_id?.trim()) {
    errors.push('Email ID is required')
  } else if (!isValidEmail(data.email_id.trim())) {
    errors.push('Invalid email format')
  }

  if (!data.password?.trim()) {
    errors.push('Password is required')
  }

  return {
    isValid: errors.length === 0,
    errors,
  }
}

/**
 * Validate sport name (deprecated - use Sports collection)
 * @deprecated Use Sports collection to validate sport names
 */
export const isValidSport = (sport) => {
  // This function is deprecated - sports are now dynamic
  // Keeping for backward compatibility but should not be used
  return true
}

/**
 * Validate match type
 */
export const isValidMatchType = (matchType) => {
  return MATCH_TYPES.includes(matchType)
}

/**
 * Validate match status
 */
export const isValidMatchStatus = (status) => {
  return MATCH_STATUSES.includes(status)
}

/**
 * Validate sport type
 */
export const isValidSportType = (sportType) => {
  return SPORT_TYPES.includes(sportType)
}

/**
 * Validate team sport (deprecated - use Sports collection)
 * @deprecated Use Sports collection to determine sport type
 */
export const isTeamSport = (sport) => {
  // This function is deprecated - sports are now dynamic
  // Keeping for backward compatibility but should not be used
  return false
}

/**
 * Validate player update data (without password)
 * Updated to use year_of_admission and validate against Department collection
 */
export const validateUpdatePlayerData = async (data) => {
  const errors = []

  if (!data.reg_number?.trim()) {
    errors.push('Registration number is required')
  }

  if (!data.full_name?.trim()) {
    errors.push('Full name is required')
  }

  if (!data.gender?.trim()) {
    errors.push('Gender is required')
  } else if (!VALID_GENDERS.includes(data.gender.trim())) {
    errors.push(`Invalid gender. Must be one of: ${VALID_GENDERS.join(', ')}`)
  }

  if (!data.department_branch?.trim()) {
    errors.push('Department/branch is required')
  } else {
    // Validate against Department collection
    const deptValidation = await validateDepartmentExists(data.department_branch)
    if (!deptValidation.exists) {
      errors.push(`Department "${data.department_branch}" does not exist`)
    }
  }

  // year_of_admission cannot be modified (validation will be done in route handler)

  if (!data.mobile_number?.trim()) {
    errors.push('Mobile number is required')
  } else if (!isValidPhone(data.mobile_number.trim())) {
    errors.push('Invalid mobile number. Must be 10 digits.')
  }

  if (!data.email_id?.trim()) {
    errors.push('Email ID is required')
  } else if (!isValidEmail(data.email_id.trim())) {
    errors.push('Invalid email format')
  }

  return {
    isValid: errors.length === 0,
    errors,
  }
}

/**
 * Validate captain assignment data
 */
export const validateCaptainAssignment = (data) => {
  const errors = []

  if (!data.reg_number?.trim()) {
    errors.push('Registration number is required')
  }

  if (!data.sport?.trim()) {
    errors.push('Sport name is required')
  }

  return {
    isValid: errors.length === 0,
    errors,
  }
}

/**
 * Trim all string fields in an object
 */
export const trimObjectFields = (obj) => {
  if (!obj || typeof obj !== 'object') {
    return obj
  }

  const trimmed = {}
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const value = obj[key]
      if (typeof value === 'string') {
        trimmed[key] = value.trim()
      } else if (Array.isArray(value)) {
        trimmed[key] = value.map((item) => (typeof item === 'string' ? item.trim() : item))
      } else {
        trimmed[key] = value
      }
    }
  }
  return trimmed
}
