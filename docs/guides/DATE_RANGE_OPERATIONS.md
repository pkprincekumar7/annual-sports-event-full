# Date Range Operations Matrix

This document lists backend operations, their allowed date ranges, and the user roles that can perform them.
It is derived from middleware and route constraints in the backend.

## Date Ranges (Server Timezone)

- **Registration period**: `registration_start` through `registration_end` (inclusive).
- **Event period**: after `registration_end` and through `event_end` (inclusive).
- **Event status update period**: `event_start` through `event_end` (inclusive).

## Global Date Gate (Registration Deadline Middleware)

All `/api` routes pass through `checkRegistrationDeadline`:

- **Non-GET requests are blocked after registration_end**, **except**:
  - `/login`, `/change-password`, `/reset-password`
  - `/event-schedule/*`
  - `/points-table/*`
  - `/event-years/*`
  - `/departments/*`
- **GET requests are always allowed** (no date restriction), but still require authentication where defined.

## Role Definitions

- **Public**: No authentication required.
- **Player**: Authenticated non-admin user.
- **Captain**: Player assigned as eligible captain for a sport.
- **Coordinator**: Player in `eligible_coordinators` for a sport.
- **Admin**: `reg_number === "admin"`.

## Operations by Area

### Authentication

| Endpoint | Operation | Date Range | Allowed Users | Notes |
| --- | --- | --- | --- | --- |
| `POST /api/login` | Create session | Any time | Public | Whitelisted from deadline middleware |
| `POST /api/change-password` | Update password | Any time | Authenticated | Whitelisted |
| `POST /api/reset-password` | Reset password | Any time | Public | Whitelisted |

### Event Years (Event Configuration)

| Endpoint | Operation | Date Range | Allowed Users | Notes |
| --- | --- | --- | --- | --- |
| `GET /api/event-years` | Read list | Any time | Authenticated | Includes computed `is_active` |
| `GET /api/event-years/active` | Read active | Any time | Public | Active is computed by dates |
| `POST /api/event-years` | Create | Any time (future-dated) | Admin | Requires valid date relationships; reg start not in past |
| `PUT /api/event-years/:event_id` | Update | **Through registration_end** | Admin | Date fields can only be updated before their respective start/end; non-date fields blocked after event end |
| `DELETE /api/event-years/:event_id` | Delete | **Before registration_start** | Admin | Only if not active and no data (sports/schedules/points) |

### Departments (Not Date-Restricted)

| Endpoint | Operation | Date Range | Allowed Users | Notes |
| --- | --- | --- | --- | --- |
| `GET /api/departments` | Read list | Any time | Public | Not event-year dependent |
| `POST /api/departments` | Create | Any time | Admin | Not restricted by event dates |
| `PUT /api/departments/:id` | Update | Any time | Admin | Only `display_order` can change |
| `DELETE /api/departments/:id` | Delete | Any time | Admin | Blocked if players exist |

### Sports

| Endpoint | Operation | Date Range | Allowed Users | Notes |
| --- | --- | --- | --- | --- |
| `GET /api/sports` | Read list | Any time | Public | Event scoped via `event_id` |
| `GET /api/sports/:name` | Read one | Any time | Public | Event scoped via `event_id` |
| `GET /api/sports-counts` | Read counts | Any time | Authenticated | Teams/participants counts |
| `POST /api/sports` | Create | Registration period | Admin | Requires `event_id` |
| `PUT /api/sports/:id` | Update | Registration period | Admin | Cannot change `event_id` |
| `DELETE /api/sports/:id` | Delete | Registration period | Admin | Blocked if participation/matches exist |

### Batches

| Endpoint | Operation | Date Range | Allowed Users | Notes |
| --- | --- | --- | --- | --- |
| `GET /api/batches` | Read list | Any time | Public | Event scoped via `event_id` |
| `POST /api/add-batch` | Create | Registration period | Admin | Requires `event_id` |
| `DELETE /api/remove-batch` | Delete | Registration period | Admin | Blocked if batch has players |

### Players

