# Codebase Changes Analysis

This document outlines all the changes needed in the existing codebase to implement the new Sports Collection & Multi-Team/Multi-Player Support system.

## Backend Changes

### 1. New Models to Create

#### `models/Sport.js` (NEW)
- **Create new file** with schema:
  - `name`: String (required, unique, lowercase before save)
  - `type`: enum ['dual_team', 'multi_team', 'dual_player', 'multi_player']
  - `category`: enum ['team events', 'individual events', 'literary and cultural activities']
  - `teams_participated`: Array of objects with `team_name`, `captain`, `players[]`
  - `players_participated`: Array of player reg_numbers
  - Indexes: `{ name: 1 }` (unique), `{ type: 1 }`, `{ category: 1 }`
  - **Pre-save hook:** Convert `name` to lowercase before saving

#### `models/PointsTable.js` (NEW)
- **Create new file** with schema:
  - `sports_name`: String (required)
  - `participant`: String (required)
  - `participant_type`: enum ['team', 'player']
  - `points`: Number (default: 0)
  - `matches_played`, `matches_won`, `matches_lost`, `matches_draw`, `matches_cancelled`: Numbers
  - Compound unique index: `{ sports_name: 1, participant: 1 }`
  - Index: `{ sports_name: 1, points: 1 }`

### 2. Models to Update

#### `models/EventSchedule.js` (MODIFY)
**Current fields to REMOVE:**
- `sport` (change to `sports_name`)
- `sport_type` (remove - will get from Sport collection)
- `team_one`, `team_two` (replace with `teams` array)
- `player_one`, `player_two` (replace with `players` array)

**New fields to ADD:**
- `sports_name`: String (required) - references Sport.name
- `teams`: [String] - array of team names
- `players`: [String] - array of player reg_numbers
- `qualifiers`: [{ participant: String, position: Number }] - for multi types
- `match_type`: Add 'final' to enum (currently only 'league', 'knockout')

**Indexes to UPDATE:**
- Change `{ sport: 1, match_number: 1 }` to `{ sports_name: 1, match_number: 1 }`
- Change `{ sport: 1 }` to `{ sports_name: 1 }`
- Change `{ sport: 1, status: 1 }` to `{ sports_name: 1, status: 1 }`

#### `models/Player.js` (MODIFY)
**Fields to REMOVE:**
- `participated_in` array (entire field)
- `captain_in` array (entire field)

**Indexes to REMOVE:**
- `{ captain_in: 1 }`
- `{ 'participated_in.sport': 1, 'participated_in.team_name': 1 }`
- `{ 'participated_in.sport': 1 }`

**Note:** These fields will be computed dynamically in API responses using a helper function.

### 3. New API Endpoints to Create

#### Sports Management APIs
- `GET /api/sports` - Get all sports (public or authenticated)
- `POST /api/sports` - Create new sport (admin only)
- `PUT /api/sports/:id` - Update sport (admin only)
- `DELETE /api/sports/:id` - Delete sport (admin only) - with validation
- `GET /api/sports/:name` - Get sport by name

#### Points Table APIs
- `GET /api/points-table/:sport` - Get points table for a sport (sorted by points)
- `GET /api/points-table/:sport/:participant` - Get specific participant's points

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
- Remove `sport_type` from request body (get from Sport collection)
- Change `team_one`, `team_two` to `teams` array
- Change `player_one`, `player_two` to `players` array
- Add validation for multi types (> 2 participants)
- Add validation for `match_type: 'final'`:
  - Dual types: MUST be 'final' when exactly 2 eligible participants
  - Multi types: Can be 'final' when all eligible participants (optional)
- Add league vs knockout restrictions validation:
  - If scheduling league: Check no knockout matches exist (any status)
  - If scheduling knockout/final: Check date is after all league matches
- Validate sport exists in Sports collection
- Validate teams/players exist in Sport's participation arrays
- Validate all teams/players in arrays are unique (no duplicates)
- Prevent scheduling if 'final' match with status 'completed' exists
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
- Change query from `sport` to `sports_name`
- Include `qualifiers` array in response for multi types
- Filter out knocked out participants

