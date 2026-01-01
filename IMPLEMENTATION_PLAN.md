# Implementation Plan: Sports Collection & Multi-Team/Multi-Player Support

## Overview
This document outlines the plan to implement a dynamic Sports collection, support new sport types (dual_team, multi_team, dual_player, multi_player), and add support for multi-team and multi-player matches. This is a fresh implementation with a new database, so no backward compatibility or migration is needed.

## ✅ **Multi-Year Event Support - INTEGRATED**

**Multi-year support is fully integrated into this implementation plan.** The system will support organizing events for multiple years in a single database. Key features:
- `event_year` field added to Sport, EventSchedule, and PointsTable models
- EventYear model for managing year configurations
- Year-based filtering in all queries
- Admin can create/manage multiple years
- Players remain year-agnostic (can participate across years)
- Historical data preserved

## ✅ **Dynamic Department Management - INTEGRATED**

**Department/Branch management is now dynamic.** Departments are stored in a separate collection and can be managed by admin through UI. Key features:
- Department model for managing departments dynamically
- Admin can create, update, and deactivate departments
- Departments are institutional (not year-specific)
- Validation uses Department collection instead of hardcoded arrays
- Frontend fetches departments from API

**Clarifications (Resolved):**
- ✅ Fresh database - no migration needed
- ✅ Admin creates all sports manually through UI
- ✅ Admin sets sport type when creating sports
- ✅ Team size validation: `team_size` field added to Sport model, validated during team creation (frontend and backend)
- ✅ Frontend constants: Remove immediately (no backward compatibility)
- ✅ Caching: 5-10 second TTL, invalidate on Sports collection updates
- ✅ **Year of Admission:** Player model uses `year_of_admission` field (numeric year, e.g., 2025, 2024, 2023, 2022, 2021, etc.) instead of `year` field with formatted strings. Display format "1st Year (2025)" is computed from `year_of_admission` but not stored in database. **Event participation is restricted to 1st to 5th year students only** (based on calculation: currentYear - yearOfAdmission = 1 to 5).

## Current State Analysis

### Current Architecture
1. **Sports**: Hardcoded in frontend (`SportsSection.jsx`) and backend (`server.js`)
2. **EventSchedule Model**: 
   - Uses `sport_type` enum: `['team', 'individual', 'cultural']`
   - Uses `team_one`, `team_two` for team events
   - Uses `player_one`, `player_two` for individual events
3. **Player Model**: 
   - Stores `participated_in` array (with sport and team_name)
   - Stores `captain_in` array (sport names)
4. **No Sports Collection**: Sports are just string values

### Target State
1. **Sports Collection**: Dynamic sports stored in database with year support
2. **EventSchedule Model**: 
   - Support `teams` array (for multi_team)
   - Support `players` array (for multi_player)
   - Update `sport_type` to use Sports collection's `type` field
   - Add `event_year` field for multi-year support
3. **Player Model**: 
   - Remove `participated_in` and `captain_in` from storage
   - Compute these fields dynamically from Sports collection in API responses (filtered by year)
4. **EventYear Model**: New model to manage event configurations per year
5. **Frontend**: Fetch sports dynamically from API instead of hardcoded data, with year context

---

## Implementation Plan

### Phase 0: Create EventYear Model & Year Management

#### 0.0 Create Department Model & Management (NEW)

**Rationale:** Departments should be managed dynamically rather than hardcoded. This allows admin to add/remove departments without code changes.

#### 0.0.1 Create Department Model (`models/Department.js`)
```javascript
{
  name: String (required, unique, e.g., "CSE", "CSE (AI)", "ECE")
  code: String (optional, short code like "CSE", "ECE" for display)
  is_active: Boolean (default: true) // For soft deletion
  display_order: Number (default: 0) // For sorting in dropdowns
  created_by: String (admin reg_number)
  createdAt: Date (auto)
  updatedAt: Date (auto)
}
```

**Key Points:**
- `name` is unique - each department has one entry
- `is_active` allows soft deletion (deactivate instead of delete)
- `display_order` allows custom sorting in UI dropdowns
- Departments are institutional (not year-specific) - same departments apply to all years
- Add indexes: `{ name: 1 }` (unique), `{ is_active: 1, display_order: 1 }` (for efficient queries)

#### 0.0.2 Department Management APIs
- `GET /api/departments` - Get all departments (public or authenticated)
  - Filter by `is_active: true` by default (or include inactive if admin)
  - Sort by `display_order` ascending
  - **Caching:** Cache with 5-10 second TTL (frontend and backend)
  - **Cache Invalidation:** Clear cache on POST, PUT, DELETE operations
- `GET /api/departments/active` - Get only active departments (public, for dropdowns)
  - Sort by `display_order` ascending
  - **Caching:** Cache with 5-10 second TTL (frontend and backend)
  - **Cache Invalidation:** Clear cache on POST, PUT, DELETE operations
- `POST /api/departments` - Create new department (admin only)
  - **Validation:** Department name must be unique
  - **Cache Invalidation:** Clear department cache after creation
- `PUT /api/departments/:id` - Update department (admin only)
  - **Restriction:** Only `is_active` and `display_order` fields can be updated
  - **Validation:** Reject update if trying to modify `name` or `code` (these are immutable)
  - **Cache Invalidation:** Clear department cache after update
- `DELETE /api/departments/:id` - Delete department (admin only)
  - **Validation:** Check if any players have this department (query Player collection)
  - **If players exist:** Reject deletion with error message: "Cannot delete department. [X] player(s) are registered with this department."
  - **If no players:** Allow hard delete
  - **Cache Invalidation:** Clear department cache after deletion

**Note:** Departments are institutional and don't need `event_year` field. They apply to all years.

#### 0.1 Create EventYear Model (`models/EventYear.js`)
```javascript
{
  year: Number (required, unique, e.g., 2026, 2027)
  event_name: String (required, e.g., "UMANG – 2026")
  event_dates: {
    start: Date (required)
    end: Date (required)
  }
  registration_dates: {
    start: Date (required)
    end: Date (required)
  }
  is_active: Boolean (default: false) // Only one year can be active at a time
  created_by: String (admin reg_number)
  createdAt: Date (auto)
  updatedAt: Date (auto)
}
```

**Key Points:**
- `year` is unique - each year has one configuration
- `is_active` ensures only one year is active at a time
- Admin can create/manage multiple years
- Frontend fetches active year configuration for event info
- Add indexes: `{ year: 1 }` (unique), `{ is_active: 1 }`

#### 0.2 EventYear Management APIs
- `GET /api/event-years` - Get all event years (admin only)
- `GET /api/event-years/active` - Get currently active year (public)
- `POST /api/event-years` - Create new event year (admin only)
- `PUT /api/event-years/:year` - Update event year configuration (admin only)
- `PUT /api/event-years/:year/activate` - Set year as active (admin only, deactivates others)
- `DELETE /api/event-years/:year` - Delete event year (admin only, only if no data exists)

---

### Phase 1: Create Sports Model & Collection

#### 1.1 Create Sports Model (`models/Sport.js`)
```javascript
{
  name: String (required, lowercase before save)
  event_year: Number (required, e.g., 2026, 2027)
  type: String (required, enum: ['dual_team', 'multi_team', 'dual_player', 'multi_player'])
  category: String (required, enum: ['team events', 'individual events', 'literary and cultural activities'])
  team_size: Number (optional, only for dual_team and multi_team types)
  eligible_captains: [String] (player reg_numbers - players eligible to be captains for this sport)
  teams_participated: [{
    team_name: String,
    captain: String (player reg_number),
    players: [String] // player reg_numbers - all players in the team
  }] (populated for dual_team and multi_team)
  players_participated: [String] (player reg_numbers, populated for dual_player and multi_player)
  createdAt: Date (auto)
  updatedAt: Date (auto)
}
```