| Endpoint | Operation | Date Range | Allowed Users | Notes |
| --- | --- | --- | --- | --- |
| `GET /api/me` | Read self | Any time | Authenticated | Event context optional |
| `GET /api/players` | Read list | Any time | Authenticated | Search + pagination |
| `GET /api/player-enrollments/:reg_number` | Read enrollments | Any time | Admin | Used for deletion validation |
| `POST /api/save-player` | Create player | Registration period | Public | Uses active event for batch assignment |
| `PUT /api/update-player` | Update player | Registration period | Admin | Batch handled separately |
| `DELETE /api/delete-player/:reg_number` | Delete player | Registration period | Admin | Blocked if team membership or matches exist |
| `POST /api/bulk-delete-players` | Bulk delete | Registration period | Admin | Same constraints as delete |
| `POST /api/bulk-player-enrollments` | Read (bulk) | **Before or on registration_end** | Admin | POST; blocked after reg end by deadline middleware |

### Captains (Team Eligibility)

| Endpoint | Operation | Date Range | Allowed Users | Notes |
| --- | --- | --- | --- | --- |
| `GET /api/captains-by-sport` | Read | Any time | Admin/Coordinator | Coordinators only see their sports |
| `POST /api/add-captain` | Create | Registration period | Admin/Coordinator | Per-sport eligibility |
| `DELETE /api/remove-captain` | Delete | Registration period | Admin/Coordinator | Blocked if captain already created team |

### Coordinators

| Endpoint | Operation | Date Range | Allowed Users | Notes |
| --- | --- | --- | --- | --- |
| `GET /api/coordinators-by-sport` | Read | Any time | Admin | |
| `POST /api/add-coordinator` | Create | Registration period | Admin | |
| `DELETE /api/remove-coordinator` | Delete | Registration period | Admin | |

### Teams (Team Sports)

| Endpoint | Operation | Date Range | Allowed Users | Notes |
| --- | --- | --- | --- | --- |
| `GET /api/teams/:sport` | Read | Any time | Authenticated | Event scoped |
| `POST /api/update-team-participation` | Create team | Registration period | Captain | Must be eligible captain for sport |
| `POST /api/update-team-player` | Update team | Registration period | Admin/Coordinator | Replace player (captain immutable) |
| `DELETE /api/delete-team` | Delete team | Registration period | Admin/Coordinator | Blocked if match history exists |
| `POST /api/validate-participations` | Read/validate | **Before or on registration_end** | Authenticated | POST; blocked after reg end by deadline middleware |

### Participants (Individual/Cultural Sports)

| Endpoint | Operation | Date Range | Allowed Users | Notes |
| --- | --- | --- | --- | --- |
| `GET /api/participants/:sport` | Read | Any time | Admin/Coordinator | Per-sport access |
| `GET /api/participants-count/:sport` | Read | Any time | Authenticated | Count only |
| `POST /api/update-participation` | Create participation | Registration period | Authenticated (self); Admin/Coordinator (others) | Individual sports only |
| `DELETE /api/remove-participation` | Delete participation | Registration period | Admin/Coordinator | Team/individual removal |

### Event Schedule (Matches)

| Endpoint | Operation | Date Range | Allowed Users | Notes |
| --- | --- | --- | --- | --- |
| `GET /api/event-schedule/:sport` | Read | Any time | Authenticated | Event scoped; optional `gender` filter |
| `GET /api/event-schedule/:sport/teams-players` | Read | Any time | Admin/Coordinator | Eligible list for scheduling; `gender` query is required |
| `POST /api/event-schedule` | Create match | **Event period** | Admin/Coordinator | After reg end, before event end |
| `PUT /api/event-schedule/:id` | Update result | **Event status update period** | Admin/Coordinator | Event start through event end |
| `DELETE /api/event-schedule/:id` | Delete match | **Event period** | Admin/Coordinator | Only scheduled matches |

### Points Table

| Endpoint | Operation | Date Range | Allowed Users | Notes |
| --- | --- | --- | --- | --- |
| `GET /api/points-table/:sport` | Read | Any time | Authenticated | Requires `gender` param |
| `POST /api/points-table/backfill/:sport` | Recalculate | Any time | Admin/Coordinator | Explicitly allowed anytime; whitelisted |

### Exports

| Endpoint | Operation | Date Range | Allowed Users | Notes |
| --- | --- | --- | --- | --- |
| `GET /api/export-excel` | Read/export | Any time | Admin | Uses event context if available |

