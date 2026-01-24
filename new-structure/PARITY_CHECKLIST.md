## Verification status (Jan 22, 2026)

Legend:
- VERIFIED: behavior matches Node.js
- PYTHON-ONLY: endpoint added for service boundaries

Identity service
- VERIFIED: POST `/api/login`
- VERIFIED: POST `/api/reset-password`
- VERIFIED: POST `/api/change-password`
- VERIFIED: GET `/api/me`
- VERIFIED: GET `/api/players`
- VERIFIED: POST `/api/save-player`
- VERIFIED: PUT `/api/update-player`
- VERIFIED: DELETE `/api/delete-player/:reg_number`
- VERIFIED: POST `/api/bulk-delete-players`
- VERIFIED: POST `/api/bulk-player-enrollments`

Enrollment service
- VERIFIED: GET `/api/batches`
- VERIFIED: POST `/api/add-batch`
- VERIFIED: DELETE `/api/remove-batch`
- PYTHON-ONLY: POST `/api/batches/assign-player`
- PYTHON-ONLY: POST `/api/batches/unassign-player`
- PYTHON-ONLY: POST `/api/batches/unassign-players`

Organization service
- VERIFIED: GET `/api/departments`
- VERIFIED: POST `/api/departments`
- VERIFIED: PUT `/api/departments/:id`
- VERIFIED: DELETE `/api/departments/:id`

Sports participation service
- VERIFIED: GET `/api/sports`
- VERIFIED: GET `/api/sports/:name`
- VERIFIED: POST `/api/sports`
- VERIFIED: PUT `/api/sports/:id`
- VERIFIED: DELETE `/api/sports/:id`
- VERIFIED: GET `/api/sports-counts`
- VERIFIED: POST `/api/add-coordinator`
- VERIFIED: DELETE `/api/remove-coordinator`
- VERIFIED: GET `/api/coordinators-by-sport`
- VERIFIED: POST `/api/add-captain`
- VERIFIED: DELETE `/api/remove-captain`
- VERIFIED: GET `/api/captains-by-sport`
- VERIFIED: POST `/api/update-team-participation`
- VERIFIED: GET `/api/teams/:sport`
- VERIFIED: POST `/api/update-team-player`
- VERIFIED: DELETE `/api/delete-team`
- VERIFIED: POST `/api/validate-participations`
- VERIFIED: GET `/api/participants/:sport`
- VERIFIED: GET `/api/participants-count/:sport`
- VERIFIED: POST `/api/update-participation`
- VERIFIED: DELETE `/api/remove-participation`
- VERIFIED: GET `/api/player-enrollments/:reg_number`

Event configuration service
- VERIFIED: GET `/api/event-years`
- VERIFIED: GET `/api/event-years/active`
- VERIFIED: POST `/api/event-years`
- VERIFIED: PUT `/api/event-years/:event_id`
- VERIFIED: DELETE `/api/event-years/:event_id`

Scheduling service
- VERIFIED: GET `/api/event-schedule/:sport`
- VERIFIED: GET `/api/event-schedule/:sport/teams-players`
- VERIFIED: POST `/api/event-schedule`
- VERIFIED: PUT `/api/event-schedule/:id`
- VERIFIED: DELETE `/api/event-schedule/:id`

Scoring service
- VERIFIED: GET `/api/points-table/:sport`
- VERIFIED: POST `/api/points-table/backfill/:sport`
- PYTHON-ONLY: POST `/api/internal/points-table/update`

Reporting service
- VERIFIED: GET `/api/export-excel`

## Node vs Python parity checklist

Use this checklist to compare the Node.js monolith routes with the FastAPI
microservices. For each endpoint, verify method/path, auth/roles, date
restrictions, request validation, response shape, status codes, cache
invalidation, and side-effects.

Legend:
- Node route source: `routes/*.js`
- Python service source: `new-structure/<service>/app/routers/*.py`

### Identity service (Player + Auth)

#### POST /api/login
- [ ] Node: `routes/auth.js` | Python: `identity-service/app/routers/auth.py`
- [ ] Auth: public (no token required)
- [ ] Date checks: none
- [ ] Request fields: `reg_number`, `password`
- [ ] Response shape: JWT + player object + `change_password_required`
- [ ] Computed fields included: `participated_in`, `captain_in`, `coordinator_in`, `batch_name`

