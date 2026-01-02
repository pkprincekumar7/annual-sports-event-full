/**
 * Application Constants
 * Centralized constants for both frontend and backend
 */

// Valid Genders
export const VALID_GENDERS = ['Male', 'Female']

// Match Types (updated to include 'final')
export const MATCH_TYPES = ['league', 'knockout', 'final']

// Match Statuses
export const MATCH_STATUSES = ['scheduled', 'completed', 'draw', 'cancelled']

// Sport Types (updated to new type system)
export const SPORT_TYPES = ['dual_team', 'multi_team', 'dual_player', 'multi_player']

// Note: Hardcoded sports arrays (TEAM_SPORTS, INDIVIDUAL_SPORTS, CULTURAL_SPORTS) removed
// Sports are now fetched dynamically from the Sport model via API
// Note: VALID_DEPARTMENTS removed - departments are now fetched dynamically from Department model via API
// Note: VALID_YEARS removed - year field stores formatted string like "1st Year (2025)" directly

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

