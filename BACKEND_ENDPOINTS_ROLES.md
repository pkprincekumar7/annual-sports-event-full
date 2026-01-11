# Backend API Endpoints - Role-Based Access Control

This document lists all backend endpoints and the roles that can access them, along with date range validation requirements.

## Role Definitions

- **Public**: No authentication required
- **Authenticated**: Any logged-in user (admin, coordinator, captain, or player)
- **Admin**: Only users with admin registration number
- **Coordinator**: Users assigned as coordinators for specific sports (can perform admin operations for their assigned sports)
- **Captain**: Users assigned as captains for specific sports (can create teams for their assigned sports)
- **Player**: Regular authenticated users

**Note**: Coordinators can perform admin operations (except editing/deleting sports) for their assigned sports only. Captains can create teams for their assigned sports only.

## Date Range Validation Types

- **Registration Period**: Current date must be within `registration_dates.start` and `registration_dates.end`
- **Event Period**: Current date must be after `registration_dates.end` and before `event_dates.end`
- **Event Scheduling Period**: Current date must be after `registration_dates.start` and before `event_dates.end`
- **Event Status Update Period**: Current date must be between `event_dates.start` and `event_dates.end`
- **Registration Deadline Check**: Applied globally to all non-GET requests (except login, event-schedule, and points-table). Blocks requests after `registration_dates.end`
- **Match Date Validation**: Match date must be within `event_dates.start` and `event_dates.end` (validated in route handler)

---

## Authentication Routes (`/api`)

### POST `/api/login`
- **Access**: Public
- **Description**: User login endpoint
- **Auth**: None
- **Date Validation**: None (exempt from registration deadline check)

---

## Player Routes (`/api`)

### GET `/api/me`
- **Access**: Authenticated (Admin, Coordinator, Captain, Player)
- **Description**: Get current authenticated user data with computed participation fields
- **Auth**: `authenticateToken`
- **Date Validation**: None (GET requests are exempt from registration deadline check)

### GET `/api/players`
- **Access**: Authenticated (Admin, Coordinator, Captain, Player)
- **Description**: Get all players with computed participation fields
- **Auth**: `authenticateToken`
- **Date Validation**: None (GET requests are exempt from registration deadline check)

### POST `/api/save-player`
- **Access**: Public (during registration period)
- **Description**: Register a new player (general registration)
- **Auth**: None (but requires registration period)
- **Date Validation**: **Registration Period** - Current date must be within `registration_dates.start` and `registration_dates.end`. Also subject to global registration deadline check.

### PUT `/api/update-player`
- **Access**: Admin
- **Description**: Update player data
- **Auth**: `authenticateToken`, `requireAdmin`, `requireRegistrationPeriod`
- **Date Validation**: **Registration Period** - Current date must be within `registration_dates.start` and `registration_dates.end`. Also subject to global registration deadline check.

### POST `/api/bulk-player-enrollments`
- **Access**: Admin
- **Description**: Get enrollments for multiple players (optimized bulk endpoint)
- **Auth**: `authenticateToken`, `requireAdmin`
- **Date Validation**: Subject to global registration deadline check (blocks after `registration_dates.end`)

### GET `/api/player-enrollments/:reg_number`
- **Access**: Admin
- **Description**: Get player enrollments for deletion validation
- **Auth**: `authenticateToken`, `requireAdmin`
- **Date Validation**: None (GET requests are exempt from registration deadline check)

### DELETE `/api/delete-player/:reg_number`
- **Access**: Admin
- **Description**: Delete player and their enrollments
- **Auth**: `authenticateToken`, `requireAdmin`, `requireRegistrationPeriod`
- **Date Validation**: **Registration Period** - Current date must be within `registration_dates.start` and `registration_dates.end`. Also subject to global registration deadline check.

### POST `/api/bulk-delete-players`
- **Access**: Admin
- **Description**: Bulk delete players with validation
- **Auth**: `authenticateToken`, `requireAdmin`, `requireRegistrationPeriod`
- **Date Validation**: **Registration Period** - Current date must be within `registration_dates.start` and `registration_dates.end`. Also subject to global registration deadline check.

---

## Sports Routes (`/api`)

### GET `/api/sports`
- **Access**: Public
- **Description**: Get all sports for a specific event year
- **Auth**: None
- **Date Validation**: None (GET requests are exempt from registration deadline check)

### POST `/api/sports`
- **Access**: Admin
- **Description**: Create new sport
- **Auth**: `authenticateToken`, `requireAdmin`, `requireRegistrationPeriod`
- **Date Validation**: **Registration Period** - Current date must be within `registration_dates.start` and `registration_dates.end`. Also subject to global registration deadline check.

