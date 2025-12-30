# Multi-Year Event Support - Implementation Proposal

## Problem Statement

Currently, the application is hardcoded for a single year (2026) and cannot handle events for multiple years. This means:
- Cannot use the same database for next year's events
- Event dates and registration dates are hardcoded
- No way to organize events annually
- Historical data cannot be preserved

## Proposed Solution: Year-Based Event Partitioning

### Architecture Overview

**Core Concept:** Add `event_year` field to event-specific models and filter all queries by year. Players remain year-agnostic (can participate across multiple years).

### Benefits

1. **Single Database:** One database handles all years
2. **Data Preservation:** Historical event data is maintained
3. **Player Reusability:** Players can participate across multiple years
4. **Efficient Queries:** Proper indexing ensures fast year-based queries
5. **Easy Year Switching:** Admin can switch between years via UI
6. **Scalable:** Can handle unlimited years without database changes

---

## Implementation Plan

### Phase 1: Database Schema Updates

#### 1.1 Add `event_year` Field to Event-Specific Models

**Models to Update:**

1. **`models/Sport.js` (NEW - from implementation plan)**
   ```javascript
   {
     name: String (required, unique per year)
     event_year: Number (required, e.g., 2026, 2027)
     type: String (required, enum: ['dual_team', 'multi_team', 'dual_player', 'multi_player'])
     category: String (required)
     team_size: Number (optional)
     eligible_captains: [String]
     teams_participated: [...]
     players_participated: [String]
     // ... other fields
   }
   ```
   - **Compound unique index:** `{ name: 1, event_year: 1 }` (unique sport name per year)
   - **Index:** `{ event_year: 1, type: 1 }` (for efficient year-based queries)
   - **Index:** `{ event_year: 1, category: 1 }` (for category filtering by year)

2. **`models/EventSchedule.js` (UPDATE)**
   ```javascript
   {
     event_year: Number (required, e.g., 2026, 2027)
     match_number: Number (required)
     match_type: String (required)
     sports_name: String (required)
     teams: [String]
     players: [String]
     qualifiers: [...]
     match_date: Date (required)
     winner: String
     status: String
     // ... other fields
   }
   ```
   - **Compound unique index:** `{ event_year: 1, sports_name: 1, match_number: 1 }` (unique match numbers per sport per year)
   - **Index:** `{ event_year: 1, sports_name: 1 }` (for sport-based queries by year)
   - **Index:** `{ event_year: 1, sports_name: 1, status: 1 }` (for status filtering by year)

3. **`models/PointsTable.js` (NEW - from implementation plan)**
   ```javascript
   {
     event_year: Number (required, e.g., 2026, 2027)
     sports_name: String (required)
     participant: String (required)
     participant_type: String (required)
     points: Number (default: 0)
     matches_played: Number
     matches_won: Number
     matches_lost: Number
     matches_draw: Number
     matches_cancelled: Number
     // ... other fields
   }
   ```
   - **Compound unique index:** `{ event_year: 1, sports_name: 1, participant: 1 }` (unique participant per sport per year)
   - **Index:** `{ event_year: 1, sports_name: 1, points: 1 }` (for sorted points table by year)

**Models NOT to Update:**
- **`models/Player.js`:** Players remain year-agnostic (can participate across multiple years)
  - `participated_in` and `captain_in` will be computed dynamically from Sports collection (filtered by year in queries)

#### 1.2 Create Event Year Configuration Model (Optional but Recommended)

**`models/EventYear.js` (NEW)**
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

**Purpose:**
- Store event configuration per year (name, dates, registration dates)
- Track which year is currently active
- Admin can create/manage multiple years
- Frontend can fetch active year configuration

**Indexes:**
- `{ year: 1 }` (unique)
- `{ is_active: 1 }` (for finding active year)

---

### Phase 2: Backend API Updates

#### 2.1 Add Year Context to All Event-Related Endpoints

**Approach 1: Year from Request (Recommended)**
- Add `event_year` parameter to all event-related API endpoints
- Default to current year if not provided (for backward compatibility)
- Validate year exists in EventYear collection