#### `GET /api/event-schedule/:sport/teams-players` (Line 2803)
**Major Changes:**
- Query Sports collection instead of Player collection
- Get teams from `Sport.teams_participated`
- Get players from `Sport.players_participated`
- Exclude knocked out participants
- Filter by eligible participants only

#### `POST /api/update-team-participation` (Line 699)
**Major Changes:**
- Update `Sport.teams_participated` array instead of `Player.participated_in`
- Include `players` array in team object
- Ensure captain is in `players` array (validate captain is a valid player reg_number)
- Ensure all players in `players` array are valid player reg_numbers
- Remove all Player collection updates

#### `POST /api/update-participation` (Line 1023)
**Major Changes:**
- Update `Sport.players_participated` array instead of `Player.participated_in`
- Remove all Player collection updates

#### `POST /api/add-captain` (Line 196)
**Major Changes:**
- Update `Sport.teams_participated[].captain` instead of `Player.captain_in`
- Validate captain is in team's `players` array
- Remove Player collection updates

#### `DELETE /api/remove-captain` (Line 371)
**Major Changes:**
- Update `Sport.teams_participated[].captain` instead of `Player.captain_in`
- Remove Player collection updates

#### `GET /api/teams/:sport` (Line 1530)
**Changes:**
- Query Sports collection's `teams_participated` instead of Player collection
- Return teams from Sport document

#### `GET /api/participants/:sport` (Line 1780)
**Changes:**
- Query Sports collection's `players_participated` instead of Player collection

#### `GET /api/export-excel` (Line 2257)
**Major Changes:**
- Remove hardcoded `sportColumns` array (lines 2264-2291)
- Remove hardcoded `teamSports` array (lines 2294-2302)
- Query Sports collection dynamically
- Compute participation from Sports collection
- Generate columns dynamically based on Sports collection

#### `GET /api/players` (Line 157)
**Changes:**
- Add computed `participated_in` and `captain_in` fields using helper function
- Remove query for stored fields (they no longer exist)

#### `GET /api/me` (Line 136)
**Changes:**
- Add computed `participated_in` and `captain_in` fields using helper function

#### `POST /api/login` (Line 1147)
**Changes:**
- Add computed `participated_in` and `captain_in` fields to response

#### `POST /api/save-player` (Line 1220)
**Changes:**
- Remove `participated_in` and `captain_in` from request body validation
- Remove these fields from Player creation

#### `POST /api/save-players` (Line 1331)
**Changes:**
- Remove `participated_in` and `captain_in` from validation
- Remove these fields from Player creation

#### `PUT /api/update-player` (Line 2151)
**Changes:**
- Remove `participated_in` and `captain_in` from update logic

#### `DELETE /api/remove-participation` (Line 1464)
**Major Changes:**
- Update Sports collection instead of Player collection
- Remove from `Sport.teams_participated` or `Sport.players_participated`

#### `POST /api/delete-team` (Line 2073)
**Major Changes:**
- Update Sports collection's `teams_participated` array
- Remove team from Sport document

#### `POST /api/update-team-player` (Line 1836)
**Major Changes:**
- Update `Sport.teams_participated[].players` array
- Remove Player collection updates

#### `DELETE /api/event-schedule/:id` (Line 2632)
**Changes:**
- Update query from `sport` to `sports_name` if needed
- **Points table cleanup:**
  - If deleted match was a league match (match_type === 'league'):
    - Revert points adjustments for all participants in the match
    - Decrement match counters (matches_played, matches_won, matches_lost, matches_draw, matches_cancelled)
    - If match had status 'completed', 'draw', or 'cancelled', adjust points accordingly
- Update any references to old schema fields

#### `GET /api/participants-count/:sport` (Line 1720)
**Changes:**
- Query Sports collection's `players_participated` array instead of Player collection
- Count from `Sport.players_participated.length` for the sport

#### `GET /api/captains-by-sport` (Line 467)
**Major Changes:**
- Query Sports collection's `teams_participated[].captain` instead of Player collection
- Return captains from Sport document's teams_participated array