#### POST /api/reset-password
- [ ] Node: `routes/auth.js` | Python: `identity-service/app/routers/auth.py`
- [ ] Auth: public
- [ ] Date checks: none
- [ ] Request fields: `reg_number`, `email_id`
- [ ] Response: always success message (no user enumeration)
- [ ] Side effects: password reset + `change_password_required` set

#### POST /api/change-password
- [ ] Node: `routes/auth.js` | Python: `identity-service/app/routers/auth.py`
- [ ] Auth: authenticated
- [ ] Date checks: none
- [ ] Validations: current password required, new password != current
- [ ] Response: success message, `change_password_required` cleared

#### GET /api/me
- [ ] Node: `routes/players.js` | Python: `identity-service/app/routers/players.py`
- [ ] Auth: authenticated
- [ ] Date checks: none
- [ ] Event handling: optional `event_id` query (defaults to active)
- [ ] Response: `player` object with computed fields + batch name

#### GET /api/players
- [ ] Node: `routes/players.js` | Python: `identity-service/app/routers/players.py`
- [ ] Auth: authenticated
- [ ] Date checks: none
- [ ] Event handling: optional `event_id` query (defaults to active)
- [ ] Search: `search` query (reg_number/full_name)
- [ ] Pagination: `page` and `limit` behavior matches Node
- [ ] Response: pagination metadata only when `page` provided

#### POST /api/save-player
- [ ] Node: `routes/players.js` | Python: `identity-service/app/routers/players.py`
- [ ] Auth: public; registration period required
- [ ] Date checks: registration period + registration deadline check
- [ ] Required fields: `batch_name`, `event_id` (resolved via active event)
- [ ] Validations: department exists, unique reg_number, email format
- [ ] Side effects: assign to batch via Enrollment service
- [ ] Rollback: delete player if batch assignment fails
- [ ] Response shape/status codes match Node

#### PUT /api/update-player
- [ ] Node: `routes/players.js` | Python: `identity-service/app/routers/players.py`
- [ ] Auth: admin + registration period
- [ ] Date checks: registration period + deadline check
- [ ] Validations: immutable fields, department validation
- [ ] Response shape/status codes match Node

#### DELETE /api/delete-player/:reg_number
- [ ] Node: `routes/players.js` | Python: `identity-service/app/routers/players.py`
- [ ] Auth: admin + registration period
- [ ] Date checks: registration period + deadline check
- [ ] Side effects: unassign from batches + remove enrollments
- [ ] Response shape/status codes match Node

#### POST /api/bulk-delete-players
- [ ] Node: `routes/players.js` | Python: `identity-service/app/routers/players.py`
- [ ] Auth: admin + registration period
- [ ] Date checks: registration period + deadline check
- [ ] Validations: cannot include admin reg number
- [ ] Side effects: unassign from batches
- [ ] Response shape/status codes match Node

#### POST /api/bulk-player-enrollments
- [ ] Node: `routes/players.js` | Python: `identity-service/app/routers/players.py`
- [ ] Auth: admin
- [ ] Date checks: registration deadline check only
- [ ] Response: enrollments + match metadata
- [ ] Response shape/status codes match Node

#### GET /api/player-enrollments/:reg_number
- [ ] Node: `routes/players.js` | Python: `sports-participation-service/app/routers/participants.py`
- [ ] Auth: admin
- [ ] Date checks: none
- [ ] Response: non-team events, teams, matches, flags

### Enrollment service (Batches)

#### GET /api/batches
- [ ] Node: `routes/batches.js` | Python: `enrollment-service/app/routers/batches.py`
- [ ] Auth: public
- [ ] Date checks: none
- [ ] Event handling: optional `event_id` query
- [ ] Response: includes `players` array

#### POST /api/add-batch
- [ ] Node: `routes/batches.js` | Python: `enrollment-service/app/routers/batches.py`
- [ ] Auth: admin + registration period
- [ ] Date checks: registration period + deadline check
- [ ] Required fields: `event_id`, `name`
- [ ] Validations: unique batch name per event
- [ ] Response shape/status codes match Node

#### DELETE /api/remove-batch
- [ ] Node: `routes/batches.js` | Python: `enrollment-service/app/routers/batches.py`
- [ ] Auth: admin + registration period
- [ ] Date checks: registration period + deadline check
- [ ] Validations: no players assigned
- [ ] Response shape/status codes match Node