**Approach 2: Active Year (Alternative)**
- Use `is_active: true` from EventYear collection
- Admin can switch active year via UI
- All queries automatically use active year

**Recommended: Hybrid Approach**
- Use active year by default
- Allow explicit year parameter for admin operations
- Support year switching via admin UI

#### 2.2 Update All Event-Related Queries

**All queries must include `event_year` filter:**

```javascript
// Example: Get sports for a year
const sports = await Sport.find({ event_year: year }).lean()

// Example: Get matches for a sport in a year
const matches = await EventSchedule.find({ 
  event_year: year, 
  sports_name: sport 
}).lean()

// Example: Get points table for a sport in a year
const pointsTable = await PointsTable.find({ 
  event_year: year, 
  sports_name: sport 
}).sort({ points: -1 }).lean()
```

#### 2.3 New API Endpoints

**Event Year Management (Admin Only):**
- `GET /api/event-years` - Get all event years
- `GET /api/event-years/active` - Get currently active year
- `POST /api/event-years` - Create new event year
- `PUT /api/event-years/:year` - Update event year configuration
- `PUT /api/event-years/:year/activate` - Set year as active (deactivates others)
- `DELETE /api/event-years/:year` - Delete event year (only if no data exists)

**Updated Endpoints (Add year parameter):**
- All Sport endpoints: `GET /api/sports?year=2026` (defaults to active year)
- All EventSchedule endpoints: Include year in query
- All PointsTable endpoints: Include year in query
- All participation endpoints: Include year context

#### 2.4 Update Helper Functions

**`computePlayerParticipation(playerRegNumber, eventYear)`**
- Add `eventYear` parameter
- Filter Sports collection by `event_year`
- Compute participation only for specified year

---

### Phase 3: Frontend Updates

#### 3.1 Year Selection UI (Admin Only)

**Add Year Selector:**
- Admin can see dropdown/selector for available years
- Default to active year
- Show "Create New Year" option for admin
- Display current active year prominently

**Location:** 
- Add to `Hero.jsx` (admin section)
- Or create separate admin panel component

#### 3.2 Update Event Info Display

**Dynamic Event Info:**
- Fetch event info from `GET /api/event-years/active`
- Display event name, dates, registration dates dynamically
- Update countdown timers based on active year dates

**Update `src/constants/app.js`:**
- Remove hardcoded `EVENT_INFO`
- Fetch from API instead
- Cache active year info

#### 3.3 Update All API Calls

**Add year parameter to all event-related API calls:**
- Sports fetching: Include year
- Event schedule: Include year
- Participation: Include year context
- Points table: Include year

**Example:**
```javascript
// Fetch sports for current year
const response = await fetchWithAuth(`/api/sports?year=${currentYear}`)

// Or use active year endpoint
const activeYear = await fetchWithAuth('/api/event-years/active')
const year = activeYear.year
```

#### 3.4 Year Context Management

**Create Year Context/Hook:**
- `src/contexts/EventYearContext.jsx` or `src/hooks/useEventYear.js`
- Manage current year state
- Provide year to all components
- Handle year switching

---

### Phase 4: Data Migration Strategy

#### 4.1 For Existing Data (2026)

**Migration Script:**
```javascript
// Add event_year: 2026 to all existing data
// Sport collection: Add event_year: 2026
// EventSchedule collection: Add event_year: 2026
// PointsTable collection: Add event_year: 2026 (if exists)
// Create EventYear document for 2026 with is_active: true
```

#### 4.2 For New Years

**Admin Workflow:**
1. Admin creates new event year via UI (`POST /api/event-years`)
2. Admin sets event name, dates, registration dates
3. Admin can copy sports from previous year (optional feature)
4. Admin activates new year (`PUT /api/event-years/:year/activate`)
5. System switches to new year automatically

---

## Implementation Details

### Index Strategy

