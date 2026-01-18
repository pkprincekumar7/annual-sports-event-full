# Backend API Endpoints - Role-Based Access Control

This document lists all backend endpoints and the roles that can access them, along with date range validation requirements.

## Role Definitions

- **Public**: No authentication required
- **Authenticated**: Any logged-in user (admin, coordinator, captain, or player)
- **Admin**: Only users with admin registration number
- **Coordinator**: Users assigned as coordinators for specific sports (can manage operations for their assigned sports)
- **Captain**: Users assigned as captains for specific sports (can create teams for their assigned sports)
- **Player**: Regular authenticated users

**Note**: Coordinators can manage operations for their assigned sports only. Captains can create teams for their assigned sports only (no admin override).

## Date Range Validation Types

- **Registration Period**: Current date must be within `registration_dates.start` and `registration_dates.end`
- **Event Period**: Current date must be after `registration_dates.end` and before `event_dates.end`
- **Event Status Update Period**: Current date must be between `event_dates.start` and `event_dates.end`
- **Registration Deadline Check**: Applied globally to all non-GET requests (except login/password routes, event-schedule, points-table, event-years, and departments). Blocks requests after `registration_dates.end`
- **Match Date Validation**: Match date must be within `event_dates.start` and `event_dates.end` (validated in route handler)

## Event ID Parameter

**Important**: The backend uses `event_id` for filtering data across all event-scoped collections. The following rules apply:

1. **Mandatory Parameters**: When `event_id` is required in the request body, it must be provided.

2. **Optional Parameters**: When `event_id` is optional (defaults to active event), the request may omit it entirely.

3. **Query Parameters**: For GET/PUT/DELETE routes that accept `event_id` as a query parameter, it is optional unless explicitly stated otherwise.

**Error Messages**:
- "event_id is required"

---

## Authentication Routes (`/api`)

### POST `/api/login`
- **Access**: Public
- **Description**: User login endpoint
- **Auth**: None
- **Date Validation**: None (exempt from registration deadline check)
- **Response**: Returns JWT token, player data with computed fields (participated_in, captain_in, coordinator_in), and change_password_required flag

### POST `/api/change-password`
- **Access**: Authenticated (Admin, Coordinator, Captain, Player)
- **Description**: Change password for authenticated user
- **Auth**: `authenticateToken`
- **Date Validation**: None (password changes are always allowed)
- **Request Body**: 
  - `current_password` (required): Current password
  - `new_password` (required): New password (must be different from current password)
- **Validations**:
  - Current password must be correct
  - New password must be different from current password
  - New password cannot be empty
- **Response**: Success message, resets `change_password_required` flag

### POST `/api/reset-password`
- **Access**: Public
- **Description**: Reset password via email (no authentication required)
- **Auth**: None
- **Date Validation**: None (password reset is always allowed)
- **Request Body**: 
  - `reg_number` (required): Registration number
  - `email_id` (required): Email address registered in system