### PUT `/api/sports/:id`
- **Access**: Admin
- **Description**: Update sport
- **Auth**: `authenticateToken`, `requireAdmin`, `requireRegistrationPeriod`
- **Date Validation**: **Registration Period** - Current date must be within `registration_dates.start` and `registration_dates.end`. Also subject to global registration deadline check.

### DELETE `/api/sports/:id`
- **Access**: Admin
- **Description**: Delete sport
- **Auth**: `authenticateToken`, `requireAdmin`, `requireRegistrationPeriod`
- **Date Validation**: **Registration Period** - Current date must be within `registration_dates.start` and `registration_dates.end`. Also subject to global registration deadline check.

### GET `/api/sports-counts`
- **Access**: Authenticated (Admin, Coordinator, Captain, Player)
- **Description**: Get sports counts (teams and participants)
- **Auth**: `authenticateToken`
- **Date Validation**: None (GET requests are exempt from registration deadline check)

### GET `/api/sports/:name`
- **Access**: Public
- **Description**: Get sport by name
- **Auth**: None
- **Date Validation**: None (GET requests are exempt from registration deadline check)

---

## Captain Routes (`/api`)

### POST `/api/add-captain`
- **Access**: Admin
- **Description**: Add captain role to a player
- **Auth**: `authenticateToken`, `requireAdmin`, `requireRegistrationPeriod`
- **Date Validation**: **Registration Period** - Current date must be within `registration_dates.start` and `registration_dates.end`. Also subject to global registration deadline check.

### DELETE `/api/remove-captain`
- **Access**: Admin
- **Description**: Remove captain role from a player
- **Auth**: `authenticateToken`, `requireAdmin`, `requireRegistrationPeriod`
- **Date Validation**: **Registration Period** - Current date must be within `registration_dates.start` and `registration_dates.end`. Also subject to global registration deadline check.

### GET `/api/captains-by-sport`
- **Access**: Admin
- **Description**: Get all captains grouped by sport
- **Auth**: `authenticateToken`, `requireAdmin`
- **Date Validation**: None (GET requests are exempt from registration deadline check)

---

## Coordinator Routes (`/api`)

### POST `/api/add-coordinator`
- **Access**: Admin
- **Description**: Add coordinator role to a player
- **Auth**: `authenticateToken`, `requireAdmin`, `requireRegistrationPeriod`
- **Date Validation**: **Registration Period** - Current date must be within `registration_dates.start` and `registration_dates.end`. Also subject to global registration deadline check.

### DELETE `/api/remove-coordinator`
- **Access**: Admin
- **Description**: Remove coordinator role from a player
- **Auth**: `authenticateToken`, `requireAdmin`, `requireRegistrationPeriod`
- **Date Validation**: **Registration Period** - Current date must be within `registration_dates.start` and `registration_dates.end`. Also subject to global registration deadline check.

### GET `/api/coordinators-by-sport`
- **Access**: Admin
- **Description**: Get all coordinators grouped by sport
- **Auth**: `authenticateToken`, `requireAdmin`
- **Date Validation**: None (GET requests are exempt from registration deadline check)

---

## Batch Routes (`/api`)

### POST `/api/add-batch`
- **Access**: Admin
- **Description**: Create a new batch
- **Auth**: `authenticateToken`, `requireAdmin`, `requireRegistrationPeriod`
- **Date Validation**: **Registration Period** - Current date must be within `registration_dates.start` and `registration_dates.end`. Also subject to global registration deadline check.

### DELETE `/api/remove-batch`
- **Access**: Admin
- **Description**: Delete a batch
- **Auth**: `authenticateToken`, `requireAdmin`, `requireRegistrationPeriod`
- **Date Validation**: **Registration Period** - Current date must be within `registration_dates.start` and `registration_dates.end`. Also subject to global registration deadline check.

### GET `/api/batches`
- **Access**: Admin
- **Description**: Get all batches for an event year
- **Auth**: `authenticateToken`, `requireAdmin`
- **Date Validation**: None (GET requests are exempt from registration deadline check)

---

## Team Routes (`/api`)

### POST `/api/update-team-participation`
- **Access**: Authenticated (Captain can create team for assigned sports, Admin/Coordinator can create for any sport)
- **Description**: Captain creates a team
- **Auth**: `authenticateToken`, `requireRegistrationPeriod`
- **Date Validation**: **Registration Period** - Current date must be within `registration_dates.start` and `registration_dates.end`. Also subject to global registration deadline check.
- **Note**: Captains can only create teams for sports where they are assigned as captain