#### POST /api/batches/assign-player
- [ ] Node: `routes/batches.js` | Python: `enrollment-service/app/routers/batches.py`
- [ ] Auth: registration period only (no auth middleware by design)
- [ ] Date checks: registration period + deadline check
- [ ] Required fields: `event_id`, `name`, `reg_number`
- [ ] Response: updated batch, success message

#### POST /api/batches/unassign-player
- [ ] Node: `routes/batches.js` | Python: `enrollment-service/app/routers/batches.py`
- [ ] Auth: registration period only
- [ ] Date checks: registration period + deadline check
- [ ] Required fields: `event_id`, `name`, `reg_number`
- [ ] Response: updated batch, success message

#### POST /api/batches/unassign-players
- [ ] Node: `routes/batches.js` | Python: `enrollment-service/app/routers/batches.py`
- [ ] Auth: registration period only
- [ ] Date checks: registration period + deadline check
- [ ] Required fields: `event_id`, `reg_numbers`
- [ ] Response: updated batch, success message

### Organization service (Departments)

#### GET /api/departments
- [ ] Node: `routes/departments.js` | Python: `organization-service/app/routers/departments.py`
- [ ] Auth: public
- [ ] Date checks: none
- [ ] Response: includes `player_count` per department

#### POST /api/departments
- [ ] Node: `routes/departments.js` | Python: `organization-service/app/routers/departments.py`
- [ ] Auth: admin
- [ ] Date checks: none (departments exempt)
- [ ] Validations: unique name, reject createdBy/updatedBy
- [ ] Response shape/status codes match Node

#### PUT /api/departments/:id
- [ ] Node: `routes/departments.js` | Python: `organization-service/app/routers/departments.py`
- [ ] Auth: admin
- [ ] Date checks: none
- [ ] Validations: only `display_order` mutable
- [ ] Response shape/status codes match Node

#### DELETE /api/departments/:id
- [ ] Node: `routes/departments.js` | Python: `organization-service/app/routers/departments.py`
- [ ] Auth: admin
- [ ] Date checks: none
- [ ] Validations: block if players exist
- [ ] Response shape/status codes match Node

### Sports participation service (Sports + Captains + Coordinators + Teams + Participants)

#### GET /api/sports
- [ ] Node: `routes/sports.js` | Python: `sports-participation-service/app/routers/sports.py`
- [ ] Auth: public
- [ ] Date checks: none
- [ ] Event handling: optional `event_id` query
- [ ] Response: array (empty if event not found)

#### GET /api/sports/:name
- [ ] Node: `routes/sports.js` | Python: `sports-participation-service/app/routers/sports.py`
- [ ] Auth: public
- [ ] Date checks: none
- [ ] Event handling: optional `event_id` query (defaults active)
- [ ] Response: 404 if not found

#### GET /api/sports-counts
- [ ] Node: `routes/sports.js` | Python: `sports-participation-service/app/routers/sports.py`
- [ ] Auth: authenticated
- [ ] Date checks: none
- [ ] Event handling: optional `event_id` query (defaults active)
- [ ] Response: teams_counts + participants_counts

#### POST /api/sports
- [ ] Node: `routes/sports.js` | Python: `sports-participation-service/app/routers/sports.py`
- [ ] Auth: admin + registration period
- [ ] Date checks: registration period + deadline check
- [ ] Required fields: `event_id`, `name`, `type`, `category`
- [ ] Validations: team_size rules

#### PUT /api/sports/:id
- [ ] Node: `routes/sports.js` | Python: `sports-participation-service/app/routers/sports.py`
- [ ] Auth: admin + registration period
- [ ] Date checks: registration period + deadline check
- [ ] Event handling: optional `event_id` query (validate ownership)
- [ ] Validations: cannot change event_id, team_size logic

#### DELETE /api/sports/:id
- [ ] Node: `routes/sports.js` | Python: `sports-participation-service/app/routers/sports.py`
- [ ] Auth: admin + registration period
- [ ] Date checks: registration period + deadline check
- [ ] Validations: no teams/players/matches/points

#### POST /api/add-coordinator
- [ ] Node: `routes/coordinators.js` | Python: `sports-participation-service/app/routers/coordinators.py`
- [ ] Auth: admin + registration period
- [ ] Date checks: registration period + deadline check
- [ ] Validations: cannot be participant/captain

