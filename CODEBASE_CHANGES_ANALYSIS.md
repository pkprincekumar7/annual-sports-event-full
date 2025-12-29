# Codebase Changes Analysis

This document outlines all the changes needed in the existing codebase to implement the new Sports Collection & Multi-Team/Multi-Player Support system.

## ✅ **Clarifications Resolved**

**Database:** Fresh database - no migration needed
**Initial Sports:** Admin creates manually through UI
**Sport Type:** Admin sets type when creating sports (UI interface provided)
**Team Size:** `team_size` field added to Sport model, validated during team creation (frontend and backend)
**Final Match Logic:** Auto-enforce for dual types, optional for multi types
**Frontend Constants:** Remove immediately (no backward compatibility)
**Caching:** 5-10 second TTL for computed participation fields, invalidate on Sports collection updates
**Multi-Year Event Support:** Fully integrated - EventYear model, event_year field in all relevant models, year-based filtering
**Year of Admission:** Player model uses `year_of_admission` (numeric) instead of `year` (formatted string). Display format computed dynamically. Event participation restricted to 1st-5th year students only.
**Team Same Year Validation:** All team members MUST have the same `year_of_admission` (existing functionality to be retained)
**Dynamic Department Management:** Department/Branch is now dynamic - Department model, admin can create/manage departments through UI, validation uses Department collection instead of hardcoded arrays

---

## Current Codebase State (Verified)

### Models:
- ✅ `EventSchedule.js`: Has `sport`, `sport_type`, `team_one`, `team_two`, `player_one`, `player_two`
- ✅ `Player.js`: Has `participated_in`, `captain_in` arrays, and `year` field (stored in database)
- ❌ **No Sport model exists** (needs to be created)
- ❌ **No PointsTable model exists** (needs to be created)
- ❌ **No EventYear model exists** (needs to be created)
- ❌ **No Department model exists** (needs to be created)

### Hardcoded Sports:
- **Backend:** `constants/index.js` - Contains `TEAM_SPORTS`, `INDIVIDUAL_SPORTS`, `CULTURAL_SPORTS` arrays
- **Frontend:** `src/constants/sports.js` - Contains `sportsData` object
- **Used in:** `routes/sports.js`, `routes/teams.js`, `routes/participants.js`, `routes/eventSchedule.js`, `routes/exports.js`, `routes/captains.js`

---

## Backend Changes

### 1. New Models to Create

#### `models/Department.js` (NEW)
- **Create new file** with schema:
  - `name`: String (required, unique, e.g., "CSE", "CSE (AI)", "ECE")
  - `code`: String (optional, short code like "CSE", "ECE" for display)
  - `is_active`: Boolean (default: true) - For soft deletion
  - `display_order`: Number (default: 0) - For sorting in dropdowns
  - `created_by`: String (admin reg_number)
  - `createdAt`: Date (auto)
  - `updatedAt`: Date (auto)
  - **Indexes:** `{ name: 1 }` (unique), `{ is_active: 1, display_order: 1 }` (for efficient queries)
  - **Key Points:**
    - Departments are institutional (not year-specific) - same departments apply to all years
    - `is_active` allows soft deletion (deactivate instead of delete)
    - `display_order` allows custom sorting in UI dropdowns
    - Admin can create/manage departments through UI

#### `models/EventYear.js` (NEW)
- **Create new file** with schema:
  - `year`: Number (required, unique, e.g., 2026, 2027)
  - `event_name`: String (required, e.g., "UMANG – 2026")
  - `event_dates`: Object with `start` and `end` (Date, required)
  - `registration_dates`: Object with `start` and `end` (Date, required)
  - `is_active`: Boolean (default: false) - Only one year can be active at a time
  - `created_by`: String (admin reg_number)
  - `createdAt`: Date (auto)
  - `updatedAt`: Date (auto)
  - **Indexes:** `{ year: 1 }` (unique), `{ is_active: 1 }`
  - **Validation:** Ensure only one year is active at a time (enforce in activate endpoint)

#### `models/Sport.js` (NEW)
- **Create new file** with schema:
  - `name`: String (required, lowercase before save)
  - `event_year`: Number (required, e.g., 2026, 2027) - Sports are year-specific
  - `type`: enum ['dual_team', 'multi_team', 'dual_player', 'multi_player'] (set by admin during creation)
  - `category`: enum ['team events', 'individual events', 'literary and cultural activities'] (set by admin during creation)
  - `team_size`: Number (optional, only for dual_team and multi_team types, set by admin during creation)
  - `eligible_captains`: Array of player reg_numbers (players assigned as captains by admin, before teams are created)
  - `teams_participated`: Array of objects with `team_name`, `captain`, `players[]` (for team sports)
  - `players_participated`: Array of player reg_numbers (for individual/cultural sports)
  - `createdAt`: Date (auto)
  - `updatedAt`: Date (auto)
  - **Indexes:** 
    - `{ name: 1, event_year: 1 }` (compound unique - unique sport name per year)
    - `{ event_year: 1, type: 1 }` (for efficient year + type queries)
    - `{ event_year: 1, category: 1 }` (for efficient year + category queries)
  - **Pre-save hook:** Convert `name` to lowercase before saving
  - **Validation:** If `team_size` is set, validate `teams_participated[].players.length === team_size` during team creation
  - **Validation:** `teams_participated[].captain` must be in `eligible_captains` array
  - **Validation:** `event_year` must exist in EventYear collection