### GET `/api/teams/:sport`
- **Access**: Authenticated (Admin, Coordinator, Captain, Player)
- **Description**: Get all teams for a specific sport
- **Auth**: `authenticateToken`
- **Date Validation**: None (GET requests are exempt from registration deadline check)

### POST `/api/update-team-player`
- **Access**: Admin, Coordinator (for assigned sports)
- **Description**: Update/replace a player in a team
- **Auth**: `authenticateToken`, `requireAdminOrCoordinator`, `requireRegistrationPeriod`
- **Date Validation**: **Registration Period** - Current date must be within `registration_dates.start` and `registration_dates.end`. Also subject to global registration deadline check.

### DELETE `/api/delete-team`
- **Access**: Admin, Coordinator (for assigned sports)
- **Description**: Delete a team
- **Auth**: `authenticateToken`, `requireAdminOrCoordinator`, `requireRegistrationPeriod`
- **Date Validation**: **Registration Period** - Current date must be within `registration_dates.start` and `registration_dates.end`. Also subject to global registration deadline check.

### POST `/api/validate-participations`
- **Access**: Authenticated (Admin, Coordinator, Captain, Player)
- **Description**: Validate participations before team registration
- **Auth**: `authenticateToken`
- **Date Validation**: Subject to global registration deadline check (blocks after `registration_dates.end`)

---

## Participant Routes (`/api`)

### GET `/api/participants/:sport`
- **Access**: Admin, Coordinator (for assigned sports)
- **Description**: Get all participants for a specific sport (non-team events)
- **Auth**: `authenticateToken`, `requireAdminOrCoordinator` (checked in route handler)
- **Date Validation**: None (GET requests are exempt from registration deadline check)

### GET `/api/participants-count/:sport`
- **Access**: Authenticated (Admin, Coordinator, Captain, Player)
- **Description**: Get total participants count for a specific sport
- **Auth**: `authenticateToken`
- **Date Validation**: None (GET requests are exempt from registration deadline check)

### POST `/api/update-participation`
- **Access**: Authenticated (Admin, Coordinator, Captain, Player)
- **Description**: Update individual/cultural event participation
- **Auth**: `authenticateToken`, `requireRegistrationPeriod`
- **Date Validation**: **Registration Period** - Current date must be within `registration_dates.start` and `registration_dates.end`. Also subject to global registration deadline check.

### DELETE `/api/remove-participation`
- **Access**: Admin
- **Description**: Remove participation (team or individual)
- **Auth**: `authenticateToken`, `requireAdmin`, `requireRegistrationPeriod`
- **Date Validation**: **Registration Period** - Current date must be within `registration_dates.start` and `registration_dates.end`. Also subject to global registration deadline check.

---

## Event Schedule Routes (`/api`)

### GET `/api/event-schedule/:sport`
- **Access**: Authenticated (Admin, Coordinator, Captain, Player)
- **Description**: Get all matches for a sport
- **Auth**: `authenticateToken`
- **Date Validation**: None (GET requests are exempt from registration deadline check, and event-schedule endpoints are exempt from global deadline check)

### GET `/api/event-schedule/:sport/teams-players`
- **Access**: Admin, Coordinator (for assigned sports)
- **Description**: Get teams/players list for a sport (for dropdown in form)
- **Auth**: `authenticateToken`, `requireAdminOrCoordinator`
- **Date Validation**: None (GET requests are exempt from registration deadline check, and event-schedule endpoints are exempt from global deadline check)

### POST `/api/event-schedule`
- **Access**: Admin, Coordinator (for assigned sports)
- **Description**: Create a new match
- **Auth**: `authenticateToken`, `requireAdminOrCoordinator`, `requireEventPeriod`
- **Date Validation**: **Event Period** - Current date must be after `registration_dates.end` and before `event_dates.end`. **Match Date Validation** - The `match_date` in the request body must be within `event_dates.start` and `event_dates.end`. Exempt from global registration deadline check.

### PUT `/api/event-schedule/:id`
- **Access**: Admin, Coordinator (for assigned sports)
- **Description**: Update match result (status, winner, qualifiers, match_date)
- **Auth**: `authenticateToken`, `requireAdminOrCoordinator`, `requireEventStatusUpdatePeriod`
- **Date Validation**: **Event Status Update Period** - Current date must be between `event_dates.start` and `event_dates.end`. Exempt from global registration deadline check.