#### DELETE /api/remove-coordinator
- [ ] Node: `routes/coordinators.js` | Python: `sports-participation-service/app/routers/coordinators.py`
- [ ] Auth: admin + registration period
- [ ] Date checks: registration period + deadline check

#### GET /api/coordinators-by-sport
- [ ] Node: `routes/coordinators.js` | Python: `sports-participation-service/app/routers/coordinators.py`
- [ ] Auth: admin
- [ ] Date checks: none
- [ ] Response: map of sport -> coordinators (with participation fields)

#### POST /api/add-captain
- [ ] Node: `routes/captains.js` | Python: `sports-participation-service/app/routers/captains.py`
- [ ] Auth: admin or assigned coordinator + registration period
- [ ] Date checks: registration period + deadline check
- [ ] Validations: team sport only, not coordinator, not already captain

#### DELETE /api/remove-captain
- [ ] Node: `routes/captains.js` | Python: `sports-participation-service/app/routers/captains.py`
- [ ] Auth: admin or assigned coordinator + registration period
- [ ] Date checks: registration period + deadline check
- [ ] Validations: cannot remove if team already created

#### GET /api/captains-by-sport
- [ ] Node: `routes/captains.js` | Python: `sports-participation-service/app/routers/captains.py`
- [ ] Auth: admin or assigned coordinator
- [ ] Date checks: none
- [ ] Response: map of sport -> captains (with participation fields)

#### POST /api/update-team-participation
- [ ] Node: `routes/teams.js` | Python: `sports-participation-service/app/routers/teams.py`
- [ ] Auth: captain (assigned sport) + registration period
- [ ] Date checks: registration period + deadline check
- [ ] Validations: batch match, gender match, team size, single captain

#### GET /api/teams/:sport
- [ ] Node: `routes/teams.js` | Python: `sports-participation-service/app/routers/teams.py`
- [ ] Auth: authenticated
- [ ] Date checks: none
- [ ] Response: populated players with batch names

#### POST /api/update-team-player
- [ ] Node: `routes/teams.js` | Python: `sports-participation-service/app/routers/teams.py`
- [ ] Auth: admin/coordinator + registration period
- [ ] Date checks: registration period + deadline check
- [ ] Validations: captain immutability, batch/gender checks

#### DELETE /api/delete-team
- [ ] Node: `routes/teams.js` | Python: `sports-participation-service/app/routers/teams.py`
- [ ] Auth: admin/coordinator + registration period
- [ ] Date checks: registration period + deadline check
- [ ] Validations: no match history

#### POST /api/validate-participations
- [ ] Node: `routes/teams.js` | Python: `sports-participation-service/app/routers/teams.py`
- [ ] Auth: authenticated
- [ ] Date checks: deadline check only
- [ ] Validations: no existing team membership

#### GET /api/participants/:sport
- [ ] Node: `routes/participants.js` | Python: `sports-participation-service/app/routers/participants.py`
- [ ] Auth: admin/coordinator (assigned sport)
- [ ] Date checks: none
- [ ] Response: sorted by name, includes count

#### GET /api/participants-count/:sport
- [ ] Node: `routes/participants.js` | Python: `sports-participation-service/app/routers/participants.py`
- [ ] Auth: authenticated
- [ ] Date checks: none

#### POST /api/update-participation
- [ ] Node: `routes/participants.js` | Python: `sports-participation-service/app/routers/participants.py`
- [ ] Auth: self or admin/coordinator + registration period
- [ ] Date checks: registration period + deadline check
- [ ] Validations: sport type, coordinator exclusion

#### DELETE /api/remove-participation
- [ ] Node: `routes/participants.js` | Python: `sports-participation-service/app/routers/participants.py`
- [ ] Auth: admin/coordinator + registration period
- [ ] Date checks: registration period + deadline check
- [ ] Validations: no match history

#### GET /api/player-enrollments/:reg_number
- [ ] Node: `routes/players.js` | Python: `sports-participation-service/app/routers/participants.py`
- [ ] Auth: admin
- [ ] Date checks: none
- [ ] Response: nonTeamEvents, teams, matches, flags

### Event configuration service (Event years)

