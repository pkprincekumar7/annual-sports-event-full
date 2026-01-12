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
import { validateDepartmentExists } from './playerHelpers.js'

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
 * Updated to use year field (formatted string) and validate against Department collection
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

  // year field removed - now handled by Batch collection
  // Batch assignment happens after player registration

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
 * Updated to use year field and validate against Department collection
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

  // year cannot be modified (validation will be done in route handler)

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
 * Requires event_year and event_name for composite key filtering
 */
export const validateCaptainAssignment = (data) => {
  const errors = []

  if (!data.reg_number?.trim()) {
    errors.push('Registration number is required')
  }

  if (!data.sport?.trim()) {
    errors.push('Sport name is required')
  }

  if (!data.event_year) {
    errors.push('Event year is required')
  }

  if (!data.event_name || !data.event_name.trim()) {
    errors.push('Event name is required')
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