#### `models/PointsTable.js` (NEW)
- **Create new file** with schema:
  - `event_year`: Number (required, e.g., 2026, 2027) - Points are year-specific
  - `sports_name`: String (required) - Reference to Sport.name
  - `participant`: String (required) - team_name (for team sports) or player reg_number (for individual sports)
  - `participant_type`: enum ['team', 'player'] (required)
  - `points`: Number (required, default: 0)
  - `matches_played`: Number (required, default: 0)
  - `matches_won`: Number (required, default: 0)
  - `matches_lost`: Number (required, default: 0)
  - `matches_draw`: Number (required, default: 0)
  - `matches_cancelled`: Number (required, default: 0)
  - `createdAt`: Date (auto)
  - `updatedAt`: Date (auto)
  - **Indexes:**
    - `{ event_year: 1, sports_name: 1, participant: 1 }` (compound unique - unique participant per sport per year)
    - `{ event_year: 1, sports_name: 1, points: -1 }` (for efficient sorted points table queries by year)
  - **Key Points:**
    - Points are only tracked for league matches (not knockout or final)
    - League matches are only applicable for `dual_team` and `dual_player` sports
    - Points table is not applicable for `multi_team` and `multi_player` sports

### 2. Models to Update

#### `models/EventSchedule.js` (MODIFY)
**Current fields to REMOVE:**
- `sport` (change to `sports_name`)
- `sport_type` (remove - will get from Sport collection)
- `team_one`, `team_two` (replace with `teams` array)
- `player_one`, `player_two` (replace with `players` array)

**New fields to ADD:**
- `event_year`: Number (required, e.g., 2026, 2027) - Matches are year-specific
- `sports_name`: String (required) - references Sport.name (same year)
- `teams`: [String] - array of team names (for dual_team and multi_team)
- `players`: [String] - array of player reg_numbers (for dual_player and multi_player)
- `qualifiers`: [{ participant: String, position: Number }] - for multi_team/multi_player types
- `match_type`: Add 'final' to enum (currently only 'league', 'knockout')
- `winner`: String - for dual_team/dual_player (single winner)

**Indexes to UPDATE:**
- Change `{ sport: 1, match_number: 1 }` to `{ event_year: 1, sports_name: 1, match_number: 1 }` (compound unique - unique match numbers per sport per year)
- Change `{ sport: 1 }` to `{ event_year: 1, sports_name: 1 }`
- Change `{ sport: 1, status: 1 }` to `{ event_year: 1, sports_name: 1, status: 1 }`
- **Validation:** `event_year` must exist in EventYear collection

#### `models/Player.js` (MODIFY)
**Fields to REMOVE:**
- `participated_in` array (entire field)
- `captain_in` array (entire field)
- `year` field (rename to `year_of_admission`)

**Fields to RENAME/UPDATE:**
- `year` → `year_of_admission`: Number (required, any valid year, e.g., 2025, 2024, 2023, 2022, 2021, etc.)
  - Remove enum restriction (currently: ['1st Year (2025)', '2nd Year (2024)', '3rd Year (2023)', '4th Year (2022)'])
  - Accept any numeric year value
  - Display format "1st Year (2025)" will be computed dynamically, not stored
- `department_branch`: String (required)
  - Remove enum restriction (currently: ['CSE', 'CSE (AI)', 'ECE', 'EE', 'CE', 'ME', 'MTE'])
  - Change to String type (no enum)
  - Validate against Department collection instead of hardcoded array
  - Must exist in Department collection and be active (`is_active: true`)

**Indexes to REMOVE:**
- `{ captain_in: 1 }`
- `{ 'participated_in.sport': 1, 'participated_in.team_name': 1 }`
- `{ 'participated_in.sport': 1 }`

**Note:** 
- `participated_in` and `captain_in` will be computed dynamically in API responses using a helper function (filtered by event_year)
- `year_of_admission` stores numeric year only
- Display format "1st Year (2025)" computed using `computeYearDisplay()` helper function
- Event participation restricted to 1st-5th year students only (validated using `canParticipateInEvents()` helper)

### 3. New API Endpoints to Create

#### Department Management APIs (NEW)
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

#### EventYear Management APIs (NEW)
- `GET /api/event-years` - Get all event years (admin only)
- `GET /api/event-years/active` - Get currently active year (public)
- `POST /api/event-years` - Create new event year (admin only)
  - **Validation:** Year must be unique
  - **Validation:** Only one year can be active at a time
- `PUT /api/event-years/:year` - Update event year configuration (admin only)
- `PUT /api/event-years/:year/activate` - Set year as active (admin only, deactivates others)
- `DELETE /api/event-years/:year` - Delete event year (admin only, only if no data exists)

#### Sports Management APIs
- `GET /api/sports` - Get all sports (admin only, or public for display)
  - **Year Filter:** Accepts `?year=2026` parameter (defaults to active year)
  - Filter by `event_year` in query
- `POST /api/sports` - Create new sport (admin only)
  - **Year Required:** `event_year` field required in request body (defaults to active year)
  - **Validation:** Validate `event_year` exists in EventYear collection
  - **Admin sets:** `type`, `category`, `team_size` (optional, for team sports)
  - **Validation:** Validate `team_size` is only set for team sports (dual_team, multi_team)
- `PUT /api/sports/:id` - Update sport (admin only)
  - **Year Context:** Update within same year (cannot change event_year)
  - **Validation:** If updating `team_size`, validate existing teams match new size
- `DELETE /api/sports/:id` - Delete sport (admin only)
  - **Validation:** Validate that no matches exist for this sport in the same year (reject deletion if matches found)
  - **Validation:** Validate that no points table entries exist for this sport in the same year
- `GET /api/sports/:name` - Get sport by name
  - **Year Required:** Accepts `?year=2026` parameter (defaults to active year)
  - Query by `name` and `event_year`

#### Points Table APIs
- `GET /api/points-table/:sport` - Get points table for a sport (sorted by points descending)
  - **Year Filter:** Accepts `?year=2026` parameter (defaults to active year)
  - Filter by `event_year` and `sports_name`