#### GET /api/event-years
- [ ] Node: `routes/eventYears.js` | Python: `event-configuration-service/app/routers/event_years.py`
- [ ] Auth: authenticated
- [ ] Date checks: none
- [ ] Response: `is_active` computed

#### GET /api/event-years/active
- [ ] Node: `routes/eventYears.js` | Python: `event-configuration-service/app/routers/event_years.py`
- [ ] Auth: public
- [ ] Date checks: none
- [ ] Response: `{ success, eventYear }`, `eventYear` can be null

#### POST /api/event-years
- [ ] Node: `routes/eventYears.js` | Python: `event-configuration-service/app/routers/event_years.py`
- [ ] Auth: admin
- [ ] Date checks: create allowed even when no active year
- [ ] Validations: date relationships + not in past

#### PUT /api/event-years/:event_id
- [ ] Node: `routes/eventYears.js` | Python: `event-configuration-service/app/routers/event_years.py`
- [ ] Auth: admin
- [ ] Date checks: allowed until registration end date
- [ ] Validations: date field restrictions
- [ ] Event ID behavior: remains stable after event name update

#### DELETE /api/event-years/:event_id
- [ ] Node: `routes/eventYears.js` | Python: `event-configuration-service/app/routers/event_years.py`
- [ ] Auth: admin
- [ ] Date checks: only before registration start date
- [ ] Validations: not active, no data exists

### Scheduling service (Event schedule)

#### GET /api/event-schedule/:sport
- [ ] Node: `routes/eventSchedule.js` | Python: `scheduling-service/app/routers/event_schedule.py`
- [ ] Auth: authenticated
- [ ] Date checks: none
- [ ] Optional `gender` query filters derived gender

#### GET /api/event-schedule/:sport/teams-players
- [ ] Node: `routes/eventSchedule.js` | Python: `scheduling-service/app/routers/event_schedule.py`
- [ ] Auth: admin/coordinator (assigned sport)
- [ ] Date checks: none
- [ ] Required `gender` query
- [ ] Validations: exclude knocked out + already scheduled

#### POST /api/event-schedule
- [ ] Node: `routes/eventSchedule.js` | Python: `scheduling-service/app/routers/event_schedule.py`
- [ ] Auth: admin/coordinator (assigned sport)
- [ ] Date checks: event period + match date within event range
- [ ] Validations: match type rules, league/knockout/final sequencing
- [ ] Derived gender used for caching and validation

#### PUT /api/event-schedule/:id
- [ ] Node: `routes/eventSchedule.js` | Python: `scheduling-service/app/routers/event_schedule.py`
- [ ] Auth: admin/coordinator (assigned sport)
- [ ] Date checks: event status update period
- [ ] Validations: winner/qualifiers, status transitions, date range
- [ ] Side effect: points table update via Scoring service

#### DELETE /api/event-schedule/:id
- [ ] Node: `routes/eventSchedule.js` | Python: `scheduling-service/app/routers/event_schedule.py`
- [ ] Auth: admin/coordinator (assigned sport)
- [ ] Date checks: event period
- [ ] Validations: only scheduled matches can be deleted

### Scoring service (Points table)

#### GET /api/points-table/:sport
- [ ] Node: `routes/pointsTable.js` | Python: `scoring-service/app/routers/points_table.py`
- [ ] Auth: authenticated
- [ ] Date checks: none
- [ ] Required `gender` query parameter
- [ ] Response: includes `has_league_matches`

#### POST /api/points-table/backfill/:sport
- [ ] Node: `routes/pointsTable.js` | Python: `scoring-service/app/routers/points_table.py`
- [ ] Auth: admin/coordinator (assigned sport)
- [ ] Date checks: none
- [ ] Side effect: recompute from completed league matches

#### POST /api/internal/points-table/update
- [ ] Node: N/A | Python only: `scoring-service/app/routers/points_table.py`
- [ ] Auth: internal service auth
- [ ] Request fields: `match`, `previous_status`, `previous_winner`, `user_reg_number`

### Reporting service (Exports)

#### GET /api/export-excel
- [ ] Node: `routes/exports.js` | Python: `reporting-service/app/routers/export.py`
- [ ] Auth: admin
- [ ] Date checks: none
- [ ] Event handling: optional `event_id` query
- [ ] Response: Excel file with dynamic sport columns