#### `POST /api/validate-participations` (Line 524)
**Major Changes:**
- Update validation logic to check Sports collection instead of Player collection
- Validate against `Sport.teams_participated` and `Sport.players_participated`
- Remove Player collection participation checks

### 5. Helper Functions to Create

#### `computePlayerParticipation(playerRegNumber)`
**Location:** Create in `server.js` or separate utility file
**Purpose:** Compute `participated_in` and `captain_in` from Sports collection
**Logic:**
- Query Sports collection for player as captain, team member, or individual participant
- Build `participated_in` array with sport and team_name
- Build `captain_in` array with sport names

#### `updatePointsTable(match, previousStatus)`
**Location:** Create in `server.js` or separate utility file
**Purpose:** Update points table when league match results change
**Logic:**
- Only for `match_type === 'league'` and dual types
- **Auto-create entries:** Create points table entries for all participants if they don't exist
- Adjust points based on status change
- Track previous status for correct adjustments
- Update match counters (matches_played, matches_won, matches_lost, matches_draw, matches_cancelled)
- Points table entries are created automatically when:
  - A league match is scheduled (create entries for all participants if they don't exist)
  - Or when first league match result is updated

### 6. Code to Remove from Backend

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

**Changes Needed:**
- **Update:** Get sport details from API (`GET /api/sports/:name`)
- **Update:** Handle all sport types (dual_team, multi_team, dual_player, multi_player)
- **Update:** Registration logic for multi types
- **Update:** Team registration to include `players` array
- **Update:** API calls to update Sports collection instead of Player collection

**Key Changes:**
- Line 16: `isTeam` check - update to use `sport.type`
- Line 75-150: Player fetching and team registration logic
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
- **Update:** Fetch participants from Sports collection
- **Update:** Display from `Sport.players_participated` or `Sport.teams_participated`

### 2. API Utility Updates

#### `src/utils/api.js` (MINOR UPDATE)
**Changes Needed:**
- No major changes, but ensure all API calls use correct endpoints
- Update any hardcoded sport references if present

### 3. Code to Remove from Frontend

**Hardcoded Sports Data:**
- `src/components/SportsSection.jsx`: Remove `sportsData` object (lines 5-38)

**Old Field References:**
- Remove all references to `sport_type` ('team', 'individual', 'cultural')
- Replace with `sport.type` from API ('dual_team', 'multi_team', etc.)
- Remove all references to `team_one`, `team_two`
- Remove all references to `player_one`, `player_two`

### 4. Optional Frontend Features

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
1. **Create 2 new models:** Sport, PointsTable
2. **Update 2 existing models:** EventSchedule, Player
3. **Create 6 new API endpoints:** 
   - Sports Management: POST /api/sports, PUT /api/sports/:id, DELETE /api/sports/:id, GET /api/sports/:name
   - Points Table: GET /api/points-table/:sport, GET /api/points-table/:sport/:participant
4. **Update 27 existing API endpoints:** Major refactoring required (including GET /api/sports which needs logic update)
5. **Create 2 helper functions:** computePlayerParticipation, updatePointsTable
6. **Remove:** All hardcoded sports arrays, Player participation storage

### Frontend Summary:
1. **Update 8+ components:** Major changes to SportsSection, EventScheduleModal, RegisterModal
2. **Remove:** Hardcoded sports data
3. **Add:** Dynamic sports fetching, multi-participant selection, qualifiers UI

### Key Breaking Changes:
- EventSchedule schema completely changes (old data incompatible)
- Player schema changes (participated_in, captain_in removed)
- All API request/response formats change
- Frontend completely changes how sports are displayed and managed

### Migration Note:
Since using a new database, no migration scripts needed. All changes can be implemented directly.

---

## Implementation Priority

1. **Phase 1:** Create Sport model and basic CRUD APIs
2. **Phase 2:** Update Player model (remove fields, add computation)
3. **Phase 3:** Update participation APIs to use Sports collection
4. **Phase 4:** Update EventSchedule model and APIs
5. **Phase 5:** Create PointsTable model and APIs
6. **Phase 6:** Update frontend components
7. **Phase 7:** Update remaining APIs (export, counts, etc.)