- `GET /api/points-table/:sport/:participant` - Get specific participant's points
  - **Year Filter:** Accepts `?year=2026` parameter (defaults to active year)

### 4. Existing API Endpoints to Update

#### `GET /api/sports` (Line 172)
**Current:** Returns hardcoded team sports array
**Change to:** Query Sports collection, filter by type and category

#### `GET /api/sports-counts` (Line 1608)
**Current:** Uses hardcoded arrays:
- `teamSports = ['Cricket', 'Volleyball', ...]`
- `individualSports = ['Carrom', 'Chess', ...]`
**Change to:** Query Sports collection, group by type and category dynamically

#### `POST /api/event-schedule` (Line 2406)
**Major Changes:**
- **Year Required:** `event_year` field required in request body (defaults to active year)
- **Validation:** Validate `event_year` exists in EventYear collection
- Remove `sport_type` from request body (get from Sport collection, filtered by year)
- Change `team_one`, `team_two` to `teams` array
- Change `player_one`, `player_two` to `players` array
- **Validate sport exists in Sports collection for the specified year** (query by `name` and `event_year`)
- Add validation for multi types (> 2 participants)
- Add validation for `match_type: 'final'`:
  - Dual types: MUST be 'final' when exactly 2 eligible participants
  - Multi types: Can be 'final' when all eligible participants (optional)
- Add league vs knockout restrictions validation (all checks filtered by year):
  - If scheduling league: Check no knockout matches exist (any status) for this sport in this year
  - If scheduling knockout/final: Check date is after all league matches for this sport in this year
- Validate teams/players exist in Sport's participation arrays (for the specified year)
- Validate all teams/players in arrays are unique (no duplicates)
- Prevent scheduling if 'final' match with status 'completed' exists for this sport in this year
- Allow rescheduling if 'final' match status is 'draw' or 'cancelled'
- For multi types: Reject 'league' match_type

#### `PUT /api/event-schedule/:id` (Line 2673)
**Major Changes:**
- Support `qualifiers` array for multi types:
  - Validate positions are unique and sequential (1, 2, 3, etc.)
  - All participants not in qualifiers are automatically knocked out
- Handle winner for dual types:
  - Set loser as the other participant
  - Validate `winner` is set when status is 'completed', `qualifiers` should be empty
- Handle qualifiers for multi types:
  - Validate `qualifiers` array is set when status is 'completed', `winner` should be empty
- Validate only one of `winner` or `qualifiers` is populated based on sport type
- Clear winner/qualifiers on status change to 'draw'/'cancelled'
- Clear winner/qualifiers when status changes back to 'scheduled'
- Must set winner/qualifiers again when status changes from 'draw'/'cancelled' to 'completed'
- Update points table for league matches (dual types only):
  - Adjust points (not just add) when status changes
  - Track previous status for correct adjustments
  - Update match counters (matches_played, matches_won, etc.)
- Track knocked out participants:
  - For knockout matches: Mark non-qualifying/non-winning participants as knocked out
  - For final matches: Mark sport tournament as complete when status is 'completed'
- Enforce 'final' match completion rules:
  - Prevent further matches if 'final' match is completed
- Validate that qualifiers/winner are from the match's teams/players array

#### `GET /api/event-schedule/:sport` (Line 2386)
**Changes:**
- **Year Filter:** Accept `?year=2026` parameter (defaults to active year)
- Change query from `sport` to `sports_name`
- Filter by `event_year` and `sports_name`
- Include `qualifiers` array in response for multi types
- Filter out knocked out participants (year-specific)

#### `GET /api/event-schedule/:sport/teams-players` (Line 2803)
**Major Changes:**
- **Year Filter:** Accept `?year=2026` parameter (defaults to active year)
- Query Sports collection instead of Player collection (filtered by year)
- Get teams from `Sport.teams_participated` (for the specified year)
- Get players from `Sport.players_participated` (for the specified year)
- Exclude teams/players that have been knocked out in previous matches (in the same year)
- For knockout matches: Only return participants who haven't lost any completed match (in the same year)
- Filter by eligible participants only

#### `POST /api/update-team-participation` (Line 699)
**Major Changes:**
- **Year Required:** `event_year` field required in request body (defaults to active year)
- **Validation:** Validate `event_year` exists in EventYear collection
- **Workflow:** Captain (who was assigned via `POST /api/add-captain`) creates a team
- Update `Sport.teams_participated` array instead of `Player.participated_in` (for the specified year)
- Find sport by `name` and `event_year`
- Include `players` array in team object
- **Validate captain eligibility:** Ensure logged-in user (captain) is in `Sport.eligible_captains` array
- **Validate exactly one captain:** Ensure exactly one player in team is in `eligible_captains` array
- **Validate team size:** If sport has `team_size` set, ensure `players.length === team_size` (backend validation)
- **CRITICAL: Validate same year of admission:** All players in a team MUST have the same `year_of_admission` (existing functionality to be retained)
  - Check that all players have identical `year_of_admission` values
  - Reject team creation if any player has different `year_of_admission` than other team members
  - Error message: "Year mismatch: [player names] must be in the same year of admission ([year]) as other team members."
- **Validate participation eligibility:** All team members must be 1st to 5th year students (use `canParticipateInEvents()`)
- Set `teams_participated[].captain` to captain's reg_number (must be in `eligible_captains`)
- Ensure captain is in `players` array (validate captain is a valid player reg_number)
- Ensure all players in `players` array are valid player reg_numbers
- Remove all Player collection updates