- **Validations**:
  - Email format validation
  - Email must exist in system (but response doesn't reveal if email exists for security)
- **Response**: Always returns success message (doesn't reveal if email exists)
- **Security**: Generates random 8-character password and sends via email. Sets `change_password_required` flag.

---

## Player Routes (`/api`)

### GET `/api/me`
- **Access**: Authenticated (Admin, Coordinator, Captain, Player)
- **Description**: Get current authenticated user data with computed participation fields
- **Auth**: `authenticateToken`
- **Date Validation**: None (GET requests are exempt from registration deadline check)

### GET `/api/players`
- **Access**: Authenticated (Admin, Coordinator, Captain, Player)
- **Description**: Get all players with computed participation fields, search, and pagination
- **Auth**: `authenticateToken`
- **Date Validation**: None (GET requests are exempt from registration deadline check)
- **Parameters**: 
  - Optional `event_id` query parameter (defaults to active event).
  - Optional `page` query parameter (default: 1)
  - Optional `limit` query parameter (default: 20)
  - Optional `search` query parameter (searches by reg_number or full_name)
- **Response**: Returns paginated players array with pagination metadata (currentPage, totalPages, totalCount, hasNextPage, hasPreviousPage)

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
- **Description**: Get all sports for a specific event (`event_id`)
- **Auth**: None
- **Date Validation**: None (GET requests are exempt from registration deadline check)
- **Parameters**: Optional `event_id` query parameter (defaults to active event).

### POST `/api/sports`
- **Access**: Admin
- **Description**: Create new sport
- **Auth**: `authenticateToken`, `requireAdmin`, `requireRegistrationPeriod`
- **Date Validation**: **Registration Period** - Current date must be within `registration_dates.start` and `registration_dates.end`. Also subject to global registration deadline check.
- **Parameters**: `event_id` is **required** in the request body.

### PUT `/api/sports/:id`
- **Access**: Admin
- **Description**: Update sport
- **Auth**: `authenticateToken`, `requireAdmin`, `requireRegistrationPeriod`
- **Date Validation**: **Registration Period** - Current date must be within `registration_dates.start` and `registration_dates.end`. Also subject to global registration deadline check.
- **Parameters**: Optional `event_id` query parameter (defaults to active event).

### DELETE `/api/sports/:id`
- **Access**: Admin
- **Description**: Delete sport
- **Auth**: `authenticateToken`, `requireAdmin`, `requireRegistrationPeriod`
- **Date Validation**: **Registration Period** - Current date must be within `registration_dates.start` and `registration_dates.end`. Also subject to global registration deadline check.
- **Parameters**: Optional `event_id` query parameter (defaults to active event).

### GET `/api/sports-counts`
- **Access**: Authenticated (Admin, Coordinator, Captain, Player)
- **Description**: Get sports counts (teams and participants)
- **Auth**: `authenticateToken`
- **Date Validation**: None (GET requests are exempt from registration deadline check)
- **Parameters**: Optional `event_id` query parameter (defaults to active event).

### GET `/api/sports/:name`
- **Access**: Public
- **Description**: Get sport by name
- **Auth**: None
- **Date Validation**: None (GET requests are exempt from registration deadline check)
- **Parameters**: Optional `event_id` query parameter (defaults to active event).

---

## Captain Routes (`/api`)

### POST `/api/add-captain`
- **Access**: Admin or Coordinator (assigned sport)
- **Description**: Add captain role to a player
- **Auth**: `authenticateToken`, `requireRegistrationPeriod` (role check in handler)
- **Date Validation**: **Registration Period** - Current date must be within `registration_dates.start` and `registration_dates.end`. Also subject to global registration deadline check.
- **Parameters**: `event_id` is **required** in the request body.

### DELETE `/api/remove-captain`
- **Access**: Admin or Coordinator (assigned sport)
- **Description**: Remove captain role from a player
- **Auth**: `authenticateToken`, `requireRegistrationPeriod` (role check in handler)
- **Date Validation**: **Registration Period** - Current date must be within `registration_dates.start` and `registration_dates.end`. Also subject to global registration deadline check.
- **Parameters**: `event_id` is **required** in the request body.

### GET `/api/captains-by-sport`
- **Access**: Admin or Coordinator (assigned sports only)
- **Description**: Get all captains grouped by sport
- **Auth**: `authenticateToken` (role/scoping handled in handler)
- **Date Validation**: None (GET requests are exempt from registration deadline check)
- **Parameters**: Optional `event_id` query parameter (defaults to active event).

---

## Coordinator Routes (`/api`)

### POST `/api/add-coordinator`
- **Access**: Admin
- **Description**: Add coordinator role to a player
- **Auth**: `authenticateToken`, `requireAdmin`, `requireRegistrationPeriod`
- **Date Validation**: **Registration Period** - Current date must be within `registration_dates.start` and `registration_dates.end`. Also subject to global registration deadline check.
- **Parameters**: `event_id` is **required** in the request body.

### DELETE `/api/remove-coordinator`
- **Access**: Admin
- **Description**: Remove coordinator role from a player
- **Auth**: `authenticateToken`, `requireAdmin`, `requireRegistrationPeriod`
- **Date Validation**: **Registration Period** - Current date must be within `registration_dates.start` and `registration_dates.end`. Also subject to global registration deadline check.
- **Parameters**: `event_id` is **required** in the request body.

### GET `/api/coordinators-by-sport`
- **Access**: Admin
- **Description**: Get all coordinators grouped by sport
- **Auth**: `authenticateToken`, `requireAdmin`
- **Date Validation**: None (GET requests are exempt from registration deadline check)
- **Parameters**: Optional `event_id` query parameter (defaults to active event).

---

## Batch Routes (`/api`)

### POST `/api/add-batch`
- **Access**: Admin
- **Description**: Create a new batch
- **Auth**: `authenticateToken`, `requireAdmin`, `requireRegistrationPeriod`
- **Date Validation**: **Registration Period** - Current date must be within `registration_dates.start` and `registration_dates.end`. Also subject to global registration deadline check.
- **Parameters**: `event_id` is **required** in the request body.

### DELETE `/api/remove-batch`
- **Access**: Admin
- **Description**: Delete a batch
- **Auth**: `authenticateToken`, `requireAdmin`, `requireRegistrationPeriod`
- **Date Validation**: **Registration Period** - Current date must be within `registration_dates.start` and `registration_dates.end`. Also subject to global registration deadline check.
- **Parameters**: `event_id` is **required** in the request body.

### GET `/api/batches`
- **Access**: Public
- **Description**: Get all batches for an event (`event_id`) (includes `players` array with reg numbers)
- **Auth**: None
- **Date Validation**: None (GET requests are exempt from registration deadline check)
- **Parameters**: Optional `event_id` query parameter (defaults to active event).

---

## Team Routes (`/api`)

### POST `/api/update-team-participation`
- **Access**: Captain (assigned sport only)
- **Description**: Captain creates a team
- **Auth**: `authenticateToken`, `requireRegistrationPeriod`
- **Date Validation**: **Registration Period** - Current date must be within `registration_dates.start` and `registration_dates.end`. Also subject to global registration deadline check.
- **Parameters**: `event_id` is required in the request body unless stated otherwise.
- **Note**: Captains can only create teams for sports where they are assigned as captain

### GET `/api/teams/:sport`
- **Access**: Authenticated (Admin, Coordinator, Captain, Player)
- **Description**: Get all teams for a specific sport
- **Auth**: `authenticateToken`
- **Date Validation**: None (GET requests are exempt from registration deadline check)
- **Parameters**: Optional `event_id` query parameter (defaults to active event).

### POST `/api/update-team-player`
- **Access**: Admin or Coordinator (assigned sport)
- **Description**: Update/replace a player in a team
- **Auth**: `authenticateToken`, `requireAdminOrCoordinator`, `requireRegistrationPeriod`
- **Date Validation**: **Registration Period** - Current date must be within `registration_dates.start` and `registration_dates.end`. Also subject to global registration deadline check.

### DELETE `/api/delete-team`
- **Access**: Admin or Coordinator (assigned sport)
- **Description**: Delete a team
- **Auth**: `authenticateToken`, `requireAdminOrCoordinator`, `requireRegistrationPeriod`
- **Date Validation**: **Registration Period** - Current date must be within `registration_dates.start` and `registration_dates.end`. Also subject to global registration deadline check.
- **Parameters**: `event_id` is required in the request body unless stated otherwise.

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
- **Parameters**: Optional `event_id` query parameter (defaults to active event).

### GET `/api/participants-count/:sport`
- **Access**: Authenticated (Admin, Coordinator, Captain, Player)
- **Description**: Get total participants count for a specific sport
- **Auth**: `authenticateToken`
- **Date Validation**: None (GET requests are exempt from registration deadline check)

### POST `/api/update-participation`
- **Access**: Authenticated (self); Admin/Coordinator (assigned sport) for other users
- **Description**: Update individual/cultural event participation
- **Auth**: `authenticateToken`, `requireRegistrationPeriod`
- **Date Validation**: **Registration Period** - Current date must be within `registration_dates.start` and `registration_dates.end`. Also subject to global registration deadline check.
- **Parameters**: `event_id` is required in the request body unless stated otherwise.

### DELETE `/api/remove-participation`
- **Access**: Admin or Coordinator (assigned sport)
- **Description**: Remove participation (team or individual)
- **Auth**: `authenticateToken`, `requireRegistrationPeriod` (role check in handler)
- **Date Validation**: **Registration Period** - Current date must be within `registration_dates.start` and `registration_dates.end`. Also subject to global registration deadline check.
- **Parameters**: `event_id` is required in the request body unless stated otherwise.

---

## Event Schedule Routes (`/api`)

### GET `/api/event-schedule/:sport`
- **Access**: Authenticated (Admin, Coordinator, Captain, Player)
- **Description**: Get all matches for a sport
- **Auth**: `authenticateToken`
- **Date Validation**: None (GET requests are exempt from registration deadline check, and event-schedule endpoints are exempt from global deadline check)
- **Parameters**: Optional `event_id` query parameter (defaults to active event).

### GET `/api/event-schedule/:sport/teams-players`
- **Access**: Admin, Coordinator (for assigned sports)
- **Description**: Get teams/players list for a sport (for dropdown in form)
- **Auth**: `authenticateToken`, `requireAdminOrCoordinator`
- **Date Validation**: None (GET requests are exempt from registration deadline check, and event-schedule endpoints are exempt from global deadline check)

### POST `/api/event-schedule`
- **Access**: Admin or Coordinator (assigned sport)
- **Description**: Create a new match
- **Auth**: `authenticateToken`, `requireAdminOrCoordinator`, `requireEventPeriod`
- **Date Validation**: **Event Period** - Current date must be after `registration_dates.end` and before `event_dates.end`. **Match Date Validation** - The `match_date` in the request body must be within `event_dates.start` and `event_dates.end`. Exempt from global registration deadline check.
- **Parameters**: `event_id` is required in the request body unless stated otherwise.

### PUT `/api/event-schedule/:id`
- **Access**: Admin or Coordinator (assigned sport)
- **Description**: Update match result (status, winner, qualifiers, match_date)
- **Auth**: `authenticateToken`, `requireAdminOrCoordinator`, `requireEventStatusUpdatePeriod`
- **Date Validation**: **Event Status Update Period** - Current date must be between `event_dates.start` and `event_dates.end`. Exempt from global registration deadline check.

### DELETE `/api/event-schedule/:id`
- **Access**: Admin or Coordinator (assigned sport)
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
- **Parameters**: Optional `event_id` query parameter (defaults to active event).

---

## Department Routes (`/api/departments`)

### GET `/api/departments`
- **Access**: Public
- **Description**: Get all departments (sorted by display_order). Departments are not year-dependent, so there's no "active" concept.
- **Auth**: None
- **Date Validation**: None (GET requests are exempt from registration deadline check)

### POST `/api/departments`
- **Access**: Admin
- **Description**: Create new department
- **Auth**: `authenticateToken`, `requireAdmin`
 - **Date Validation**: None (departments are exempt from global registration deadline check)

### PUT `/api/departments/:id`
- **Access**: Admin
- **Description**: Update department (only display_order can be updated)
- **Auth**: `authenticateToken`, `requireAdmin`
 - **Date Validation**: None (departments are exempt from global registration deadline check)

### DELETE `/api/departments/:id`
- **Access**: Admin
- **Description**: Delete department (only if no players have this department)
- **Auth**: `authenticateToken`, `requireAdmin`
 - **Date Validation**: None (departments are exempt from global registration deadline check)

---

## Event Year Routes (`/api/event-years`)

### GET `/api/event-years`
- **Access**: Authenticated (Admin, Coordinator, Captain, Player)
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
- **Auth**: `authenticateToken`, `requireAdmin`
- **Date Validation**: None (event year creation is allowed even when no active event year exists to enable initial setup). Validates that `registration_dates.start` and `event_dates.start` are not in the past.
- **Request Body**: 
  - `event_year` (required): Year number
  - `event_name` (required): Event name (stored in lowercase; `event_id` is derived from `event_year` + `event_name`)
  - `event_dates.start` and `event_dates.end` (required)
  - `registration_dates.start` and `registration_dates.end` (required)
  - `event_organizer`, `event_title`, `event_highlight` (optional)
- **Validations**: 
  - Event year and event name combination must be unique
  - Date relationships: `registration_dates.start < registration_dates.end < event_dates.start < event_dates.end`
  - Registration start and event start cannot be in the past

### PUT `/api/event-years/:event_id`
- **Access**: Admin
- **Description**: Update event year configuration
- **Auth**: `authenticateToken`, `requireAdmin`
- **Date Validation**: Updates are allowed until registration end date. Cannot update after registration period has ended. Has additional restrictions: cannot update certain fields after event ends, cannot update registration start date after registration has started, cannot update registration end date after registration has ended, cannot update event start date after event has started, cannot update event end date after event has ended.
- **Request Body**: Can update `event_name`, `event_dates`, `registration_dates`, `event_organizer`, `event_title`, `event_highlight`. Cannot update `event_year` (year field is immutable). Updating `event_name` regenerates `event_id`.

### DELETE `/api/event-years/:event_id`
- **Access**: Admin
- **Description**: Delete event year (only if no data exists and not active)
- **Auth**: `authenticateToken`, `requireAdmin`
- **Date Validation**: Can only delete before registration start date. Cannot delete once registration period has started. Cannot delete active event year (based on dates). Cannot delete if any data exists (sports, schedules, points entries).

---

## Points Table Routes (`/api`)

### GET `/api/points-table/:sport`
- **Access**: Authenticated (Admin, Coordinator, Captain, Player)
- **Description**: Get points table for a specific sport (sorted by points descending)
- **Auth**: `authenticateToken`
- **Date Validation**: None (GET requests are exempt from registration deadline check, and points-table endpoints are exempt from global deadline check)
- **Parameters**: 
  - Optional `event_id` query parameter (defaults to active event).
  - Required `gender` query parameter: Must be "Male" or "Female"
- **Note**: Only available for dual_team and dual_player sports. Returns empty array for multi_team and multi_player sports.

### POST `/api/points-table/backfill/:sport`
- **Access**: Admin or Coordinator (assigned sport)
- **Description**: Backfill points table for a specific sport
- **Auth**: `authenticateToken` (role check performed in handler)
- **Date Validation**: None (explicitly allowed anytime; exempt from global registration deadline check)
- **Parameters**: Optional `event_id` query parameter (defaults to active event).

---

## Summary by Role

### Public (No Authentication)
- POST `/api/login`
- POST `/api/reset-password`
- GET `/api/sports`
- GET `/api/sports/:name`
- GET `/api/batches`
- GET `/api/departments`
- GET `/api/event-years/active`
- POST `/api/save-player` (during registration period)

### Authenticated (Any Logged-in User)
- POST `/api/change-password`
- GET `/api/me`
- GET `/api/players`
- GET `/api/event-years`
- GET `/api/sports-counts`
- GET `/api/teams/:sport`
- POST `/api/validate-participations`
- GET `/api/participants-count/:sport`
- GET `/api/event-schedule/:sport`
- GET `/api/points-table/:sport`
- POST `/api/update-team-participation` (captains only, assigned sports)

### Admin Only
- PUT `/api/update-player`
- POST `/api/bulk-player-enrollments`
- GET `/api/player-enrollments/:reg_number`
- DELETE `/api/delete-player/:reg_number`
- POST `/api/bulk-delete-players`
- POST `/api/sports`
- PUT `/api/sports/:id`
- DELETE `/api/sports/:id`
- GET `/api/coordinators-by-sport`
- POST `/api/add-coordinator`
- DELETE `/api/remove-coordinator`
- POST `/api/add-batch`
- DELETE `/api/remove-batch`
- GET `/api/export-excel`
- POST `/api/departments`
- PUT `/api/departments/:id`
- DELETE `/api/departments/:id`
- POST `/api/event-years`
- PUT `/api/event-years/:event_id`
- DELETE `/api/event-years/:event_id`

### Admin or Coordinator (for assigned sports)
- POST `/api/update-team-player`
- DELETE `/api/delete-team`
- GET `/api/participants/:sport`
- GET `/api/event-schedule/:sport/teams-players`
- POST `/api/update-participation`
- DELETE `/api/remove-participation`
- POST `/api/add-captain`
- DELETE `/api/remove-captain`
- GET `/api/captains-by-sport`
- POST `/api/points-table/backfill/:sport`
- POST `/api/event-schedule`
- PUT `/api/event-schedule/:id`
- DELETE `/api/event-schedule/:id`

### Captain (for assigned sports)
- POST `/api/update-team-participation` (can create teams for sports where they are captain)

---

## Summary Notes

- Role lists above reflect the current route guards and handler checks.
- Numeric counts are intentionally omitted to avoid drift as endpoints evolve.

---

## Notes

1. **Coordinator Access**: Coordinators can manage operations for their assigned sports only. The `requireAdminOrCoordinator` check enforces this in handlers.

2. **Captain Access**: Captains can create teams for sports where they are assigned as captain. This is checked in the route handler logic, not via middleware.

3. **Registration Period**: Many endpoints require the registration period to be active. This is enforced via `requireRegistrationPeriod` middleware, which checks that the current date is within `registration_dates.start` and `registration_dates.end`.

4. **Event Period**: Some endpoints (like creating/deleting matches) require the event period to be active. This is enforced via `requireEventPeriod` middleware, which checks that the current date is after `registration_dates.end` and before `event_dates.end`.

5. **Event Status Update Period**: Some endpoints (like updating match results) require the event status update period to be active. This is enforced via `requireEventStatusUpdatePeriod` middleware, which checks that the current date is between `event_dates.start` and `event_dates.end`.

6. **Global Registration Deadline Check**: Applied to all non-GET requests except login/password routes, event-schedule, points-table, event-years, and departments. Blocks requests after `registration_dates.end`. This is enforced via `checkRegistrationDeadline` middleware in `server.js`.

7. **Match Date Validation**: When creating matches via POST `/api/event-schedule`, the `match_date` in the request body must be within `event_dates.start` and `event_dates.end`. This is validated in the route handler.

8. **Event Year Date Validations**: When creating/updating/deleting event years, there are additional validations:
   - **Create**: Registration start date and event start date cannot be in the past. Date relationships must be: `registration_dates.start < registration_dates.end < event_dates.start < event_dates.end`. Allowed even when no active event year exists (enables initial setup).
   - **Update**: Updates allowed until registration end date. Cannot update certain fields after event ends. Date fields have restrictions based on whether registration/event has started/ended.
   - **Delete**: Can only delete before registration start date. Cannot delete active event year or if data exists.

9. **Password Management**: 
   - **Change Password**: Requires authentication. Validates current password, new password must be different and at least 6 characters. Resets `change_password_required` flag.
   - **Reset Password**: Public endpoint. Generates random 8-character password and sends via email. Sets `change_password_required` flag. Response doesn't reveal if email exists for security.

10. **Event Filtering**: All event-scoped operations use `event_id` for data isolation. When `event_id` is required, it must be provided. When optional, it defaults to the active event.

11. **Public Endpoints**: Some endpoints are public (no authentication) but may still be restricted by date-based middleware (e.g., registration period).

12. **GET Request Exemptions**: All GET requests are exempt from the global registration deadline check, allowing read operations at any time.

13. **Coordinator Permissions**: Coordinators can perform admin operations (except editing/deleting sports) for their assigned sports only. They can manage teams, participants, matches, and points table for their assigned sports.

14. **Batch Management**: Players are organized by batches (year field removed from player registration). Batches are created per event (`event_id`).

15. **Player Search and Pagination**: GET `/api/players` supports server-side search (by reg_number, full_name, email_id, department_branch) and pagination (page, limit parameters).

