# Cache Invalidation Matrix

This document summarizes cache invalidation coverage for both backend
(server-side in-memory cache) and frontend (client request cache).

## Backend Cache Invalidation Matrix

### Players / Auth
- Reads: `/api/players`, `/api/me`, `/api/batches`
- Writes:
  - `POST /api/register`
  - `PUT /api/update-player`
  - `DELETE /api/delete-player/:reg_number`
  - `POST /api/bulk-delete-players`
- Clears:
  - `/api/players*`, `/api/me*`, `/api/batches?event_id=...`, `/api/teams*`
  - For delete flows: `/api/sports`, `/api/sports/:sport`,
    `/api/participants/:sport`, `/api/participants-count/:sport`,
    `/api/sports-counts` (per affected sport)
  - Player gender cache

### Teams / Team Participation
- Reads: `/api/teams/:sport`, `/api/sports`, `/api/sports/:sport`, `/api/sports-counts`
- Writes:
  - `POST /api/update-team-participation`
  - `POST /api/update-team-player`
  - `DELETE /api/delete-team`
- Clears:
  - `/api/sports?event_id=...`, `/api/sports/:sport?event_id=...`,
    `/api/teams/:sport?event_id=...`, `/api/sports-counts?event_id=...`
  - `/api/players*`, `/api/me*`
  - Team gender cache

### Participation (Individual)
- Reads: `/api/participants/:sport`, `/api/participants-count/:sport`,
  `/api/sports`, `/api/sports-counts`
- Writes:
  - `POST /api/update-participation`
  - `DELETE /api/remove-participation`
- Clears:
  - `/api/sports?event_id=...`, `/api/sports/:sport?event_id=...`
  - `/api/participants/:sport?event_id=...`,
    `/api/participants-count/:sport?event_id=...`
  - `/api/sports-counts?event_id=...`
  - `/api/players*`, `/api/me*`

### Sports
- Reads: `/api/sports`, `/api/sports/:sport`, `/api/sports-counts`
- Writes:
  - `POST /api/sports`
  - `PUT /api/sports/:id`
  - `DELETE /api/sports/:id`
- Clears:
  - `/api/sports*`, `/api/sports-counts*`

### Event Schedule / Points
- Reads:
  - `/api/event-schedule/:sport`
  - `/api/event-schedule/:sport/teams-players`
  - `/api/points-table/:sport`
- Writes:
  - `POST /api/event-schedule`
  - `PUT /api/event-schedule/:id`
  - `DELETE /api/event-schedule/:id`
- Clears:
  - `/api/event-schedule/:sport?event_id=...`
  - `/api/event-schedule/:sport?event_id=...&gender=...`
  - `/api/event-schedule/:sport/teams-players?event_id=...&gender=...`
  - `/api/points-table/:sport?event_id=...&gender=...` (league only)

### Points Table Backfill
- Reads: `/api/points-table/:sport`
- Writes:
  - `POST /api/points-table/backfill/:sport`
- Clears:
  - `/api/points-table/:sport?event_id=...&gender=Male|Female`

### Batches
- Reads: `/api/batches`
- Writes:
  - `POST /api/add-batch`
  - `DELETE /api/remove-batch`
- Clears:
  - `/api/batches?event_id=...`, `/api/players*`

### Captains / Coordinators
- Reads:
  - `/api/captains-by-sport`, `/api/coordinators-by-sport`
  - `/api/sports`, `/api/players`, `/api/me`
- Writes:
  - `POST /api/add-captain`, `DELETE /api/remove-captain`
  - `POST /api/add-coordinator`, `DELETE /api/remove-coordinator`
- Clears:
  - `/api/sports?event_id=...`, `/api/sports/:sport?event_id=...`
  - `/api/players*`, `/api/me*`

### Departments
- Reads: `/api/departments`
- Writes:
  - `POST /api/departments`
  - `PUT /api/departments/:id`
  - `DELETE /api/departments/:id`
- Clears:
  - `/api/departments`

### Event Years
- Reads: `/api/event-years/active`
- Writes:
  - `POST /api/event-years`
  - `PUT /api/event-years/:event_id`
  - `DELETE /api/event-years/:event_id`
- Clears:
  - `/api/event-years/active`

## Frontend Cache Invalidation Matrix

### Shared Helpers (`src/utils/cacheHelpers.js`)
- `clearSportCaches` clears:
  - `/api/teams/:sport`, `/api/participants/:sport`,
    `/api/participants-count/:sport`, `/api/event-schedule/:sport`,
    `/api/event-schedule/:sport/teams-players`, `/api/sports-counts`
- `clearTeamParticipationCaches` clears:
  - All `clearSportCaches` keys
  - `/api/players*`, `/api/me*`, `/api/sports-counts*`, `/api/event-schedule*`
- `clearIndividualParticipationCaches` clears:
  - All `clearSportCaches` keys
  - `/api/players*`, `/api/me*`, `/api/sports-counts*`, `/api/event-schedule*`
- `clearSportManagementCaches` clears:
  - `/api/sports`, `/api/sports-counts`

### Player Updates (`PlayerListModal`)
- Writes: `PUT /api/update-player`
- Clears:
  - `/api/players*`, `/api/teams*`, `/api/participants*`,
    `/api/sports-counts*`, `/api/event-schedule*`

### Team Updates / Deletes (`TeamDetailsModal`)
- Writes:
  - `POST /api/update-team-player`
  - `DELETE /api/delete-team`
- Clears:
  - `/api/me*`, `/api/players*`
  - plus shared helper clears during participation changes

### Schedule Updates (`EventScheduleModal`)
- Writes: create/update/delete matches
- Clears:
  - `/api/event-schedule/:sport` (base + gender)
  - `/api/event-schedule/:sport/teams-players` (gender)
  - `/api/points-table/:sport` (gender)

### Batch / Captain / Coordinator Management
- Writes: batch add/remove, captain/coordinator add/remove
- Clears:
  - `/api/batches`, `/api/players*`, `/api/me*`, `/api/sports`

