/**
 * Validation Utilities
 * Reusable validation functions for request data
 */

import {
  VALID_GENDERS,
  VALID_DEPARTMENTS,
  VALID_YEARS,
  TEAM_SPORTS,
  INDIVIDUAL_SPORTS,
  CULTURAL_SPORTS,
  MATCH_TYPES,
  MATCH_STATUSES,
  SPORT_TYPES,
} from '../constants/index.js'

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
 */
export const validatePlayerData = (data) => {
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
  } else if (!VALID_DEPARTMENTS.includes(data.department_branch.trim())) {
    errors.push(`Invalid department/branch. Must be one of: ${VALID_DEPARTMENTS.join(', ')}`)
  }

  if (!data.year?.trim()) {
    errors.push('Year is required')
  } else if (!VALID_YEARS.includes(data.year.trim())) {
    errors.push(`Invalid year. Must be one of: ${VALID_YEARS.join(', ')}`)
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
 * Validate sport name
 */
export const isValidSport = (sport) => {
  return TEAM_SPORTS.includes(sport) || 
         INDIVIDUAL_SPORTS.includes(sport) || 
         CULTURAL_SPORTS.includes(sport)
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
 * Validate team sport
 */
export const isTeamSport = (sport) => {
  return TEAM_SPORTS.includes(sport)
}

/**
 * Validate player update data (without password)
 */
export const validateUpdatePlayerData = (data) => {
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
  } else if (!VALID_DEPARTMENTS.includes(data.department_branch.trim())) {
    errors.push(`Invalid department/branch. Must be one of: ${VALID_DEPARTMENTS.join(', ')}`)
  }

  if (!data.year?.trim()) {
    errors.push('Year is required')
  } else if (!VALID_YEARS.includes(data.year.trim())) {
    errors.push(`Invalid year. Must be one of: ${VALID_YEARS.join(', ')}`)
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
    errors.push('Sport is required')
  } else if (!isTeamSport(data.sport.trim())) {
    errors.push(`Invalid sport. Only team sports can have captains: ${TEAM_SPORTS.join(', ')}`)
  }

  return {
    isValid: errors.length === 0,
    errors,
  }
}

/**
 * Trim string fields in an object
 */
export const trimObjectFields = (obj) => {
  const trimmed = {}
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      trimmed[key] = value.trim()
    } else {
      trimmed[key] = value
    }
  }
  return trimmed
}