**Key Points:**
- `name` should be stored in lowercase for consistency
- `event_year` is required - sports are year-specific
- `type` is set by admin when creating sport through UI
- `team_size` is optional and only applicable for `dual_team` and `multi_team` types
- `team_size` must be validated when creating teams (both frontend and backend)
- UI will show `team_size` number of input dropdowns for team member selection
- `eligible_captains` array tracks players who are assigned as captains by admin (before teams are created)
- `eligible_captains` is used to validate team creation (only eligible captains can create teams)
- `teams_participated` only populated for `dual_team` and `multi_team` types
- `teams_participated[].players` array contains all player reg_numbers in that team
- `teams_participated[].players.length` must equal `team_size` if `team_size` is set
- `teams_participated[].captain` must be in `eligible_captains` array
- `players_participated` only populated for `dual_player` and `multi_player` types
- **Indexes:**
  - `{ name: 1, event_year: 1 }` (compound unique - unique sport name per year)
  - `{ event_year: 1, type: 1 }` (for efficient year + type queries)
  - `{ event_year: 1, category: 1 }` (for efficient year + category queries)

---

### Phase 2: Update EventSchedule Model

#### 2.1 Schema Changes
**Current:**
```javascript
{
  sport_type: enum['team', 'individual', 'cultural']
  team_one: String
  team_two: String
  player_one: Object { name, reg_number }
  player_two: Object { name, reg_number }
}
```

**New Schema:**
```javascript
{
  event_year: Number (required, e.g., 2026, 2027)
  match_number: Number (required)
  match_type: String (required, enum: ['league', 'knockout', 'final'])
  sports_name: String (required) // Reference to Sport.name
  teams: [String] // Array of team names (for dual_team and multi_team)
  players: [String] // Array of player reg_numbers (for dual_player and multi_player)
  match_date: Date (required)
  winner: String // For dual_team/dual_player: single winner (team_name or player reg_number)
  qualifiers: [{ // For multi_team/multi_player: multiple qualifiers with positions
    participant: String, // team_name or player reg_number
    position: Number // 1st, 2nd, 3rd, etc.
  }]
  status: String (enum: ['completed', 'draw', 'cancelled', 'scheduled'], default: 'scheduled')
  createdAt: Date (auto)
  updatedAt: Date (auto)
}
```

**Key Points:**
- `event_year` is required - matches are year-specific
- `sports_name` references the Sport document's name field (same year)
- `teams` array used for `dual_team` and `multi_team` sport types
- `players` array used for `dual_player` and `multi_player` sport types
- `winner` field used for `dual_team` and `dual_player` (single winner/loser)
- `qualifiers` array used for `multi_team` and `multi_player` (multiple positions: 1st, 2nd, 3rd, etc.)
- Only one of `winner` or `qualifiers` should be populated based on sport type
- **Indexes:**
  - `{ event_year: 1, sports_name: 1, match_number: 1 }` (compound unique - unique match numbers per sport per year)
  - `{ event_year: 1, sports_name: 1 }` (for efficient year + sport queries)
  - `{ event_year: 1, sports_name: 1, status: 1 }` (for efficient year + sport + status queries)

#### 2.2 Validation Logic
- For `dual_team`: Validate `teams.length === 2`
- For `multi_team`: Validate `teams.length > 2` (strictly greater than 2)
- For `dual_player`: Validate `players.length === 2`
- For `multi_player`: Validate `players.length > 2` (strictly greater than 2)
- Validate teams/players exist in Sports collection's `teams_participated`/`players_participated`
- Validate all teams/players in arrays are unique (no duplicates)
- **League Match Restrictions:**
  - `match_type: 'league'` is **only applicable for `dual_team` and `dual_player`** sports
  - `match_type: 'league'` is **NOT allowed for `multi_team` and `multi_player`** sports
  - If any knockout match (status: 'scheduled', 'completed', 'draw', or 'cancelled') exists for a sport, **no league matches can be scheduled** for that sport
  - If scheduling a knockout match, validate that its `match_date` is **greater than all existing league matches' dates** for that sport
- **Knockout Match Restrictions:**
  - If any league match exists for a sport, knockout matches can only be scheduled with dates **after all league matches**
- For `dual_team`/`dual_player`: 
  - Validate `winner` is set when status is 'completed', `qualifiers` should be empty
  - If exactly 2 eligible participants are available to select for the match, `match_type` MUST be 'final' (enforce in backend)
- For `multi_team`/`multi_player`: 
  - Validate `qualifiers` array is set when status is 'completed', `winner` should be empty
  - If all eligible participants are in the match, `match_type` can be 'final' (optional, admin decides)
  - `match_type: 'league'` is **NOT allowed** (only 'knockout' or 'final' allowed)
- Validate `qualifiers` positions are unique and sequential (1, 2, 3, etc.)
- Validate `match_type: 'final'` can be rescheduled if status is 'draw' or 'cancelled'

#### 2.3 Match Type 'final' Behavior

**For dual_team and dual_player sports:**
- `match_type: 'final'` MUST be set when exactly 2 eligible teams/players remain (all others knocked out)
- These sports have one winner and one loser
- If exactly 2 eligible participants are in the match, it MUST be 'final' because after the match, one will win and one will lose (be knocked out), leaving no participants for another match
- Once a match is marked as 'final' and status is 'completed', no further matches can be scheduled for that sport
- Exception: If `match_type` is 'final' but status is 'draw' or 'cancelled', the match can be rescheduled

**For multi_team and multi_player sports:**
- `match_type: 'final'` can be set when all remaining eligible teams/players are participating in the match (all others knocked out)
- Setting 'final' is **optional** - admin decides if this is the last match
- If all eligible participants are in the match but `match_type` is 'knockout' (not 'final'), admin can schedule another final match after completion
- If `match_type` is 'final' and status is 'completed', no further matches can be scheduled for that sport
- These sports support multiple qualifiers (1st, 2nd, 3rd, etc.) - not just winner/loser
- **`match_type: 'league'` is NOT allowed for multi_team and multi_player** (only 'knockout' or 'final' allowed)

**General Rules:**
- `match_type: 'final'` indicates this is the last match for the sport
- Once a 'final' match is completed, the sport's tournament is finished
- For dual_team/dual_player: If exactly 2 eligible participants remain, 'final' is mandatory (not optional)
- For multi_team/multi_player: Admin has discretion to set 'final' when all eligible participants are in the match
- If 'final' match status is 'draw' or 'cancelled', admin can reschedule it
- UI should only show 'final' option in dropdown when applicable based on these rules
- Backend must validate that 'final' is set correctly based on number of eligible participants

---

### Phase 2.5: Create Points Table Model & Collection

#### 2.5.1 Create Points Table Model (`models/PointsTable.js`)
```javascript
{
  event_year: Number (required, e.g., 2026, 2027)
  sports_name: String (required) // Reference to Sport.name
  participant: String (required) // team_name (for team sports) or player reg_number (for individual sports)
  participant_type: String (required, enum: ['team', 'player'])
  points: Number (required, default: 0)
  matches_played: Number (required, default: 0)
  matches_won: Number (required, default: 0)
  matches_lost: Number (required, default: 0)
  matches_draw: Number (required, default: 0)
  matches_cancelled: Number (required, default: 0)
  createdAt: Date (auto)
  updatedAt: Date (auto)
}
```