### DELETE `/api/event-schedule/:id`
- **Access**: Admin, Coordinator (for assigned sports)
- **Description**: Delete a match
- **Auth**: `authenticateToken`, `requireAdminOrCoordinator`, `requireEventPeriod`
- **Date Validation**: **Event Period** - Current date must be after `registration_dates.end` and before `event_dates.end`. Exempt from global registration deadline check.

---

## Export Routes (`/api`)

### GET `/api/export-excel`
- **Access**: Admin
- **Description**: Export players data to Excel
- **Auth**: `authenticateToken`, `requireAdmin`
- **Date Validation**: None (GET requests are exempt from registration deadline check)

---

## Department Routes (`/api/departments`)

### GET `/api/departments`
- **Access**: Authenticated (Admin, Coordinator, Captain, Player)
- **Description**: Get all departments (sorted by display_order)
- **Auth**: `authenticateToken`
- **Date Validation**: None (GET requests are exempt from registration deadline check)

### GET `/api/departments/active`
- **Access**: Public
- **Description**: Get all departments (public, for dropdowns)
- **Auth**: None
- **Date Validation**: None (GET requests are exempt from registration deadline check)

### POST `/api/departments`
- **Access**: Admin
- **Description**: Create new department
- **Auth**: `authenticateToken`, `requireAdmin`
- **Date Validation**: Subject to global registration deadline check (blocks after `registration_dates.end`)

### PUT `/api/departments/:id`
- **Access**: Admin
- **Description**: Update department (only display_order can be updated)
- **Auth**: `authenticateToken`, `requireAdmin`
- **Date Validation**: Subject to global registration deadline check (blocks after `registration_dates.end`)

### DELETE `/api/departments/:id`
- **Access**: Admin
- **Description**: Delete department (only if no players have this department)
- **Auth**: `authenticateToken`, `requireAdmin`
- **Date Validation**: Subject to global registration deadline check (blocks after `registration_dates.end`)

---

## Event Year Routes (`/api/event-years`)

### GET `/api/event-years`
- **Access**: Admin
- **Description**: Get all event years (includes computed is_active status)
- **Auth**: `authenticateToken`, `requireAdmin`
- **Date Validation**: None (GET requests are exempt from registration deadline check)

### GET `/api/event-years/active`
- **Access**: Public
- **Description**: Get currently active event year (automatically determined based on dates)
- **Auth**: None
- **Date Validation**: None (GET requests are exempt from registration deadline check)

### POST `/api/event-years`
- **Access**: Admin
- **Description**: Create new event year
- **Auth**: `authenticateToken`, `requireAdmin`, `requireRegistrationPeriod`
- **Date Validation**: **Registration Period** - Current date must be within `registration_dates.start` and `registration_dates.end`. Also validates that `registration_dates.start` and `event_dates.start` are not in the past. Also subject to global registration deadline check.

### PUT `/api/event-years/:event_year`
- **Access**: Admin
- **Description**: Update event year configuration
- **Auth**: `authenticateToken`, `requireAdmin`, `requireRegistrationPeriod`
- **Date Validation**: **Registration Period** - Current date must be within `registration_dates.start` and `registration_dates.end`. Has additional restrictions: cannot update certain fields after event ends, cannot update registration start date after registration has started, cannot update registration end date after registration has ended, cannot update event start date after event has started, cannot update event end date after event has ended. Also subject to global registration deadline check.

### DELETE `/api/event-years/:event_year`
- **Access**: Admin
- **Description**: Delete event year (only if no data exists and not active)
- **Auth**: `authenticateToken`, `requireAdmin`, `requireRegistrationPeriod`
- **Date Validation**: **Registration Period** - Current date must be within `registration_dates.start` and `registration_dates.end`. Cannot delete active event year (based on dates). Also subject to global registration deadline check.

---

## Points Table Routes (`/api`)

### GET `/api/points-table/:sport`
- **Access**: Authenticated (Admin, Coordinator, Captain, Player)
- **Description**: Get points table for a specific sport (sorted by points descending)
- **Auth**: `authenticateToken`
- **Date Validation**: None (GET requests are exempt from registration deadline check, and points-table endpoints are exempt from global deadline check)

### POST `/api/points-table/backfill/:sport`
- **Access**: Admin
- **Description**: Backfill points table for a specific sport
- **Auth**: `authenticateToken`, `requireAdmin`, `requireEventStatusUpdatePeriod`
- **Date Validation**: **Event Status Update Period** - Current date must be between `event_dates.start` and `event_dates.end`. Exempt from global registration deadline check.

---

## Summary by Role

