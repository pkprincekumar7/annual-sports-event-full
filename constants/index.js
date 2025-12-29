/**
 * Application Constants
 * Centralized constants for both frontend and backend
 */

// Team Sports
export const TEAM_SPORTS = [
  'Cricket',
  'Volleyball',
  'Badminton',
  'Table Tennis',
  'Kabaddi',
  'Relay 4×100 m',
  'Relay 4×400 m',
]

// Individual Sports
export const INDIVIDUAL_SPORTS = [
  'Carrom',
  'Chess',
  'Sprint 100 m',
  'Sprint 200 m',
  'Sprint 400 m',
  'Long Jump',
  'High Jump',
  'Javelin',
  'Shot Put',
  'Discus Throw',
]

// Cultural Events
export const CULTURAL_SPORTS = [
  'Essay Writing',
  'Story Writing',
  'Group Discussion',
  'Debate',
  'Extempore',
  'Quiz',
  'Dumb Charades',
  'Painting',
  'Singing',
]

// All Sports
export const ALL_SPORTS = [...TEAM_SPORTS, ...INDIVIDUAL_SPORTS, ...CULTURAL_SPORTS]

// Valid Genders
export const VALID_GENDERS = ['Male', 'Female']

// Valid Departments
export const VALID_DEPARTMENTS = ['CSE', 'CSE (AI)', 'ECE', 'EE', 'CE', 'ME', 'MTE']

// Valid Years
export const VALID_YEARS = [
  '1st Year (2025)',
  '2nd Year (2024)',
  '3rd Year (2023)',
  '4th Year (2022)',
]

// Match Types
export const MATCH_TYPES = ['league', 'knockout']

// Match Statuses
export const MATCH_STATUSES = ['scheduled', 'completed', 'draw', 'cancelled']

// Sport Types
export const SPORT_TYPES = ['team', 'individual', 'cultural']

// Participation Limits
export const MAX_PARTICIPATIONS = 10
export const MAX_CAPTAIN_ROLES = 10

// Date Constants
export const REGISTRATION_DEADLINE = process.env.REGISTRATION_DEADLINE || '2026-01-07T00:00:00'
export const EVENT_START_DATE = '2026-01-09T00:00:00'
export const EVENT_END_DATE = '2026-01-13T00:00:00'
export const REGISTRATION_START_DATE = '2026-01-02T00:00:00'
export const REGISTRATION_END_DATE = '2026-01-06T00:00:00'

// JWT Configuration
export const JWT_EXPIRES_IN = '24h'

// Admin Registration Number
export const ADMIN_REG_NUMBER = 'admin'

