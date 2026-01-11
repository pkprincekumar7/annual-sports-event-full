/**
 * Application Constants
 * Centralized constants for the entire application
 */

// Event Information
export const EVENT_INFO = {
  name: 'UMANG – 2026',
  fullName: 'PCE, Purnea • Umang – 2026 Sports Fest',
  college: 'Purnea College of Engineering, Purnea',
  eventDates: {
    start: '2026-01-09T00:00:00',
    end: '2026-01-13T00:00:00',
    display: '9th Jan 2026 to 13th Jan 2026',
  },
  registrationDates: {
    start: '2026-01-02T00:00:00',
    end: '2026-01-06T00:00:00',
    display: '2nd Jan 2026 to 6th Jan 2026',
  },
}

// Form Options
export const GENDER_OPTIONS = [
  { value: 'Male', label: 'Male' },
  { value: 'Female', label: 'Female' },
]

// DEPARTMENT_OPTIONS and CULTURAL_SPORTS removed - now fetched dynamically from API

// Pagination
export const DEFAULT_PLAYERS_PAGE_SIZE = 25 // Default page size for players list pagination and search

// Admin Registration Number
export const ADMIN_REG_NUMBER = 'admin'