#### `POST /api/update-participation` (Line 1023)
**Major Changes:**
- **Year Required:** `event_year` field required in request body (defaults to active year)
- **Validation:** Validate `event_year` exists in EventYear collection
- Update `Sport.players_participated` array instead of `Player.participated_in` (for the specified year)
- Find sport by `name` and `event_year`
- **Validate participation eligibility:** Participant must be 1st to 5th year student (use `canParticipateInEvents()`)
- Remove all Player collection updates

#### `POST /api/add-captain` (Line 196)
**Major Changes:**
- **Year Required:** `event_year` field required in request body (defaults to active year)
- **Validation:** Validate `event_year` exists in EventYear collection
- **Workflow:** Admin assigns player as captain for a sport (makes player eligible to create a team)
- Update `Sport.eligible_captains` array (add player reg_number for the specified year)
- Find sport by `name` and `event_year`
- **Important:** This does NOT create a team - it only makes the player eligible to be a captain
- Validate player exists and is not already in `eligible_captains` array
- After captain assignment, player can create team via `POST /api/update-team-participation`
- Remove Player collection updates

#### `DELETE /api/remove-captain` (Line 371)
**Major Changes:**
- **Year Required:** `event_year` field required in request body (defaults to active year)
- **Validation:** Validate `event_year` exists in EventYear collection
- **Workflow:** Admin removes captain eligibility (only if player hasn't created a team yet)
- Update `Sport.eligible_captains` array (remove player reg_number for the specified year)
- Find sport by `name` and `event_year`
- **Validation:** If player has created a team (exists in `teams_participated` for this year), reject removal - team must be deleted first
- Remove Player collection updates

#### `GET /api/teams/:sport` (Line 1530)
**Changes:**
- **Year Filter:** Accept `?year=2026` parameter (defaults to active year)
- Query Sports collection's `teams_participated` instead of Player collection (filtered by year)
- Find sport by `name` and `event_year`
- Return teams from Sport document

#### `GET /api/participants/:sport` (Line 1780)
**Changes:**
- **Year Filter:** Accept `?year=2026` parameter (defaults to active year)
- Query Sports collection's `players_participated` instead of Player collection (filtered by year)
- Find sport by `name` and `event_year`

#### `GET /api/export-excel` (Line 2257)
**Major Changes:**
- **Year Filter:** Accept `?year=2026` parameter (defaults to active year)
- Remove hardcoded `sportColumns` array (lines 2264-2291)
- Remove hardcoded `teamSports` array (lines 2294-2302)
- Query Sports collection dynamically (filtered by year)
- Compute participation from Sports collection (filtered by year)
- Generate columns dynamically based on Sports collection
- **Year Display:** Use `computeYearDisplay()` helper to generate "1st Year (2025)" format from `year_of_admission` for Excel export

#### `GET /api/players` (Line 157)
**Changes:**
- **Year Parameter:** Accept optional `?year=2026` parameter (defaults to active year)
- Add computed `participated_in` and `captain_in` fields using helper function (filtered by year)
- **Add computed `year` field:** Compute display format "1st Year (2025)" from `year_of_admission` using `computeYearDisplay()` helper
- Remove query for stored fields (they no longer exist)

#### `GET /api/me` (Line 136)
**Changes:**
- **Year Context:** Filtered by active year (or provided year parameter)
- Add computed `participated_in` and `captain_in` fields using helper function (filtered by active year)
- **Add computed `year` field:** Compute display format from `year_of_admission`

#### `POST /api/login` (Line 1147)
**Changes:**
- **Year Context:** Filtered by active year
- Add computed `participated_in` and `captain_in` fields to response (filtered by active year)
- **Add computed `year` field:** Compute display format from `year_of_admission`

#### `POST /api/save-player` (Line 1220)
**Changes:**
- Remove `participated_in` and `captain_in` from request body validation
- Remove these fields from Player creation
- **Update year field:** Accept `year_of_admission` (Number) instead of `year` (formatted string)
- **Validation:** Validate `year_of_admission` is numeric and within reasonable range
- **Participation Restriction:** Use `canParticipateInEvents()` to validate - only 1st to 5th year students can register
- Reject registration if year difference < 1 or > 5
- **Update department field:** Remove enum validation, validate against Department collection
- **Department Validation:** Query Department collection to verify `department_branch` exists and `is_active: true`
- Reject if department doesn't exist or is inactive

#### `POST /api/save-players` (Line 1331)
**Changes:**
- Remove `participated_in` and `captain_in` from validation
- Remove these fields from Player creation
- **Update year field:** Accept `year_of_admission` (Number) instead of `year` (formatted string)
- **Validation:** Validate all players have valid `year_of_admission` and are eligible (1st-5th year)

#### `PUT /api/update-player` (Line 2151)
**Changes:**
- Remove `participated_in` and `captain_in` from update logic
- **Update year field:** Accept `year_of_admission` instead of `year`
- **Validation:** `year_of_admission` cannot be modified (same as current `year` restriction)
- **Update department field:** Remove enum validation, validate against Department collection
- **Department Validation:** Query Department collection to verify `department_branch` exists and `is_active: true`
- Reject if department doesn't exist or is inactive

#### `DELETE /api/remove-participation` (Line 1464)
**Major Changes:**
- **Year Required:** `event_year` field required in request body (defaults to active year)
- **Validation:** Validate `event_year` exists in EventYear collection
- Update Sports collection instead of Player collection (for the specified year)
- Find sport by `name` and `event_year`
- Remove from `Sport.teams_participated` or `Sport.players_participated` (for the specified year)

#### `POST /api/delete-team` (Line 2073)
**Major Changes:**
- **Year Required:** `event_year` field required in request body (defaults to active year)
- **Validation:** Validate `event_year` exists in EventYear collection
- Update Sports collection's `teams_participated` array (for the specified year)
- Find sport by `name` and `event_year`
- Remove team from Sport document

#### `POST /api/update-team-player` (Line 1836)
**Major Changes:**
- **Year Filter:** Accept `?year=2026` parameter (defaults to active year)
- Update `Sport.teams_participated[].players` array (for the specified year)
- Find sport by `name` and `event_year`
- **Validate:** New player must have same gender as other team members
- **CRITICAL: Validate same year of admission:** New player MUST have the same `year_of_admission` as existing team members (existing functionality to be retained)
  - Check that new player's `year_of_admission` matches all existing team members' `year_of_admission`
  - Reject replacement if year mismatch
  - Error message: "Year mismatch: New player must be in the same year of admission ([year]) as other team members."
- Remove Player collection updates

#### `DELETE /api/event-schedule/:id` (Line 2632)
**Changes:**
- **Year Context:** Match is already associated with `event_year` (use for points table cleanup)
- Update query from `sport` to `sports_name` if needed
- **Points table cleanup (year-specific):**
  - If deleted match was a league match (match_type === 'league'):
    - Revert points adjustments for all participants in the match (for the same year)
    - Decrement match counters (matches_played, matches_won, matches_lost, matches_draw, matches_cancelled)
    - If match had status 'completed', 'draw', or 'cancelled', adjust points accordingly
    - Filter points table updates by `event_year` (same year as deleted match)
- Update any references to old schema fields

#### `GET /api/participants-count/:sport` (Line 1720)
**Changes:**
- **Year Filter:** Accept `?year=2026` parameter (defaults to active year)
- Query Sports collection's `players_participated` array instead of Player collection (filtered by year)
- Find sport by `name` and `event_year`
- Count from `Sport.players_participated.length` for the sport (in the specified year)

#### `GET /api/captains-by-sport` (Line 467)
**Major Changes:**
- **Year Filter:** Accept `?year=2026` parameter (defaults to active year)
- Query Sports collection's `teams_participated[].captain` instead of Player collection (filtered by year)
- Return captains from Sport document's teams_participated array (for the specified year)

#### `POST /api/validate-participations` (Line 524)
**Major Changes:**
- Update validation logic to check Sports collection instead of Player collection
- Validate against `Sport.teams_participated` and `Sport.players_participated`
- Remove Player collection participation checks

### 5. Scripts to Create

**Note:** No seed scripts needed - admin creates all sports manually through UI.

### 6. Helper Functions to Create

#### `validateDepartmentExists(departmentName)`
**Location:** Create in `utils/validation.js` or `routes/departments.js`
**Purpose:** Validate department exists and is active
**Logic:**
- Query Department collection for department with `name` matching `departmentName`
- Check if department exists and `is_active: true`
- Return `{ exists: boolean, isActive: boolean, department: Department | null }`
- Used in player registration and update validation

#### `computePlayerParticipation(playerRegNumber, eventYear = null)`
**Location:** Create in `utils/participation.js` or `routes/players.js`
**Purpose:** Compute `participated_in` and `captain_in` from Sports collection (filtered by year)
**Logic:**
- **Year Parameter:** Accept optional `eventYear` parameter
- **Default Year:** If `eventYear` not provided, get active year from EventYear collection (`is_active: true`)
- Query Sports collection for player as (filtered by `event_year`):
  - Eligible captain (in `eligible_captains` array)
  - Team captain (in `teams_participated[].captain`)
  - Team member (in `teams_participated[].players`)
  - Individual participant (in `players_participated`)
- Build `participated_in` array with sport and team_name (only actual participations, filtered by year)
- Build `captain_in` array with sport names (includes both eligible captains and team captains, filtered by year)
- **Important:** If player is eligible captain but hasn't created team, they appear in `captain_in` but not in `participated_in`
- **Performance:** Cache results with 5-10 second TTL (similar to current API caching)
- **Cache invalidation:** Clear cache when Sports collection is updated (POST, PUT, DELETE operations)

#### `computeYearDisplay(yearOfAdmission, currentYear = null)`
**Location:** Create in `utils/player.js` or `routes/players.js`
**Purpose:** Compute display format "1st Year (2025)" from numeric `year_of_admission`
**Logic:**
- Calculate year difference: `currentYear - yearOfAdmission`
- Map to display format:
  - Year difference 1 → "1st Year (2025)"
  - Year difference 2 → "2nd Year (2024)"
  - Year difference 3 → "3rd Year (2023)"
  - Year difference 4 → "4th Year (2022)"
  - Year difference 5 → "5th Year (2021)"
  - Year difference > 5 → "6th Year", "7th Year", etc. (display only, cannot participate)
- Return formatted string: `${label} (${yearOfAdmission})`

#### `canParticipateInEvents(yearOfAdmission, currentYear = null)`
**Location:** Create in `utils/player.js` or `routes/players.js`
**Purpose:** Validate participation eligibility (1st to 5th year students only)
**Logic:**
- Calculate year difference: `currentYear - yearOfAdmission`
- Return `true` if year difference is between 1 and 5 (inclusive)
- Return `false` if year difference < 1 or > 5
- Used for validation before allowing registration/participation

#### `updatePointsTable(match, previousStatus)`
**Location:** Create in `utils/pointsTable.js` or `routes/eventSchedule.js`
**Purpose:** Update points table when league match results change (year-specific)
**Logic:**
- Only for `match_type === 'league'` and dual types (`dual_team`, `dual_player`)
- **Year Context:** Use `match.event_year` for all points table operations
- **Auto-create entries:** Create points table entries for all participants if they don't exist (for the same year)
- Adjust points based on status change (filtered by `event_year`)
- Track previous status for correct adjustments
- Update match counters (matches_played, matches_won, matches_lost, matches_draw, matches_cancelled)
- Points table entries are created automatically when:
  - A league match is scheduled (create entries for all participants if they don't exist, for the same year)
  - Or when first league match result is updated (for the same year)
- **Important:** All points table operations must filter by `event_year` to ensure year-specific data

### 7. Code to Remove from Backend

**Hardcoded Sports Arrays:**
- Line 175-183: `teamSports` array in `/api/sports`
- Line 1613: `teamSports` array in `/api/sports-counts`
- Line 1617-1622: `individualSports` array in `/api/sports-counts`
- Line 2264-2291: `sportColumns` array in `/api/export-excel`
- Line 2294-2302: `teamSports` array in `/api/export-excel`

**All Player Collection Participation Updates:**
- Remove all code that updates `Player.participated_in`
- Remove all code that updates `Player.captain_in`
- These are scattered throughout multiple endpoints

**Old Field References:**
- Remove all references to `sport` field (use `sports_name`)
- Remove all references to `sport_type` (get from Sport collection)
- Remove all references to `team_one`, `team_two` (use `teams` array)
- Remove all references to `player_one`, `player_two` (use `players` array)

**Constants to Remove (Immediately - No Backward Compatibility):**
- `constants/index.js`: Remove `TEAM_SPORTS`, `INDIVIDUAL_SPORTS`, `CULTURAL_SPORTS` arrays
- `constants/index.js`: Remove or update `VALID_YEARS` constant (remove enum restriction, or make it a range like 2015-2030)
- `constants/index.js`: Remove `VALID_DEPARTMENTS` array (departments now come from Department collection)
- Keep other constants (VALID_GENDERS, etc.)
- Update `MATCH_TYPES` to include 'final': `['league', 'knockout', 'final']`
- Update `SPORT_TYPES` to new types: `['dual_team', 'multi_team', 'dual_player', 'multi_player']` (or remove if not needed)
- `src/constants/sports.js`: Remove entire file or clean all hardcoded sports data
- `src/constants/app.js`: 
  - Remove hardcoded `EVENT_INFO` (fetch from EventYear API instead)
  - Remove `DEPARTMENT_OPTIONS` array (fetch from Department API instead)

---

## Frontend Changes

### 1. Components to Update

#### `src/components/SportsSection.jsx` (MAJOR UPDATE)
**Current State:**
- Has hardcoded `sportsData` object (lines 5-38)
- Uses `sportsData.team`, `sportsData.individual`, `sportsData.cultural`

**Changes Needed:**
- **Remove:** Entire `sportsData` object (lines 5-38)
- **Add:** State for sports fetched from API
- **Add:** `useEffect` to fetch sports from `GET /api/sports`
- **Update:** Group sports by `category` field from API response
- **Update:** Map over fetched sports instead of hardcoded arrays
- **Update:** Handle loading and error states
- **Update:** Use `sport.type` and `sport.category` from API instead of hardcoded types

**Key Changes:**
- Line 5-38: Remove `sportsData` object
- Line 250: Change `sportsData.team` to fetched sports filtered by category
- Line 335: Change `sportsData.individual` to fetched sports filtered by category
- Line 354: Change `sportsData.cultural` to fetched sports filtered by category
- Add API fetch logic similar to `fetchAllCounts` function

#### `src/components/EventScheduleModal.jsx` (MAJOR UPDATE)
**Current State:**
- Uses `team_one`, `team_two` for team events
- Uses `player_one`, `player_two` for individual events
- Only supports dual types (2 participants)
- `match_type` dropdown has 'league' and 'knockout' only

**Changes Needed:**

**Form State Updates:**
- **Remove:** `teamOne`, `teamTwo`, `playerOne`, `playerTwo` states
- **Add:** `teams` array state (for team sports)
- **Add:** `players` array state (for individual sports)
- **Add:** `qualifiers` state (for multi types match results)
- **Add:** `matchType` state (already exists, but update logic)

**Match Creation Form:**
- **Update:** Support selecting multiple teams/players (multi-select dropdowns)
- **Update:** Match type dropdown logic:
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
- **Add:** Date validation UI:
  - If scheduling knockout/final match and league matches exist:
    - Show warning: "Knockout match date must be after all league matches"
    - Display the latest league match date for reference
    - Validate date before allowing submission
- **Update:** Validation based on sport type from API

**Match Result Entry:**
- **For dual types:** 
  - Show "Winner" button for each participant
  - When winner is selected:
    - Selected participant's button changes to "Winner" and disables
    - Other participant's button changes to "Loser" and disables
    - Both buttons disabled after selection
  - Show "Save Result" button to finalize
- **For multi types:** 
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
- **Update:** Handle `qualifiers` array in API calls

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

**API Calls:**
- **Update:** `POST /api/event-schedule` request body:
  - Change `team_one`, `team_two` to `teams` array
  - Change `player_one`, `player_two` to `players` array
  - Remove `sport_type` (get from Sport collection)
- **Update:** `PUT /api/event-schedule/:id` request body:
  - Add `qualifiers` array for multi types
  - Handle winner for dual types
- **Update:** Response handling for `qualifiers` array

**Key File Locations:**
- Line 14-19: Form state variables
- Line 42-88: useEffect hooks
- Line 124-200: `fetchTeamsPlayers` function
- Line 300-600: Form rendering and submission
- Line 700-900: Match display and result entry

#### `src/components/RegisterModal.jsx` (UPDATE)
**Current State:**
- Uses `selectedSport.type` ('team' or 'individual')
- Uses hardcoded sport data
- Has "Year" dropdown with formatted values: "1st Year (2025)", "2nd Year (2024)", etc.
- Has hardcoded `DEPARTMENT_OPTIONS` from `src/constants/app.js`

**Changes Needed:**
- **Update:** Get sport details from API (`GET /api/sports/:name?year={activeYear}`)
- **Update:** Handle all sport types (dual_team, multi_team, dual_player, multi_player)
- **Update:** Registration logic for multi types
- **Update:** Team registration to include `players` array
- **Update:** API calls to update Sports collection instead of Player collection
- **Year Of Admission Field:**
  - Change dropdown label from "Year" to "Year Of Admission"
  - Change dropdown values from formatted strings to numeric years: 2025, 2024, 2023, 2022, 2021, etc.
  - Store `year_of_admission` (numeric) in database
  - Display format "1st Year (2025)" computed but not stored
  - **Participation Validation:** 
    - Frontend: Validate that player is in 1st to 5th year (currentYear - yearOfAdmission = 1 to 5)
    - Show error message if year difference < 1 or > 5: "Only 1st to 5th year students can participate"
- **Team Size Validation:**
  - If sport has `team_size` set, show exactly `team_size` number of player selection dropdowns
  - Validate team size matches `team_size` before submission (frontend validation)
  - Backend will also validate team size
- **CRITICAL: Team Same Year Validation:**
  - Frontend: Validate that all selected players have the same `year_of_admission`
  - Show error message if mismatch: "All team members must be in the same year of admission."
  - Backend will also validate same year requirement
- **Department Field:**
  - Remove hardcoded `DEPARTMENT_OPTIONS` from `src/constants/app.js`
  - Fetch departments from `GET /api/departments/active` API (cached, 5-10 second TTL)
  - Display departments in dropdown sorted by `display_order`
  - Show only active departments (`is_active: true`)
  - Backend will validate department exists and is active
  - **Cache Invalidation:** Clear department cache after admin creates/updates/deletes department (if admin is managing departments in same session)
- **Year Context:** Include `event_year` in API requests (defaults to active year)

**Key Changes:**
- Line 16: `isTeam` check - update to use `sport.type`
- Line 75-150: Player fetching and team registration logic
  - **Add:** Dynamic number of player selection dropdowns based on `sport.team_size`
  - **Add:** Frontend validation for team size
- Line 200-400: Registration form and submission

#### `src/components/SportDetailsModal.jsx` (UPDATE)
**Changes Needed:**
- **Update:** Fetch sport details from API instead of using props
- **Update:** Display sport information dynamically
- **Update:** Show sport type, category from API

#### `src/components/AddCaptainModal.jsx` (UPDATE)
**Changes Needed:**
- **Update:** API call to update Sports collection instead of Player collection
- **Update:** Update `Sport.teams_participated[].captain`

#### `src/components/RemoveCaptainModal.jsx` (UPDATE)
**Changes Needed:**
- **Update:** API call to update Sports collection instead of Player collection

#### `src/components/TeamDetailsModal.jsx` (UPDATE)
**Changes Needed:**
- **Update:** Fetch team data from Sports collection
- **Update:** Display team members from `Sport.teams_participated[].players`

#### `src/components/PlayerListModal.jsx` (UPDATE)
**Changes Needed:**
- **Update:** Fetch participants from Sports collection (filtered by year)
- **Update:** Display from `Sport.players_participated` or `Sport.teams_participated`
- **Year Of Admission Field:**
  - Change label from "Year" to "Year Of Admission" (or show computed "Year" for display)
  - Update to use `year_of_admission` field (numeric) for editing
  - Display computed "Year" format "1st Year (2025)" to "5th Year (2021)" for viewing
  - Update validation to accept numeric year values
  - **Display Participation Eligibility:** Show indicator if player is eligible (1st-5th year) or not eligible (>5th year)
- **Department Field:**
  - Remove hardcoded `DEPARTMENT_OPTIONS` from `src/constants/app.js`
  - Fetch departments from `GET /api/departments/active` API (cached, 5-10 second TTL)
  - Display departments in dropdown sorted by `display_order`
  - Show only active departments (`is_active: true`)
  - Backend will validate department exists and is active when updating
  - **Cache Invalidation:** Clear department cache after admin creates/updates/deletes department (if admin is managing departments in same session)

### 2. API Utility Updates

#### `src/utils/api.js` (MINOR UPDATE)
**Changes Needed:**
- No major changes, but ensure all API calls use correct endpoints
- Update any hardcoded sport references if present

### 3. Code to Remove from Frontend

**Hardcoded Sports Data:**
- `src/components/SportsSection.jsx`: Remove `sportsData` object (lines 5-38)
- `src/constants/sports.js`: Remove entire file or clean all hardcoded sports data
- **No backward compatibility needed** - remove all hardcoded sports immediately

**Old Field References:**
- Remove all references to `sport_type` ('team', 'individual', 'cultural')
- Replace with `sport.type` from API ('dual_team', 'multi_team', etc.)
- Remove all references to `team_one`, `team_two`
- Remove all references to `player_one`, `player_two`

### 4. New Frontend Features to Add

#### Department Management UI (Admin Only)
- **Department List/Management:**
  - List all departments (active and inactive)
  - Create new department
  - **Edit department restrictions:**
    - Only `is_active` and `display_order` fields can be updated
    - `name` and `code` fields are immutable (cannot be changed)
    - Show error if trying to update immutable fields
  - Delete department (with validation - check if players exist)
    - **Validation:** Query backend to check if any players have this department
    - **If players exist:** Show error message: "Cannot delete department. [X] player(s) are registered with this department."
    - **If no players:** Allow deletion
  - Sort departments by display_order
  - **Cache Invalidation:** After create/update/delete, clear department cache using `clearCache('/api/departments')` and `clearCache('/api/departments/active')`
- **Location:** Add to admin panel or create separate admin management section

### 5. Optional Frontend Features

#### Points Table Display (Optional)
**If implementing points table UI:**
- Create component to display points table for a sport
- Fetch from `GET /api/points-table/:sport`
- Display sorted by points (descending)
- Show matches played, won, lost, draw, cancelled
- Only applicable for dual_team and dual_player sports with league matches

---

## Summary of Major Changes

### Backend Summary:
1. **Create 4 new models:** Department, EventYear, Sport, PointsTable
2. **Update 2 existing models:** EventSchedule, Player
3. **Create 16 new API endpoints:** 
   - Department Management: GET /api/departments, GET /api/departments/active, POST /api/departments, PUT /api/departments/:id, DELETE /api/departments/:id
   - EventYear Management: GET /api/event-years, GET /api/event-years/active, POST /api/event-years, PUT /api/event-years/:year, PUT /api/event-years/:year/activate, DELETE /api/event-years/:year
   - Sports Management: POST /api/sports, PUT /api/sports/:id, DELETE /api/sports/:id, GET /api/sports/:name
   - Points Table: GET /api/points-table/:sport, GET /api/points-table/:sport/:participant
4. **Update 27+ existing API endpoints:** Major refactoring required with year filtering, department validation, and year of admission changes:
   - All endpoints accept optional `?year=2026` parameter (defaults to active year)
   - All endpoints validate `event_year` exists in EventYear collection when provided
   - All queries filter by `event_year` field
   - Player endpoints return computed `year` field (display format) from `year_of_admission`
   - Participation endpoints validate year of admission eligibility (1st-5th year only)
   - Team endpoints validate same year of admission for all members
   - All player endpoints validate `department_branch` against Department collection
5. **Create 5 helper functions:** 
   - `validateDepartmentExists(departmentName)` - Validate department exists and is active
   - `computePlayerParticipation(playerRegNumber, eventYear)` - Compute participation (year-filtered)
   - `computeYearDisplay(yearOfAdmission, currentYear)` - Compute "1st Year (2025)" format
   - `canParticipateInEvents(yearOfAdmission, currentYear)` - Validate eligibility (1st-5th year)
   - `updatePointsTable(match, previousStatus)` - Update points (year-filtered)
6. **Remove:** All hardcoded sports arrays, Player participation storage, `year` field enum restriction, `VALID_DEPARTMENTS` constant
7. **Update validation:** All department validation now queries Department collection instead of hardcoded array

### Frontend Summary:
1. **Update 8+ components:** Major changes to SportsSection, EventScheduleModal, RegisterModal, PlayerListModal, SportDetailsModal
2. **Remove:** Hardcoded sports data, hardcoded EVENT_INFO, hardcoded DEPARTMENT_OPTIONS
3. **Add:** 
   - Dynamic department fetching (from Department API)
   - Department management UI (admin only)
   - Dynamic sports fetching (with year filtering)
   - Multi-participant selection, qualifiers UI
   - Year management UI (admin only)
   - Event year context/hook
   - Year of admission field (numeric input, display format computed)
   - Team same year validation UI
   - Participation eligibility validation UI

### Key Breaking Changes:
- EventSchedule schema completely changes (old data incompatible)
  - Adds `event_year` field (required)
  - Changes `sport` to `sports_name`
  - Changes `team_one`/`team_two` to `teams` array
  - Changes `player_one`/`player_two` to `players` array
  - Adds `qualifiers` array for multi types
- Player schema changes:
  - `participated_in` and `captain_in` removed (computed dynamically)
  - `year` field renamed to `year_of_admission` (Number, no enum restriction)
  - `department_branch` enum restriction removed (validated against Department collection)
- Department model added (new requirement)
- EventYear model added (new requirement)
- Sport model added (new requirement)
- PointsTable model added (new requirement)
- All API request/response formats change:
  - All endpoints accept optional `?year=2026` parameter
  - All endpoints validate `event_year` exists in EventYear collection
  - All queries filter by `event_year`
  - Player responses include computed `year` field (display format)
  - Department validation queries Department collection instead of hardcoded array
- Caching strategy implemented:
  - Frontend: Client-side caching with 5-10 second TTL for GET requests
  - Frontend: Cache invalidation after mutations (POST, PUT, DELETE)
  - Backend: Optional server-side caching for frequently accessed data
  - Cache invalidation rules documented for all operations
- Frontend completely changes how sports and departments are displayed and managed:
  - Dynamic sports fetching with year filtering
  - Dynamic department fetching from Department API
  - Department management UI for admin
  - Year of admission field (numeric input)
  - Year management UI for admin
  - Event info fetched dynamically from EventYear API

### Migration Note:
**✅ RESOLVED:** Fresh database confirmed - no migration needed. Admin will create all sports manually through UI.

---

## Implementation Priority

### **Pre-Implementation (✅ All Resolved):**
0. **Phase 0:** Clarifications and Setup
   - [x] ✅ Database state: Fresh database - no migration needed
   - [x] ✅ Initial sports: Admin creates manually through UI
   - [x] ✅ Sport type: Admin sets type when creating sports (UI interface)
   - [x] ✅ Team size: `team_size` field added, validated during team creation
   - [x] ✅ Caching strategy: 5-10 second TTL, invalidate on Sports collection updates
   - [x] ✅ Frontend constants: Remove immediately (no backward compatibility)

### **Implementation Phases:**
1. **Phase 1:** Create Sport model and basic CRUD APIs
2. **Phase 2:** Update Player model (remove fields, add computation)
3. **Phase 3:** Update participation APIs to use Sports collection
4. **Phase 4:** Update EventSchedule model and APIs
5. **Phase 4.5:** Create PointsTable model and APIs
6. **Phase 5:** Update frontend components
7. **Phase 6:** Update remaining APIs (export, counts, etc.)
8. **Phase 7:** Remove hardcoded constants and cleanup

