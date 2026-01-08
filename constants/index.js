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

// Pagination
export const DEFAULT_PLAYERS_PAGE_SIZE = 25 // Default page size for players list pagination and search

// Note: Date constants removed - dates are now fetched from EventYear model in database
// Registration and event dates are managed per event year through the Event Year management interface

// JWT Configuration
export const JWT_EXPIRES_IN = '24h'

// Admin Registration Number
export const ADMIN_REG_NUMBER = 'admin'