### Public (No Authentication)
- POST `/api/login`
- GET `/api/sports`
- GET `/api/sports/:name`
- GET `/api/departments/active`
- GET `/api/event-years/active`
- POST `/api/save-player` (during registration period)

### Authenticated (Any Logged-in User)
- GET `/api/me`
- GET `/api/players`
- GET `/api/sports-counts`
- GET `/api/teams/:sport`
- POST `/api/validate-participations`
- GET `/api/participants-count/:sport`
- POST `/api/update-participation`
- GET `/api/event-schedule/:sport`
- GET `/api/points-table/:sport`
- GET `/api/departments`
- POST `/api/update-team-participation` (captains can create teams for assigned sports)

### Admin Only
- PUT `/api/update-player`
- POST `/api/bulk-player-enrollments`
- GET `/api/player-enrollments/:reg_number`
- DELETE `/api/delete-player/:reg_number`
- POST `/api/bulk-delete-players`
- POST `/api/sports`
- PUT `/api/sports/:id`
- DELETE `/api/sports/:id`
- POST `/api/add-captain`
- DELETE `/api/remove-captain`
- GET `/api/captains-by-sport`
- POST `/api/add-coordinator`
- DELETE `/api/remove-coordinator`
- GET `/api/coordinators-by-sport`
- POST `/api/add-batch`
- DELETE `/api/remove-batch`
- GET `/api/batches`
- DELETE `/api/remove-participation`
- GET `/api/export-excel`
- POST `/api/departments`
- PUT `/api/departments/:id`
- DELETE `/api/departments/:id`
- GET `/api/event-years`
- POST `/api/event-years`
- PUT `/api/event-years/:event_year`
- DELETE `/api/event-years/:event_year`
- POST `/api/points-table/backfill/:sport`

### Admin or Coordinator (for assigned sports)
- POST `/api/update-team-player`
- DELETE `/api/delete-team`
- GET `/api/participants/:sport`
- GET `/api/event-schedule/:sport/teams-players`
- POST `/api/event-schedule`
- PUT `/api/event-schedule/:id`
- DELETE `/api/event-schedule/:id`

### Captain (for assigned sports)
- POST `/api/update-team-participation` (can create teams for sports where they are captain)

---

## Total Endpoints: 47

### By Access Level:
- **Public**: 6 endpoints
- **Authenticated**: 10 endpoints
- **Admin Only**: 25 endpoints
- **Admin or Coordinator**: 6 endpoints
- **Captain**: 1 endpoint (overlaps with Authenticated)

### By HTTP Method:
- **GET**: 20 endpoints
- **POST**: 15 endpoints
- **PUT**: 4 endpoints
- **DELETE**: 8 endpoints

---

## Notes

1. **Coordinator Access**: Coordinators can perform admin operations (except editing/deleting sports) for their assigned sports only. The `requireAdminOrCoordinator` middleware checks if the user is a coordinator for the specific sport in the request.

2. **Captain Access**: Captains can create teams for sports where they are assigned as captain. This is checked in the route handler logic, not via middleware.

3. **Registration Period**: Many endpoints require the registration period to be active. This is enforced via `requireRegistrationPeriod` middleware, which checks that the current date is within `registration_dates.start` and `registration_dates.end`.

4. **Event Period**: Some endpoints (like creating/deleting matches) require the event period to be active. This is enforced via `requireEventPeriod` middleware, which checks that the current date is after `registration_dates.end` and before `event_dates.end`.

5. **Event Status Update Period**: Some endpoints (like updating match results) require the event status update period to be active. This is enforced via `requireEventStatusUpdatePeriod` middleware, which checks that the current date is between `event_dates.start` and `event_dates.end`.

6. **Global Registration Deadline Check**: Applied to all non-GET requests (except login, event-schedule, and points-table endpoints). Blocks requests after `registration_dates.end`. This is enforced via `checkRegistrationDeadline` middleware in `server.js`.

7. **Match Date Validation**: When creating matches via POST `/api/event-schedule`, the `match_date` in the request body must be within `event_dates.start` and `event_dates.end`. This is validated in the route handler.

8. **Event Year Date Validations**: When creating/updating event years, there are additional validations:
   - Registration start date and event start date cannot be in the past
   - Date relationships must be: `registration_dates.start < registration_dates.end < event_dates.start < event_dates.end`
   - Certain fields cannot be updated after the event has ended
   - Date fields have restrictions based on whether registration/event has started/ended

9. **Public Endpoints**: Some endpoints are public (no authentication) but may still be restricted by date-based middleware (e.g., registration period).

10. **GET Request Exemptions**: All GET requests are exempt from the global registration deadline check, allowing read operations at any time.