**Key Points:**
- `event_year` is required - points are year-specific
- Points are only tracked for **league matches** (not for knockout or final matches)
- League matches are **only applicable for `dual_team` and `dual_player`** sports
- Points table is not applicable for `multi_team` and `multi_player` sports (they don't have league matches)
- Point calculation rules:
  - **Winner**: 2 points
  - **Loser**: 0 points
  - **Draw**: 1 point each participant
  - **Cancelled**: 1 point each participant
- **Indexes:**
  - `{ event_year: 1, sports_name: 1, participant: 1 }` (compound unique - unique participant per sport per year)
  - `{ event_year: 1, sports_name: 1, points: -1 }` (for efficient sorted points table queries by year)
- `participant_type` helps distinguish between teams and players for proper display

#### 2.5.2 Points Update Logic

**When Match Result is Updated:**
- Only update points table if `match_type === 'league'`
- **Important:** Points must be adjusted (not just added) when status changes
- Track previous status to calculate correct point adjustments
- For `dual_team`/`dual_player`:
  - **If status changes to 'completed' with winner:**
    - Remove previous points (if status was 'draw' or 'cancelled': -1 point each)
    - Winner: +2 points, increment `matches_won`, decrement previous status counter if applicable
    - Loser: +0 points, increment `matches_lost`, decrement previous status counter if applicable
  - **If status changes to 'draw':**
    - Remove previous points (if status was 'completed': winner -2, loser -0)
    - Both participants: +1 point each, increment `matches_draw`, decrement previous status counter if applicable
  - **If status changes to 'cancelled':**
    - Remove previous points (if status was 'completed': winner -2, loser -0; if 'draw': -1 each)
    - Both participants: +1 point each, increment `matches_cancelled`, decrement previous status counter if applicable
  - **If status changes back to 'scheduled':**
    - Remove all points added for this match (revert to previous state)
    - Decrement all match counters that were incremented
  - **Always adjust `matches_played`:**
    - Increment when status becomes 'completed', 'draw', or 'cancelled'
    - Decrement when status reverts to 'scheduled'
- **Note:** Points update logic for `multi_team`/`multi_player` is NOT applicable since they don't have league matches

**Initialization:**
- Points table entries are created automatically when:
  - A league match is scheduled (create entries for all participants if they don't exist)
  - Or when first league match result is updated

#### 2.5.3 Usage for Knockout Match Scheduling

- Admin can view points table sorted by points (descending) to determine:
  - Top performers who qualify for knockout rounds
  - Ranking of teams/players based on league performance
- Points table helps admin make informed decisions when scheduling knockout matches
- Points table can be displayed in UI to show league standings

---

### Phase 3: Update Player Model & API Responses

#### 3.1 Update Player Schema
- Remove `participated_in` and `captain_in` from Player schema
- These will be computed dynamically from Sports collection
- **Update `department_branch` field:**
  - Remove enum restriction (currently: `['CSE', 'CSE (AI)', 'ECE', 'EE', 'CE', 'ME', 'MTE']`)
  - Change to String type (no enum)
  - Validate against Department collection instead of hardcoded array
  - Store department name (must exist in Department collection and be active)

#### 3.2 Compute Fields in API Responses
Create a helper function to compute `participated_in` and `captain_in` from Sports collection:

```javascript
async function computePlayerParticipation(playerRegNumber, eventYear = null) {
  // If eventYear not provided, use active year
  if (!eventYear) {
    const activeYear = await EventYear.findOne({ is_active: true }).lean()
    eventYear = activeYear ? activeYear.year : new Date().getFullYear()
  }
  
  // Find all sports where player is:
  // 1. An eligible captain (in eligible_captains array)
  // 2. A team captain (in teams_participated[].captain)
  // 3. A team member (in teams_participated[].players)
  // 4. An individual participant (in players_participated)
  // Filter by event_year
  const sports = await Sport.find({
    event_year: eventYear,
    $or: [
      { 'eligible_captains': playerRegNumber },
      { 'teams_participated.captain': playerRegNumber },
      { 'teams_participated.players': playerRegNumber },
      { 'players_participated': playerRegNumber }
    ]
  }).lean()
  
  const participated_in = []
  const captain_in = []
  
  sports.forEach(sport => {
    // Check if eligible captain (assigned by admin, may or may not have created team yet)
    const isEligibleCaptain = sport.eligible_captains && sport.eligible_captains.includes(playerRegNumber)
    
    // Check if team captain (has created a team)
    const captainTeam = sport.teams_participated.find(
      team => team.captain === playerRegNumber
    )
    
    if (captainTeam) {
      // Player is captain of an existing team
      captain_in.push(sport.name)
      participated_in.push({
        sport: sport.name,
        team_name: captainTeam.team_name
      })
    } else if (isEligibleCaptain) {
      // Player is eligible captain but hasn't created team yet
      captain_in.push(sport.name)
      // No participation entry yet (team not created)
    } else {
      // Check if team member (but not captain)
      const teamMember = sport.teams_participated.find(
        team => team.players && team.players.includes(playerRegNumber)
      )
      if (teamMember) {
        participated_in.push({
          sport: sport.name,
          team_name: teamMember.team_name
        })
      } else {
        // Check if individual participant
        if (sport.players_participated && sport.players_participated.includes(playerRegNumber)) {
          participated_in.push({
            sport: sport.name,
            team_name: null
          })
        }
      }
    }
  })
  
  return { participated_in, captain_in }
}
```

**Key Points:**
- `captain_in` includes both eligible captains (assigned by admin) and team captains (who created teams)
- `participated_in` only includes actual participations (teams or individual events)
- If player is eligible captain but hasn't created team, they appear in `captain_in` but not in `participated_in`
- Single query to Sports collection gets all participation data
- Efficient computation without denormalization

#### 3.2.1 Create Year Display Helper Function
```javascript
function computeYearDisplay(yearOfAdmission, currentYear = null) {
  // If currentYear not provided, use current year
  if (!currentYear) {
    currentYear = new Date().getFullYear()
  }
  
  // Calculate year difference
  const yearDifference = currentYear - yearOfAdmission
  
  // Map to display format (supports up to 5th year, but can display beyond)
  const yearLabels = {
    1: '1st Year',
    2: '2nd Year',
    3: '3rd Year',
    4: '4th Year',
    5: '5th Year'
  }
  
  const label = yearLabels[yearDifference] || `${yearDifference}th Year`
  return `${label} (${yearOfAdmission})`
}

function canParticipateInEvents(yearOfAdmission, currentYear = null) {
  // If currentYear not provided, use current year
  if (!currentYear) {
    currentYear = new Date().getFullYear()
  }
  
  // Calculate year difference
  const yearDifference = currentYear - yearOfAdmission
  
  // Only 1st to 5th year students can participate
  return yearDifference >= 1 && yearDifference <= 5
}
```

**Usage:**
- `computeYearDisplay()`: Call in all API responses that return player data
- `canParticipateInEvents()`: Use for validation before allowing registration/participation
- Add computed `year` field to player objects for backward compatibility
- Frontend can use computed `year` field for display
- Database stores only `year_of_admission` (numeric)
- **Validation:** Reject registration/participation if `canParticipateInEvents()` returns false

#### 3.3 Update All Player API Endpoints
- `GET /api/players` - Add computed fields (filtered by active year or provided year parameter)
  - **Add computed `year` field:** Compute display format "1st Year (2025)" from `year_of_admission` for backward compatibility
- `GET /api/me` - Add computed fields (filtered by active year)
  - **Add computed `year` field:** Compute display format from `year_of_admission`
- `POST /api/login` - Add computed fields to response (filtered by active year)
  - **Add computed `year` field:** Compute display format from `year_of_admission`
- `POST /api/save-player` - Update to accept `year_of_admission` instead of `year`
  - **Validation:** Validate `year_of_admission` is numeric and within reasonable range
  - **Participation Restriction:** Use `canParticipateInEvents()` to validate - only 1st to 5th year students can register
  - Reject registration if year difference < 1 or > 5
  - **Department Validation:** Validate `department_branch` exists in Department collection and is active
    - Query Department collection to verify department exists and `is_active: true`
    - Reject if department doesn't exist or is inactive
- `PUT /api/update-player` - Update to accept `year_of_admission` instead of `year`
  - **Validation:** `year_of_admission` cannot be modified (same as current `year` restriction)
  - **Department Validation:** Validate `department_branch` exists in Department collection and is active
    - Query Department collection to verify department exists and `is_active: true`
    - Reject if department doesn't exist or is inactive
- `POST /api/update-team-participation` - Validate all team members are 1st to 5th year students
  - **CRITICAL: All team members MUST have the same `year_of_admission`** (existing functionality to be retained)
  - Validate that all players in the team have identical `year_of_admission` values
  - Reject team creation if any player has a different `year_of_admission` than other team members
  - Error message: "Year mismatch: [player names] must be in the same year of admission ([year]) as other team members."
- `POST /api/update-participation` - Validate participant is 1st to 5th year student
- Any other endpoint returning player data - Include year context and computed `year` field
- **Year Parameter:** All endpoints accept optional `?year=2026` parameter (defaults to active year)
- **Helper Functions:** 
  - `computeYearDisplay(yearOfAdmission, currentYear)` - Generate "1st Year (2025)" format
  - `canParticipateInEvents(yearOfAdmission, currentYear)` - Validate participation eligibility (1st to 5th year only)

---

### Phase 4: Update Backend API Endpoints

#### 4.1 Sports Management APIs (New)
- `GET /api/sports` - Get all sports (admin only, or public for display)
  - **Year Filter:** Accepts `?year=2026` parameter (defaults to active year)
  - Filter by `event_year` in query
- `POST /api/sports` - Create new sport (admin only)
  - **Year Required:** `event_year` field required in request body
  - Validate year exists in EventYear collection
  - Default to active year if not provided
- `PUT /api/sports/:id` - Update sport (admin only)
  - **Year Context:** Update within same year (cannot change event_year)
- `DELETE /api/sports/:id` - Delete sport (admin only)
  - Validate that no matches exist for this sport in the same year (reject deletion if matches found)
  - Validate that no points table entries exist for this sport in the same year
- `GET /api/sports/:name` - Get sport by name
  - **Year Required:** Accepts `?year=2026` parameter (defaults to active year)
  - Query by `name` and `event_year`

#### 4.2 Update Existing APIs

**`GET /api/sports-counts`**
- Query Sports collection instead of hardcoded arrays
- **Year Filter:** Accepts `?year=2026` parameter (defaults to active year)
- Filter by `event_year` in query
- Group by sport type and category

**`POST /api/event-schedule`**
- **Year Required:** `event_year` field required in request body (defaults to active year)
- Validate sport exists in Sports collection for the specified year
- Get sport type from Sports collection (filtered by year)
- Validate teams/players arrays based on sport type:
  - `dual_team`: exactly 2 teams
  - `multi_team`: more than 2 teams (> 2)
  - `dual_player`: exactly 2 players
  - `multi_player`: more than 2 players (> 2)
- **Validate match_type restrictions:**
  - For `multi_team`/`multi_player`: `match_type: 'league'` is **NOT allowed** (reject request)
  - For `dual_team`/`dual_player`: All match types ('league', 'knockout', 'final') are allowed
- **Validate league vs knockout restrictions:**
  - If scheduling `match_type: 'league'`:
    - Check if any knockout match (status: 'scheduled', 'completed', 'draw', or 'cancelled') exists for this sport
    - If knockout match exists, **reject the request** (no league matches allowed after knockout)
  - If scheduling `match_type: 'knockout'` or `'final'`:
    - Check if any league match exists for this sport
    - If league matches exist, validate that `match_date` is **greater than all league match dates**
    - If `match_date` is not greater than all league matches, **reject the request**
- Validate `match_type: 'final'`:
  - For `dual_team`/`dual_player`: 
    - MUST be set when exactly 2 eligible teams/players are in the match (mandatory, not optional)
    - If exactly 2 eligible participants are in match and match_type is not 'final', reject the request
  - For `multi_team`/`multi_player`: 
    - Can be set when all eligible participants are in the match (optional, admin decides)
- Validate all teams/players exist in Sports collection's participation arrays
- Support multi_team and multi_player with proper array handling
- Prevent scheduling new matches if a 'final' match with status 'completed' exists for the sport
- Allow rescheduling if 'final' match status is 'draw' or 'cancelled'

**`PUT /api/event-schedule/:id` (Update Match Result)**
- For `dual_team`/`dual_player`: 
  - Update `winner` field (team_name or player reg_number)
  - Set loser as the other participant
  - Update status to 'completed'
- For `multi_team`/`multi_player`: 
  - Update `qualifiers` array with positions: `[{participant: String, position: Number}, ...]`
  - Validate qualifiers positions are unique and sequential (1, 2, 3, etc.)
  - All participants not in qualifiers are automatically knocked out
  - Update status to 'completed'
- **Status and Winner/Qualifiers Handling:**
  - When status is 'completed': `winner` (for dual types) or `qualifiers` (for multi types) must be set
  - When status changes to 'draw' or 'cancelled': Clear `winner` and `qualifiers` fields (no winner/qualifiers for draw/cancelled matches)
  - When status changes from 'draw'/'cancelled' to 'completed': `winner` or `qualifiers` must be set again
  - When status changes back to 'scheduled': Clear `winner` and `qualifiers` fields
- When status changes to 'completed':
  - For 'final' matches: Mark sport tournament as complete (prevent further matches)
  - For knockout matches: Mark non-qualifying/non-winning participants as knocked out
  - These knocked out participants won't appear in future match scheduling dropdowns
- **Update Points Table (only for league matches):**
  - If `match_type === 'league'`, update points for all participants:
    - **For dual_team/dual_player only** (multi types don't have league matches):
      - **If status changes to 'completed' with winner:**
        - Adjust points: Winner gets +2 points (or adjust if previously had different status)
        - Loser gets +0 points (or adjust if previously had different status)
        - Increment/decrement matches_won and matches_lost accordingly
      - **If status changes to 'draw':**
        - Adjust points: Both participants get +1 point each (or adjust if previously had different status)
        - Increment/decrement matches_draw accordingly
      - **If status changes to 'cancelled':**
        - Adjust points: Both participants get +1 point each (or adjust if previously had different status)
        - Increment/decrement matches_cancelled accordingly
      - **If status changes from 'completed'/'draw'/'cancelled' back to 'scheduled':**
        - Revert points adjustments (subtract previously added points)
        - Decrement corresponding match counters
      - Always increment matches_played when status becomes 'completed', 'draw', or 'cancelled'
      - Always decrement matches_played when status reverts to 'scheduled'
    - Create points table entries if they don't exist
- **Important:** When match status changes, points must be adjusted (not just added). For example:
  - If status changes from 'completed' (winner: +2, loser: +0) to 'draw' (both: +1), adjust points accordingly
  - Track previous status to calculate correct point adjustments
- Validate that qualifiers/winner are from the match's teams/players array

**`GET /api/event-schedule/:sport`**
- **Year Filter:** Accepts `?year=2026` parameter (defaults to active year)
- Return all matches for the sport in the specified year
- Filter by `event_year` and `sports_name`
- Include qualifiers array for multi_team/multi_player matches
- Filter out knocked out participants when determining eligible teams/players for next match

**`GET /api/event-schedule/:sport/teams-players`**
- **Year Filter:** Accepts `?year=2026` parameter (defaults to active year)
- Get teams from Sports collection's `teams_participated` (filtered by year)
- Get players from Sports collection's `players_participated` (filtered by year)
- Exclude teams/players that have been knocked out in previous matches (in the same year)
- For knockout matches: Only return participants who haven't lost any completed match (in the same year)

**`POST /api/update-team-participation`**
- **Workflow:** Captain (who was assigned via `POST /api/add-captain`) creates a team
- **Year Required:** `event_year` field required in request body (defaults to active year)
- Update Sports collection's `teams_participated` array (for the specified year)
- Find sport by `name` and `event_year`
- Add/update team with `team_name`, `captain`, and `players` array
- **Validate captain eligibility:** Ensure the logged-in user (captain) is in `Sport.eligible_captains` array
- **Validate exactly one captain:** Ensure exactly one player in the team is in `eligible_captains` array
- **Validate team size:** If sport has `team_size` set, ensure `players.length === team_size`
- **CRITICAL: Validate same year of admission:** All players in a team MUST have the same `year_of_admission` (existing functionality to be retained)
  - Check that all players have identical `year_of_admission` values
  - Reject team creation if any player has different `year_of_admission` than other team members
  - Error message: "Year mismatch: [player names] must be in the same year of admission ([year]) as other team members."
- Set `teams_participated[].captain` to the captain's reg_number (must be in `eligible_captains`)
- Ensure captain is in the `players` array
- Ensure all players in `players` array are valid player reg_numbers

**`POST /api/update-participation`**
- **Year Required:** `event_year` field required in request body (defaults to active year)
- Update Sports collection's `players_participated` array (for the specified year)
- Find sport by `name` and `event_year`
- Add/remove player reg_numbers for individual/cultural events

**`POST /api/add-captain`**
- **Workflow:** Admin assigns a player as captain for a sport (makes player eligible to create a team)
- **Year Required:** `event_year` field required in request body (defaults to active year)
- Update Sports collection's `eligible_captains` array (add player reg_number for the specified year)
- Find sport by `name` and `event_year`
- **Important:** This does NOT create a team - it only makes the player eligible to be a captain
- Validate player exists and is not already in `eligible_captains` array
- After captain assignment, the player can then create a team via `POST /api/update-team-participation`
- When team is created, the captain from `eligible_captains` is set as `teams_participated[].captain`

**`GET /api/teams/:sport`**
- **Year Filter:** Accepts `?year=2026` parameter (defaults to active year)
- Query Sports collection instead of Player collection
- Find sport by `name` and `event_year`
- Return teams from Sport document's `teams_participated` array

**`POST /api/update-team-player`**
- **Year Filter:** Accepts `?year=2026` parameter (defaults to active year)
- Replace a player in an existing team (admin only)
- Update Sports collection's `teams_participated[].players` array (for the specified year)
- Find sport by `name` and `event_year`
- **Validate:** New player must have same gender as other team members
- **CRITICAL: Validate same year of admission:** New player MUST have the same `year_of_admission` as existing team members (existing functionality to be retained)
  - Check that new player's `year_of_admission` matches all existing team members' `year_of_admission`
  - Reject replacement if year mismatch
  - Error message: "Year mismatch: New player must be in the same year of admission ([year]) as other team members."

**`GET /api/participants/:sport`**
- **Year Filter:** Accepts `?year=2026` parameter (defaults to active year)
- Query Sports collection's `players_participated` array (filtered by year)
- Find sport by `name` and `event_year`

**`GET /api/export-excel`**
- **Year Filter:** Accepts `?year=2026` parameter (defaults to active year)
- Query Sports collection to get all sports dynamically (filtered by year)
- Compute participation from Sports collection (filtered by year)
- **Year Display:** Use `computeYearDisplay()` helper to generate "1st Year (2025)" format from `year_of_admission` for Excel export

**Points Table APIs (New)**
- `GET /api/points-table/:sport` - Get points table for a specific sport (sorted by points descending)
  - **Year Filter:** Accepts `?year=2026` parameter (defaults to active year)
  - Filter by `event_year` and `sports_name`
  - Returns all participants with their points, matches played, won, lost, draw, cancelled
  - Admin can use this to determine knockout match participants
  - Only shows participants who have played at least one league match
- `GET /api/points-table/:sport/:participant` - Get points for a specific participant in a sport
  - **Year Filter:** Accepts `?year=2026` parameter (defaults to active year)
- Points table is automatically updated when league match results are updated (for the same year)
- Points table is only applicable for league matches (not knockout or final)

---

### Phase 5: Frontend Updates

#### 5.1 Remove Hardcoded Sports
- Remove `sportsData` object from `SportsSection.jsx`
- Remove hardcoded sports from `src/constants/sports.js` (entire file can be removed or cleaned)
- Fetch sports from API endpoint
- **No backward compatibility needed** - remove all hardcoded sports immediately

#### 5.2 Update SportsSection Component
- Add API call: `GET /api/sports?year={activeYear}` (public or authenticated)
- Fetch active year from `GET /api/event-years/active` first
- Group sports by `category` field
- Display sports dynamically (filtered by active year)
- Handle loading and error states

#### 5.3 Update EventScheduleModal

**Match Creation:**
- Support selecting multiple teams/players for multi_team and multi_player
- Update UI to show arrays instead of single values
- Validate based on sport type from Sports collection
- Show match_type dropdown with 'league', 'knockout', 'final' options
- **Match Type Dropdown Logic:**
  - For `dual_team`/`dual_player`: 
    - If exactly 2 eligible participants are selected: Only show 'final' option (disable other options)
    - If more than 2 eligible participants: 
      - Check if any knockout match exists for this sport
      - If knockout match exists: Only show 'knockout' and 'final' options (hide 'league')
      - If no knockout match exists: Show 'league' and 'knockout' options (hide 'final')
  - For `multi_team`/`multi_player`:
    - **Never show 'league' option** (league matches not allowed for multi types)
    - If all eligible participants are selected: Show 'knockout' and 'final' options
    - If not all eligible participants are selected: Show 'knockout' option only (hide 'final')
- **Date Validation UI:**
  - If scheduling knockout/final match and league matches exist:
    - Show warning: "Knockout match date must be after all league matches"
    - Display the latest league match date for reference
    - Validate date before allowing submission
- Backend must validate match_type selection matches these rules

**Match Result Entry (Admin Only):**

**For dual_team and dual_player:**
- Show "Winner" button for each participant
- When winner is selected:
  - Selected participant's button changes to "Winner" and disables
  - Other participant's button changes to "Loser" and disables
  - Both buttons disabled after selection
- Show "Save Result" button to finalize

**For multi_team and multi_player:**
- Show "Qualified" button for each participant
- When a participant's "Qualified" button is clicked:
  - The first participant clicked gets position "1st" (button text changes to "1st" and disables)
  - The second participant clicked gets position "2nd" (button text changes to "2nd" and disables)
  - The third participant clicked gets position "3rd" (button text changes to "3rd" and disables)
  - And so on for subsequent participants (positions assigned in order of clicks)
- Show "Freeze" button:
  - When clicked, all remaining participants (not qualified in this match) are marked as "Knocked Out"
  - Their buttons change to "Knocked Out" and disable
  - "Freeze" button disables after click
- Show "Save Result" button to finalize the match result
- Display qualifiers list showing positions (1st, 2nd, 3rd, etc.)

**Match Type 'final' Handling:**
- For dual_team/dual_player:
  - If exactly 2 eligible participants are in the match: 'final' option MUST be selected (enforce in UI and backend)
  - If match_type is 'final' and status is 'completed': Show message "This is the final match. Tournament complete." and disable scheduling new matches
  - If match_type is 'final' but status is 'draw' or 'cancelled': Allow rescheduling
- For multi_team/multi_player:
  - If all eligible participants are in the match: Show 'final' option in dropdown (optional, admin decides)
  - If match_type is 'final' and status is 'completed': Show message "This is the final match. Tournament complete." and disable scheduling new matches
  - If match_type is not 'final' but all eligible participants are in match: Show info "All eligible participants are in this match. You can schedule another final match after completion." and allow admin to change match_type to 'final' if desired
  - If match_type is 'final' but status is 'draw' or 'cancelled': Allow rescheduling

#### 5.4 Update RegisterModal
- Get sport details from Sports collection
- Handle registration for all sport types
- **Year Of Admission Field:**
  - Change dropdown/input label from "Year" to "Year Of Admission"
  - Change from formatted strings to numeric year input (e.g., 2025, 2024, 2023, 2022, 2021, etc.)
  - **Input Type:** Can be number input or dropdown with year range (e.g., 2015-2026)
  - Store `year_of_admission` (numeric) in database
  - Display format "1st Year (2025)" is computed but not stored
  - **Participation Validation:** 
    - Frontend: Validate that player is in 1st to 5th year (currentYear - yearOfAdmission = 1 to 5)
    - Show error message if year difference < 1 or > 5: "Only 1st to 5th year students can participate"
    - Backend will also validate participation eligibility
- **Team Registration:**
  - If sport has `team_size` set, show exactly `team_size` number of player selection dropdowns
  - Validate team size matches `team_size` before submission (frontend validation)
  - **Validate all team members:** Ensure all selected players are in 1st to 5th year
  - **CRITICAL: Validate same year of admission:** All selected players MUST have the same `year_of_admission` (existing functionality to be retained)
    - Frontend: Check that all selected players have identical `year_of_admission` values
    - Show error message if mismatch: "All team members must be in the same year of admission."
    - Backend will also validate same year requirement
  - Backend will also validate team size and year eligibility
- Update team/player registration logic

#### 5.5 Update SportDetailsModal
- Fetch sport details from API (include year parameter)
- Display sport information dynamically
- Use active year context

#### 5.6 Add Year Management UI (Admin Only)
- **Year Selector Component:**
  - Dropdown/selector showing available years
  - Default to active year
  - Display current active year prominently
  - Allow admin to switch between years (for viewing/managing)
- **Create New Year Modal:**
  - Form to create new event year
  - Fields: Year, Event Name, Event Dates, Registration Dates
  - Option to copy sports from previous year (optional feature)
  - Validate year doesn't already exist
- **Year Management:**
  - List all years
  - Edit year configuration
  - Activate year (switches active year)
  - Archive/delete old years (if no data exists)
- **Location:** Add to `Hero.jsx` (admin section) or create separate admin panel component

---

## Implementation Order (Recommended)

### Step 1: Create Sports Model & Basic APIs
1. Create `models/Sport.js` with full schema including:
   - `team_size` field (optional, for team sports)
   - `players` array in `teams_participated`
2. Create basic CRUD APIs for Sports (`GET`, `POST`, `PUT`, `DELETE`)
3. **Admin creates sports manually through UI** - no seed script needed
4. Admin interface must allow setting:
   - Sport `type` (dual_team, multi_team, dual_player, multi_player)
   - Sport `category` (team events, individual events, literary and cultural activities)
   - Sport `team_size` (optional, only for team sports)

### Step 2: Update Player Model
1. Remove `participated_in` and `captain_in` fields from Player schema
2. Create helper function to compute these fields from Sports collection (with year parameter)
3. Update all player API endpoints to include computed fields (filtered by active year or provided year)

### Step 3: Update Participation Logic
1. Update `POST /api/update-participation` to update Sports collection's `players_participated` (with year filtering)
2. Update `POST /api/update-team-participation` to update Sports collection's `teams_participated` (including `players` array, with year filtering)
   - **Add team size validation:** If sport has `team_size`, validate `players.length === team_size`
   - **Add year filtering:** Find sport by `name` and `event_year`
   - **CRITICAL: Retain same year validation:** All players in a team MUST have the same `year_of_admission` (existing functionality)
     - Validate that all players have identical `year_of_admission` values
     - Reject team creation if any mismatch found
     - Error message: "Year mismatch: [player names] must be in the same year of admission ([year]) as other team members."
3. Update `POST /api/update-team-player` to use Sports collection and `year_of_admission` field
   - **CRITICAL: Retain same year validation:** New player MUST have the same `year_of_admission` as existing team members (existing functionality)
     - Validate that new player's `year_of_admission` matches all existing team members' `year_of_admission`
     - Reject replacement if year mismatch
     - Error message: "Year mismatch: New player must be in the same year of admission ([year]) as other team members."
4. Update `POST /api/add-captain` to update Sports collection's `eligible_captains` (with year filtering)
4. Ensure captain is always in the team's `players` array
5. **Frontend:** Update RegisterModal to show `team_size` number of dropdowns and validate team size

### Step 4: Update EventSchedule Model
1. Update EventSchedule schema to new format:
   - Add `event_year` field (required)
   - Add `qualifiers` array for multi_team/multi_player
   - Keep `winner` for dual_team/dual_player
   - Add `match_type: 'final'` to enum
   - Change `sport` field to `sports_name` (to reference Sport.name)
   - Add compound unique index: `{ event_year: 1, sports_name: 1, match_number: 1 }` to ensure unique match numbers per sport per year
   - Add indexes: `{ event_year: 1, sports_name: 1 }`, `{ event_year: 1, sports_name: 1, status: 1 }` for efficient queries
2. Update `POST /api/event-schedule` to support:
   - Arrays for teams/players
   - Validation for multi_team (> 2) and multi_player (> 2)
   - Validation for `match_type: 'final'` based on sport type
   - Validation for league vs knockout restrictions
   - Prevent scheduling if 'final' match is already completed
3. Create `PUT /api/event-schedule/:id` endpoint:
   - Handle winner update for dual types
   - Handle qualifiers array update for multi types
   - Track knocked out participants
   - Enforce 'final' match completion rules
   - Handle status updates ('completed', 'draw', 'cancelled')
   - Note: Points table update logic will be integrated in Step 4.5
4. Update `GET /api/event-schedule/:sport/teams-players`:
   - Filter out knocked out participants
   - Only show eligible participants for next match
5. Update all EventSchedule queries to use new schema

### Step 4.5: Create Points Table Model & APIs
1. Create `models/PointsTable.js` with schema (including `event_year` field)
2. Create helper function to update points when league match results are updated (dual_team/dual_player only, for the same year)
3. Create `GET /api/points-table/:sport` endpoint to retrieve points table (sorted by points descending, filtered by year)
4. Create `GET /api/points-table/:sport/:participant` endpoint to get specific participant's points (filtered by year)
5. Integrate points update logic into `PUT /api/event-schedule/:id` endpoint (only for league matches of dual types, same year)
6. Points table entries are auto-created when league matches are scheduled or results updated (for the same year)

### Step 5: Update Frontend
1. **Create Year Context/Hook:**
   - `src/contexts/EventYearContext.jsx` or `src/hooks/useEventYear.js`
   - Fetch active year from `GET /api/event-years/active`
   - Provide year context to all components
   - Handle year switching for admin
2. **Update Event Info:**
   - Remove hardcoded `EVENT_INFO` from `src/constants/app.js`
   - Fetch event info from `GET /api/event-years/active`
   - Update countdown timers to use dynamic dates
3. Create API service to fetch sports dynamically (with year parameter)
4. Update SportsSection to fetch and display sports from API (grouped by category, filtered by active year)
5. **Remove all hardcoded sports:**
   - Remove `sportsData` from `SportsSection.jsx`
   - Remove or clean `src/constants/sports.js`
   - Remove hardcoded sports from backend `constants/index.js`
6. **Add Year Management UI (Admin Only):**
   - Year selector component
   - Create new year modal
   - Year management interface
7. Update EventScheduleModal:
   - Support selecting multiple teams/players for multi types
   - Add validation for match_type 'final'
   - Handle arrays instead of single values
   - **Match Result UI:**
     - For dual types: "Winner" button functionality
     - For multi types: "Qualified" buttons with position tracking (1st, 2nd, 3rd, etc.)
     - "Freeze" button to knock out remaining participants
     - "Save Result" button to finalize
   - Show appropriate messages for 'final' match scenarios
4. Update RegisterModal for all sport types:
   - Show `team_size` number of player selection dropdowns for team sports
   - Validate team size matches `team_size` before submission
5. **Remove all hardcoded sports data** (no backward compatibility)

### Step 6: Update All Other APIs
1. Update `GET /api/sports-counts` to query Sports collection (filtered by year)
2. Update `GET /api/teams/:sport` to query Sports collection (filtered by year)
3. Update `GET /api/participants/:sport` to query Sports collection (filtered by year)
4. Update `GET /api/event-schedule/:sport/teams-players` to use Sports collection (filtered by year)
5. Update `GET /api/export-excel` to use Sports collection dynamically (filtered by year)
6. Remove all hardcoded sport arrays from backend
7. **Add year parameter to all event-related endpoints:**
   - Default to active year if not provided
   - Validate year exists in EventYear collection
   - Filter all queries by `event_year`

---

## Key Considerations

### 1. Caching Strategy

**Frontend Caching:**
- **Location:** `src/utils/api.js` - Client-side request cache
- **TTL:** 5-10 seconds for most endpoints
- **Cached Endpoints:**
  - `GET /api/departments` - 5-10 seconds TTL
  - `GET /api/departments/active` - 5-10 seconds TTL
  - `GET /api/event-years/active` - 5-10 seconds TTL
  - `GET /api/sports` - 5-10 seconds TTL
  - `GET /api/players` - 5-10 seconds TTL
  - `GET /api/me` - 5-10 seconds TTL
  - `GET /api/teams/:sport` - 5-10 seconds TTL
  - `GET /api/participants/:sport` - 5-10 seconds TTL
  - `GET /api/event-schedule/:sport` - 5-10 seconds TTL
  - `GET /api/sports-counts` - 5-10 seconds TTL
- **Cache Invalidation:**
  - Clear cache on POST, PUT, DELETE operations for related endpoints
  - Example: After creating/updating/deleting a department, clear `/api/departments` and `/api/departments/active` cache
  - Example: After creating/updating/deleting a sport, clear `/api/sports` and `/api/sports-counts` cache
  - Example: After updating team participation, clear `/api/teams/:sport` cache
  - Use `clearCache(url)` function from `src/utils/api.js`

**Backend Caching (Optional but Recommended):**
- **Location:** Can use in-memory cache or Redis
- **TTL:** 5-10 seconds for frequently accessed data
- **Cached Data:**
  - Active year configuration (EventYear with `is_active: true`)
  - Active departments list
  - Sports list (filtered by year)
  - Computed player participation (with year parameter)
- **Cache Invalidation:**
  - Clear cache when data is modified (POST, PUT, DELETE operations)
  - Invalidate on Sports collection updates
  - Invalidate on Department collection updates
  - Invalidate on EventYear activation changes

**Cache Invalidation Rules:**
- **Department Operations:**
  - POST /api/departments → Clear department caches
  - PUT /api/departments/:id → Clear department caches
  - DELETE /api/departments/:id → Clear department caches
- **Sports Operations:**
  - POST /api/sports → Clear sports caches
  - PUT /api/sports/:id → Clear sports caches
  - DELETE /api/sports/:id → Clear sports caches
- **Participation Operations:**
  - POST /api/update-team-participation → Clear team caches, player caches
  - POST /api/update-participation → Clear participant caches
  - POST /api/add-captain → Clear captain caches
  - DELETE /api/remove-participation → Clear participation caches
- **Event Schedule Operations:**
  - POST /api/event-schedule → Clear event schedule caches
  - PUT /api/event-schedule/:id → Clear event schedule caches, points table caches
  - DELETE /api/event-schedule/:id → Clear event schedule caches, points table caches

### 2. Performance
- Index Sports collection properly
- Index Department collection properly (`name`, `is_active`, `display_order`)
- Index EventYear collection properly (`year`, `is_active`)
- Cache frequently accessed data (departments, active year, sports list)
- Optimize participation computation (consider denormalization)

### 3. Caching Implementation Details

**Frontend Cache Implementation:**
- Uses `Map` data structure for in-memory cache
- Cache key: API endpoint URL
- Cache entry: `{ data: any, timestamp: number }`
- TTL check: `(Date.now() - timestamp) < TTL`
- Cache invalidation: Call `clearCache(url)` after mutations
- Request deduplication: Prevents multiple identical requests

**Backend Cache Implementation (Recommended):**
- Use in-memory cache (Map) or Redis for production
- Cache key pattern: `endpoint:params` (e.g., `sports:2026`, `departments:active`)
- Cache entry: `{ data: any, timestamp: number }`
- TTL: 5-10 seconds
- Middleware: Add cache middleware for GET endpoints
- Invalidation: Clear cache in route handlers after mutations

**Cache Invalidation Best Practices:**
- Always invalidate related caches after mutations
- Invalidate parent caches when child data changes
- Use cache tags/keys for efficient bulk invalidation
- Log cache hits/misses for monitoring (optional)

### 4. Data Integrity
- Validate team/player references in Sports collection
- Ensure captains are valid players
- **CRITICAL: All team members must have the same year of admission** (existing functionality to be retained)
  - All players in a team MUST have identical `year_of_admission` values
  - Validation must be enforced in both frontend and backend
  - Example: "Team 1" with "Player 1" (2022) and "Player 2" (2022) is valid
  - Example: "Team 1" with "Player 1" (2022) and "Player 2" (2023) is invalid
- Ensure teams/players in EventSchedule exist in Sports collection
- Ensure points table entries match participants in Sports collection
- Validate points calculations are correct (winner: 2, loser: 0, draw/cancelled: 1 each)
- Ensure points are only updated for league matches (not knockout or final)

### 5. Team Membership Tracking
**Solution:** Store players array in `teams_participated`:
```javascript
teams_participated: [{
  team_name: String,
  captain: String,
  players: [String] // player reg_numbers - all players in the team
}]
```

This provides:
- Single source of truth in Sports collection
- Easy lookup of team members
- Efficient computation of player participation
- No need for separate TeamMembers collection

**CRITICAL Requirement: Same Year of Admission for All Team Members**
- All players in a team MUST have the same `year_of_admission` value
- This is an existing business rule that must be retained
- Example: "Team 1" can have "Player 1" (year_of_admission: 2022) and "Player 2" (year_of_admission: 2022)
- Example: "Team 1" CANNOT have "Player 1" (year_of_admission: 2022) and "Player 2" (year_of_admission: 2023)
- Validation enforced in:
  - Frontend: Before team creation submission
  - Backend: In `POST /api/update-team-participation` endpoint
  - Backend: In `PUT /api/replace-team-player` endpoint (when replacing a player)

### 6. League vs Knockout Match Restrictions

**League Match Restrictions:**
- `match_type: 'league'` is **only applicable for `dual_team` and `dual_player`** sports
- `match_type: 'league'` is **NOT allowed for `multi_team` and `multi_player`** sports
- If any knockout match (status: 'scheduled', 'completed', 'draw', or 'cancelled') exists for a sport, **no league matches can be scheduled** for that sport
- Once knockout matches start, league phase is considered complete

**Knockout Match Restrictions:**
- If any league match exists for a sport, knockout matches can only be scheduled with dates **after all league matches**
- Knockout match date must be greater than the latest league match date
- This ensures league phase completes before knockout phase begins

**Points Table System:**
- Points table is only applicable for `dual_team` and `dual_player` sports (league matches only)
- Points table is not applicable for `multi_team` and `multi_player` sports (no league matches)

### 7. Match Type 'final' and Qualifiers

**For dual_team and dual_player:**
- `match_type: 'final'` MUST be set when exactly 2 eligible teams/players remain (mandatory, not optional)
- If exactly 2 eligible participants are in the match, backend must enforce match_type to be 'final'
- One winner, one loser
- Use `winner` field to store the winner
- After match completion, no further matches possible (both participants have been in the match)
- Exception: If status is 'draw' or 'cancelled', match can be rescheduled

**For multi_team and multi_player:**
- `match_type: 'final'` can be set when all eligible participants are in the match (optional, admin decides)
- Multiple qualifiers with positions (1st, 2nd, 3rd, etc.)
- Use `qualifiers` array: `[{participant: String, position: Number}, ...]`
- Participants not in qualifiers are knocked out
- Admin decides if match is 'final' or can schedule another final match
- Exception: If status is 'draw' or 'cancelled', match can be rescheduled

**Knockout Tracking:**
- Track which participants are knocked out from previous matches
- Exclude knocked out participants from future match scheduling
- For knockout matches: participants who lost completed matches are ineligible
- For multi types: only qualifiers advance to next round

---

## Testing Checklist

### Backend
- [ ] Player model `year_of_admission` field works correctly (numeric year stored, any valid year)
- [ ] Year display format computation works ("1st Year (2025)" to "5th Year (2021)" from year_of_admission)
- [ ] Participation eligibility validation works (only 1st-5th year students can register/participate)
- [ ] Registration rejected for students with year difference < 1 or > 5
- [ ] Team year matching validation works (using year_of_admission numeric comparison)
- [ ] **All team members have same year_of_admission validation works** (existing functionality retained)
  - [ ] Team creation rejected if players have different year_of_admission values
  - [ ] Error message displayed correctly for year mismatch
  - [ ] Player replacement validates new player has same year_of_admission as existing team members
- [ ] Team creation validates all members are 1st-5th year students
- [ ] Sports CRUD operations work
- [ ] Sport deletion validation works (cannot delete sport with existing matches or points table entries)
- [ ] Participation updates update Sports collection correctly
- [ ] EventSchedule creation works for all sport types (dual_team, multi_team, dual_player, multi_player)
- [ ] Match type 'final' validation works (only 2 participants)
- [ ] Multi_team validation requires > 2 teams
- [ ] Multi_player validation requires > 2 players
- [ ] League matches are only allowed for dual_team and dual_player (rejected for multi types)
- [ ] Knockout match prevents league match scheduling (strict restriction)
- [ ] Knockout match date validation (must be after all league matches)
- [ ] League match date validation (cannot schedule if knockout exists)
- [ ] Match result update works correctly:
  - [ ] Winner field updated for dual_team/dual_player
  - [ ] Qualifiers array updated for multi_team/multi_player with positions
  - [ ] Non-qualifiers are knocked out correctly
  - [ ] Winner/qualifiers are cleared when status changes to 'draw' or 'cancelled'
  - [ ] Winner/qualifiers are cleared when status changes back to 'scheduled'
  - [ ] Winner/qualifiers must be set again when status changes from 'draw'/'cancelled' to 'completed'
- [ ] Points table updates work correctly for league matches (dual_team/dual_player only):
  - [ ] Winner: +2 points, matches_won incremented
  - [ ] Loser: +0 points, matches_lost incremented
  - [ ] Draw: +1 point each, matches_draw incremented
  - [ ] Cancelled: +1 point each, matches_cancelled incremented
  - [ ] matches_played incremented for all participants
  - [ ] Points are adjusted (not just added) when status changes:
    - [ ] Status change from 'completed' to 'draw' adjusts points correctly (winner -2, loser -0, both +1)
    - [ ] Status change from 'completed' to 'cancelled' adjusts points correctly (winner -2, loser -0, both +1)
    - [ ] Status change from 'draw' to 'completed' adjusts points correctly (both -1, winner +2, loser +0)
    - [ ] Status change back to 'scheduled' reverts all points and counters correctly
- [ ] Points table entries are auto-created when league matches are scheduled/updated
- [ ] Points table API returns sorted data (by points descending)
- [ ] Points table is not updated for knockout or final matches
- [ ] Points table is not updated for multi_team/multi_player (no league matches)
- [ ] Player API returns computed participated_in and captain_in
- [ ] Team membership tracking via players array works correctly
- [ ] All existing APIs updated to use Sports collection
- [ ] No hardcoded sports remain in backend

### Frontend
- [ ] Department dropdown fetches from API (`GET /api/departments/active`)
- [ ] Department dropdown shows only active departments sorted by display_order
- [ ] Department options update dynamically when admin adds/removes departments
- [ ] Year Of Admission input shows numeric year (any valid year, e.g., 2025, 2024, 2023, 2022, 2021, etc.)
- [ ] Year display format "1st Year (2025)" to "5th Year (2021)" computed and displayed correctly
- [ ] Registration form stores year_of_admission (numeric) correctly
- [ ] Registration form validates participation eligibility (1st-5th year only)
- [ ] Error message shown if student is not in 1st-5th year range
- [ ] PlayerListModal shows computed year display format (supports up to 5th Year)
- [ ] Participation eligibility indicator shown in PlayerListModal
- [ ] Sports display dynamically from API (grouped by category)
- [ ] Registration works for all sport types
- [ ] Event schedule creation works for multi types
- [ ] Multi-team/player selection UI works correctly
- [ ] Match type dropdown shows correct options:
  - [ ] League option hidden for multi types
  - [ ] League option hidden for dual types if knockout exists
  - [ ] Final option shown only when appropriate
- [ ] Date validation UI works (knockout date after league matches)
- [ ] Match type 'final' can be selected when appropriate
- [ ] Match result entry UI works:
  - [ ] "Winner" button for dual types works correctly
  - [ ] "Qualified" buttons for multi types change to 1st, 2nd, 3rd, etc.
  - [ ] "Freeze" button knocks out remaining participants correctly
  - [ ] "Save Result" button saves match result
- [ ] Qualifiers list displays correctly for multi types
- [ ] Points table display works (if implemented in UI)
- [ ] Team/player selection works correctly
- [ ] All existing features still work

---

## Questions to Resolve - ✅ ALL RESOLVED

1. ✅ **Performance:** Caching for computed participation fields - 5-10 second TTL, invalidate on Sports collection updates
2. ✅ **Validation:** EventSchedule validates teams/players exist in Sports collection at creation time (required for data integrity)
3. ✅ **Final Match Logic:** 
   - Dual types: Auto-enforce 'final' when exactly 2 eligible participants (backend rejects if not 'final', frontend auto-selects and disables other options)
   - Multi types: Admin decides (optional, UI can suggest)
4. ✅ **Team Size:** `team_size` field added to Sport model, validated during team creation (both frontend and backend)

---

## Estimated Effort

- **Backend Changes:** 3-4 days
  - Sports model & CRUD APIs: 0.5 day
  - Player model updates & computation: 0.5 day
  - Participation APIs update: 1 day
  - EventSchedule model & APIs update: 1 day
  - Other API updates: 0.5-1 day
- **Frontend Changes:** 2-3 days
  - Dynamic sports fetching: 0.5 day
  - EventScheduleModal multi support: 1 day
  - RegisterModal updates: 0.5 day
  - Other component updates: 0.5-1 day
- **Testing & Bug Fixes:** 2-3 days
- **Total:** ~7-10 days

---

## Next Steps

1. Review and approve this plan
2. Resolve open questions (if any)
3. Create detailed task breakdown
4. Start with Step 1 (Sports Model & Basic APIs)

## Implementation Notes

- **No Migration Needed:** Since using a new database, we can implement the new schema directly
- **No Backward Compatibility:** All code will use the new structure from the start
- **Clean Implementation:** No need to maintain old fields or gradual migration
- **Fresh Start:** All sports will be created through admin interface, no hardcoded data

