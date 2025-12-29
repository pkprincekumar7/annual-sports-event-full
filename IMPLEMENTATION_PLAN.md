# Implementation Plan: Sports Collection & Multi-Team/Multi-Player Support

## Overview
This document outlines the plan to implement a dynamic Sports collection, support new sport types (dual_team, multi_team, dual_player, multi_player), and add support for multi-team and multi-player matches. This is a fresh implementation with a new database, so no backward compatibility or migration is needed.

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
1. **Sports Collection**: Dynamic sports stored in database
2. **EventSchedule Model**: 
   - Support `teams` array (for multi_team)
   - Support `players` array (for multi_player)
   - Update `sport_type` to use Sports collection's `type` field
3. **Player Model**: 
   - Remove `participated_in` and `captain_in` from storage
   - Compute these fields dynamically from Sports collection in API responses
4. **Frontend**: Fetch sports dynamically from API instead of hardcoded data

---

## Implementation Plan

### Phase 1: Create Sports Model & Collection

#### 1.1 Create Sports Model (`models/Sport.js`)
```javascript
{
  name: String (required, unique, lowercase before save)
  type: String (required, enum: ['dual_team', 'multi_team', 'dual_player', 'multi_player'])
  category: String (required, enum: ['team events', 'individual events', 'literary and cultural activities'])
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
- `teams_participated` only populated for `dual_team` and `multi_team` types
- `teams_participated[].players` array contains all player reg_numbers in that team
- `players_participated` only populated for `dual_player` and `multi_player` types
- Add indexes: `{ name: 1 }` (unique), `{ type: 1 }`, `{ category: 1 }`

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
- `sports_name` references the Sport document's name field
- `teams` array used for `dual_team` and `multi_team` sport types
- `players` array used for `dual_player` and `multi_player` sport types
- `winner` field used for `dual_team` and `dual_player` (single winner/loser)
- `qualifiers` array used for `multi_team` and `multi_player` (multiple positions: 1st, 2nd, 3rd, etc.)
- Only one of `winner` or `qualifiers` should be populated based on sport type
- Compound unique index: `{ sports_name: 1, match_number: 1 }` to ensure unique match numbers per sport
- Index on `sports_name` and `status` for efficient queries

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
- Points are only tracked for **league matches** (not for knockout or final matches)
- League matches are **only applicable for `dual_team` and `dual_player`** sports
- Points table is not applicable for `multi_team` and `multi_player` sports (they don't have league matches)
- Point calculation rules:
  - **Winner**: 2 points
  - **Loser**: 0 points
  - **Draw**: 1 point each participant
  - **Cancelled**: 1 point each participant
- Compound unique index: `{ sports_name: 1, participant: 1 }` to ensure one record per participant per sport
- Index on `sports_name` and `points` for efficient queries and sorting
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

#### 3.1 Remove Stored Fields
- Remove `participated_in` and `captain_in` from Player schema
- These will be computed dynamically from Sports collection

#### 3.2 Compute Fields in API Responses
Create a helper function to compute `participated_in` and `captain_in` from Sports collection:

```javascript
async function computePlayerParticipation(playerRegNumber) {
  // Find all sports where player is a captain, team member, or individual participant
  const sports = await Sport.find({
    $or: [
      { 'teams_participated.captain': playerRegNumber },
      { 'teams_participated.players': playerRegNumber },
      { 'players_participated': playerRegNumber }
    ]
  }).lean()
  
  const participated_in = []
  const captain_in = []
  
  sports.forEach(sport => {
    // Check if captain
    const captainTeam = sport.teams_participated.find(
      team => team.captain === playerRegNumber
    )
    if (captainTeam) {
      captain_in.push(sport.name)
      // Also add to participated_in with team_name
      participated_in.push({
        sport: sport.name,
        team_name: captainTeam.team_name
      })
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
        if (sport.players_participated.includes(playerRegNumber)) {
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
- With `teams_participated[].players` array, team membership lookup is straightforward
- Single query to Sports collection gets all participation data
- Efficient computation without denormalization

#### 3.3 Update All Player API Endpoints
- `GET /api/players` - Add computed fields
- `GET /api/me` - Add computed fields
- `POST /api/login` - Add computed fields to response
- Any other endpoint returning player data

---

### Phase 4: Update Backend API Endpoints

#### 4.1 Sports Management APIs (New)
- `GET /api/sports` - Get all sports (admin only, or public for display)
- `POST /api/sports` - Create new sport (admin only)
- `PUT /api/sports/:id` - Update sport (admin only)
- `DELETE /api/sports/:id` - Delete sport (admin only)
  - Validate that no matches exist for this sport (reject deletion if matches found)
  - Validate that no points table entries exist for this sport
- `GET /api/sports/:name` - Get sport by name

#### 4.2 Update Existing APIs

**`GET /api/sports-counts`**
- Query Sports collection instead of hardcoded arrays
- Group by sport type and category

**`POST /api/event-schedule`**
- Validate sport exists in Sports collection
- Get sport type from Sports collection
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
- Return all matches for the sport
- Include qualifiers array for multi_team/multi_player matches
- Filter out knocked out participants when determining eligible teams/players for next match

**`GET /api/event-schedule/:sport/teams-players`**
- Get teams from Sports collection's `teams_participated`
- Get players from Sports collection's `players_participated`
- Exclude teams/players that have been knocked out in previous matches
- For knockout matches: Only return participants who haven't lost any completed match

**`POST /api/update-team-participation`**
- Update Sports collection's `teams_participated` array
- Add/update team with `team_name`, `captain`, and `players` array
- Ensure all players in `players` array are valid player reg_numbers

**`POST /api/update-participation`**
- Update Sports collection's `players_participated` array
- Add/remove player reg_numbers for individual/cultural events

**`POST /api/add-captain`**
- Update Sports collection's `teams_participated[].captain` field
- Validate captain is in the team's `players` array

**`GET /api/teams/:sport`**
- Query Sports collection instead of Player collection

**`GET /api/participants/:sport`**
- Query Sports collection's `players_participated` array

**`GET /api/export-excel`**
- Query Sports collection to get all sports dynamically
- Compute participation from Sports collection

**Points Table APIs (New)**
- `GET /api/points-table/:sport` - Get points table for a specific sport (sorted by points descending)
  - Returns all participants with their points, matches played, won, lost, draw, cancelled
  - Admin can use this to determine knockout match participants
  - Only shows participants who have played at least one league match
- `GET /api/points-table/:sport/:participant` - Get points for a specific participant in a sport
- Points table is automatically updated when league match results are updated
- Points table is only applicable for league matches (not knockout or final)

---

### Phase 5: Frontend Updates

#### 5.1 Remove Hardcoded Sports
- Remove `sportsData` object from `SportsSection.jsx`
- Fetch sports from API endpoint

#### 5.2 Update SportsSection Component
- Add API call: `GET /api/sports` (public or authenticated)
- Group sports by `category` field
- Display sports dynamically
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
- Update team/player registration logic

#### 5.5 Update SportDetailsModal
- Fetch sport details from API
- Display sport information dynamically

---

## Implementation Order (Recommended)

### Step 1: Create Sports Model & Basic APIs
1. Create `models/Sport.js` with full schema including `players` array in `teams_participated`
2. Create basic CRUD APIs for Sports (`GET`, `POST`, `PUT`, `DELETE`)
3. Admin can create sports through API (no hardcoded sports)

### Step 2: Update Player Model
1. Remove `participated_in` and `captain_in` fields from Player schema
2. Create helper function to compute these fields from Sports collection
3. Update all player API endpoints to include computed fields

### Step 3: Update Participation Logic
1. Update `POST /api/update-participation` to update Sports collection's `players_participated`
2. Update `POST /api/update-team-participation` to update Sports collection's `teams_participated` (including `players` array)
3. Update `POST /api/add-captain` to update Sports collection's `teams_participated[].captain`
4. Ensure captain is always in the team's `players` array

### Step 4: Update EventSchedule Model
1. Update EventSchedule schema to new format:
   - Add `qualifiers` array for multi_team/multi_player
   - Keep `winner` for dual_team/dual_player
   - Add `match_type: 'final'` to enum
   - Change `sport` field to `sports_name` (to reference Sport.name)
   - Add compound unique index: `{ sports_name: 1, match_number: 1 }` to ensure unique match numbers per sport
   - Add index on `sports_name` and `status` for efficient queries
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
1. Create `models/PointsTable.js` with schema
2. Create helper function to update points when league match results are updated (dual_team/dual_player only)
3. Create `GET /api/points-table/:sport` endpoint to retrieve points table (sorted by points descending)
4. Create `GET /api/points-table/:sport/:participant` endpoint to get specific participant's points
5. Integrate points update logic into `PUT /api/event-schedule/:id` endpoint (only for league matches of dual types)
6. Points table entries are auto-created when league matches are scheduled or results updated

### Step 5: Update Frontend
1. Create API service to fetch sports dynamically
2. Update SportsSection to fetch and display sports from API (grouped by category)
3. Update EventScheduleModal:
   - Support selecting multiple teams/players for multi types
   - Add validation for match_type 'final'
   - Handle arrays instead of single values
   - **Match Result UI:**
     - For dual types: "Winner" button functionality
     - For multi types: "Qualified" buttons with position tracking (1st, 2nd, 3rd, etc.)
     - "Freeze" button to knock out remaining participants
     - "Save Result" button to finalize
   - Show appropriate messages for 'final' match scenarios
4. Update RegisterModal for all sport types
5. Remove all hardcoded sports data

### Step 6: Update All Other APIs
1. Update `GET /api/sports-counts` to query Sports collection
2. Update `GET /api/teams/:sport` to query Sports collection
3. Update `GET /api/participants/:sport` to query Sports collection
4. Update `GET /api/event-schedule/:sport/teams-players` to use Sports collection
5. Update `GET /api/export-excel` to use Sports collection dynamically
6. Remove all hardcoded sport arrays from backend

---

## Key Considerations

### 1. Performance
- Index Sports collection properly
- Cache sports list if needed (Redis or in-memory)
- Optimize participation computation (consider denormalization)

### 2. Data Integrity
- Validate team/player references in Sports collection
- Ensure captains are valid players
- Ensure teams/players in EventSchedule exist in Sports collection
- Ensure points table entries match participants in Sports collection
- Validate points calculations are correct (winner: 2, loser: 0, draw/cancelled: 1 each)
- Ensure points are only updated for league matches (not knockout or final)

### 3. Team Membership Tracking
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

### 4. League vs Knockout Match Restrictions

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

### 5. Match Type 'final' and Qualifiers

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

## Questions to Resolve

1. **Performance:** Do we need caching for Sports collection? (Consider if sports list is frequently accessed)
2. **Validation:** Should EventSchedule validate teams/players exist in Sports collection at creation time? (Yes - required for data integrity)
3. **Final Match Logic:** Should the system automatically detect when a match should be 'final', or is it manual selection by admin?
4. **Team Size Limits:** Should there be minimum/maximum team sizes for multi_team events?

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