**Critical Indexes for Performance:**
```javascript
// Sport Model
{ name: 1, event_year: 1 } // Unique constraint
{ event_year: 1, type: 1 } // Year + type queries
{ event_year: 1, category: 1 } // Year + category queries

// EventSchedule Model
{ event_year: 1, sports_name: 1, match_number: 1 } // Unique constraint
{ event_year: 1, sports_name: 1 } // Year + sport queries
{ event_year: 1, sports_name: 1, status: 1 } // Year + sport + status queries

// PointsTable Model
{ event_year: 1, sports_name: 1, participant: 1 } // Unique constraint
{ event_year: 1, sports_name: 1, points: -1 } // Sorted points table
```

### Query Optimization

**Always include event_year in queries:**
- Prevents cross-year data leakage
- Ensures efficient index usage
- Maintains data isolation

**Example Optimized Query:**
```javascript
// ✅ Good: Uses compound index
const sports = await Sport.find({ 
  event_year: 2026, 
  category: 'team events' 
}).lean()

// ❌ Bad: Missing event_year (won't use index efficiently)
const sports = await Sport.find({ 
  category: 'team events' 
}).lean()
```

### Year Validation

**Backend Validation:**
- Validate year exists in EventYear collection
- Validate year is active (or allow admin to access any year)
- Prevent operations on non-existent years
- Validate dates match year context

---

## User Experience Flow

### Admin Workflow

1. **View Current Year:**
   - Admin sees active year in header/navbar
   - Can switch to other years via dropdown

2. **Create New Year:**
   - Click "Create New Year" button
   - Fill form: Year, Event Name, Event Dates, Registration Dates
   - Optionally copy sports from previous year
   - Save and activate

3. **Manage Years:**
   - View all years
   - Edit year configuration
   - Switch active year
   - Archive/delete old years (if no data exists)

### Regular User Workflow

1. **View Active Year Events:**
   - Users always see active year's events
   - No year selection needed
   - Transparent year switching

2. **Registration:**
   - Register for active year's events
   - Registration dates enforced per year

---

## Benefits Summary

### ✅ Advantages

1. **Single Database:** One database for all years
2. **Data Preservation:** Historical data maintained
3. **Player Reusability:** Players participate across years
4. **Efficient Queries:** Proper indexing ensures performance
5. **Easy Management:** Admin can manage multiple years
6. **Scalable:** Handles unlimited years
7. **Backward Compatible:** Can migrate existing 2026 data

### ⚠️ Considerations

1. **Migration Required:** Existing data needs `event_year: 2026` added
2. **Query Updates:** All event queries must include year filter
3. **UI Updates:** Year selection and management UI needed
4. **Testing:** Test year switching and data isolation

---

## Implementation Priority

### Recommended Order:

1. **Phase 1:** Add `event_year` field to models and create EventYear model
2. **Phase 2:** Update backend queries to include year filter
3. **Phase 3:** Create EventYear management APIs
4. **Phase 4:** Update frontend to fetch/display active year
5. **Phase 5:** Add year selection UI for admin
6. **Phase 6:** Migration script for existing 2026 data

---

## Estimated Effort

- **Backend Changes:** 2-3 days
  - Model updates: 0.5 day
  - Query updates: 1 day
  - EventYear APIs: 0.5 day
  - Testing: 1 day

- **Frontend Changes:** 1-2 days
  - Year context/hook: 0.5 day
  - UI updates: 0.5 day
  - API integration: 0.5 day
  - Testing: 0.5 day

- **Migration:** 0.5 day
- **Total:** ~4-6 days

---

## Next Steps

1. Review and approve this proposal
2. Integrate with existing implementation plan (add year support to Sport, EventSchedule, PointsTable models)
3. Create detailed task breakdown
4. Start with Phase 1 (Model updates)

---

## Questions to Resolve

1. **Year Selection:** Should regular users see year selector, or only active year?
   - **Recommendation:** Only active year (transparent to users)

2. **Data Archival:** Should old years be archived or kept active?
   - **Recommendation:** Keep all years accessible, mark as archived (read-only)

3. **Year Switching:** Should year switching require admin confirmation?
   - **Recommendation:** Yes, with warning about impact on active registrations

4. **Copy Sports:** Should admin be able to copy sports from previous year?
   - **Recommendation:** Yes, as optional feature to save time

