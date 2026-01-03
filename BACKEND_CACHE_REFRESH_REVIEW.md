# Backend Cache Handling and Refresh Review

## Overview
This document provides a comprehensive review of cache handling mechanisms across all backend routes that perform database create/update/delete operations. The backend uses in-memory caching to optimize API responses and must clear relevant caches after mutations to ensure data consistency.

## Cache Implementation

### Cache Utility (`utils/cache.js`)
- **Type:** In-memory cache using `Map` data structure
- **TTL Configuration:**
  - `/api/departments`: 10 seconds
  - `/api/departments/active`: 10 seconds
  - `/api/event-years/active`: 10 seconds
  - `/api/sports`: 10 seconds
  - `/api/sports-counts`: 10 seconds
  - Default: 5 seconds

### Cache Functions
- `getCache(url)` - Retrieve cached data if valid
- `setCache(url, data)` - Store data in cache
- `clearCache(url)` - Clear cache for specific endpoint
- `clearCachePattern(pattern)` - Clear all caches matching a pattern

---

## ✅ Routes Reviewed and Status

### 1. **Event Schedule Routes** (`routes/eventSchedule.js`)
**Status:** ✅ **FIXED** - All operations properly clear cache

**Operations:**
- ✅ **Create Match** (`POST /api/event-schedule`)
  - **Order:** Database operation → Clear cache → Return response
  - Clears: 
    - `/api/event-schedule/:sport?year=...`
    - `/api/event-schedule/:sport/teams-players?year=...`
    - `/api/points-table/:sport?year=...` (for league matches) **FIXED**
  - **Location:** Lines 658-665
  
- ✅ **Update Match** (`PUT /api/event-schedule/:id`)
  - **Order:** Database operation → Update points table (if league) → Clear cache → Return response
  - Clears:
    - `/api/event-schedule/:sport?year=...`
    - `/api/event-schedule/:sport/teams-players?year=...`
    - `/api/points-table/:sport?year=...` (for league matches)
  - **Location:** Lines 862-885
  
- ✅ **Delete Match** (`DELETE /api/event-schedule/:id`)
  - **Order:** Database operation → Clear cache → Return response
  - Clears:
    - `/api/event-schedule/:sport?year=...`
    - `/api/event-schedule/:sport/teams-players?year=...`
    - `/api/points-table/:sport?year=...` (for league matches) **FIXED**
  - **Location:** Lines 924-930

**Key Fix:** Added points-table cache clearing for league matches in POST and DELETE operations to ensure consistency with PUT operation.

---

### 2. **Team Routes** (`routes/teams.js`)
**Status:** ✅ **VERIFIED** - All operations properly clear cache

**Operations:**
- ✅ **Create Team** (`POST /api/update-team-participation`)
  - **Order:** Database operation → Clear cache → Return response
  - Clears:
    - `/api/sports?year=...`
    - `/api/sports/:sport?year=...`
    - `/api/teams/:sport?year=...`
    - `/api/sports-counts?year=...`
  - **Location:** Lines 210-216
  
- ✅ **Update Team Player** (`POST /api/update-team-player`)
  - **Order:** Database operation → Clear cache → Return response
  - Clears:
    - `/api/sports?year=...`
    - `/api/sports/:sport?year=...`
    - `/api/teams/:sport?year=...`
    - `/api/sports-counts?year=...`
  - **Location:** Lines 471-475
  
- ✅ **Delete Team** (`DELETE /api/delete-team`)
  - **Order:** Database operation → Clear cache → Return response
  - Clears:
    - `/api/sports?year=...`
    - `/api/sports/:sport?year=...`
    - `/api/teams/:sport?year=...`
    - `/api/sports-counts?year=...`
  - **Location:** Lines 542-545

---

### 3. **Participant Routes** (`routes/participants.js`)
**Status:** ✅ **VERIFIED** - All operations properly clear cache

**Operations:**
- ✅ **Add Participation** (`POST /api/update-participation`)
  - **Order:** Database operation → Clear cache → Return response
  - Clears:
    - `/api/sports?year=...`
    - `/api/sports/:sport?year=...`
    - `/api/participants/:sport?year=...`
    - `/api/participants-count/:sport?year=...`
    - `/api/sports-counts?year=...`
  - **Location:** Lines 157-162
  
- ✅ **Remove Participation** (`DELETE /api/remove-participation`)
  - **Order:** Database operation → Clear cache → Return response
  - Clears:
    - `/api/sports?year=...`
    - `/api/sports/:sport?year=...`
    - `/api/teams/:sport?year=...`
    - `/api/participants/:sport?year=...`
    - `/api/participants-count/:sport?year=...`
    - `/api/sports-counts?year=...`
  - **Location:** Lines 240-246

---

### 4. **Player Routes** (`routes/players.js`)
**Status:** ✅ **VERIFIED** - All operations properly clear cache

**Operations:**
- ✅ **Register Player** (`POST /api/save-player`)
  - **Order:** Database operation → Clear cache → Return response
  - Clears:
    - `/api/players`
  - **Location:** Lines 187-188
  
- ✅ **Register Multiple Players** (`POST /api/save-players`)
  - **Order:** Database operation → Clear cache → Return response
  - Clears:
    - `/api/players`
  - **Location:** Lines 255-256
  
- ✅ **Update Player** (`PUT /api/update-player`)
  - **Order:** Database operation → Clear cache → Return response
  - Clears:
    - `/api/players`
    - `/api/me?year=...` (current year)
  - **Location:** Lines 316-318

---

### 5. **Captain Routes** (`routes/captains.js`)
**Status:** ✅ **VERIFIED** - All operations properly clear cache

**Operations:**
- ✅ **Add Captain** (`POST /api/add-captain`)
  - **Order:** Database operation → Clear cache → Return response
  - Clears:
    - `/api/sports?year=...`
    - `/api/sports/:sport?year=...`
  - **Location:** Lines 78-80
  
- ✅ **Remove Captain** (`DELETE /api/remove-captain`)
  - **Order:** Database operation → Clear cache → Return response
  - Clears:
    - `/api/sports?year=...`
    - `/api/sports/:sport?year=...`
  - **Location:** Lines 134-136

---

### 6. **Sport Routes** (`routes/sports.js`)
**Status:** ✅ **VERIFIED** - All operations properly clear cache

**Operations:**
- ✅ **Create Sport** (`POST /api/sports`)
  - **Order:** Database operation → Clear cache → Return response
  - Clears:
    - Pattern: `/api/sports` (all variations)
    - Pattern: `/api/sports-counts` (all variations)
  - **Location:** Lines 116-118
  
- ✅ **Update Sport** (`PUT /api/sports/:id`)
  - **Order:** Database operation → Clear cache → Return response
  - Clears:
    - Pattern: `/api/sports` (all variations)
    - Pattern: `/api/sports-counts` (all variations)
  - **Location:** Lines 182-184
  
- ✅ **Delete Sport** (`DELETE /api/sports/:id`)
  - **Order:** Database operation → Clear cache → Return response
  - Clears:
    - Pattern: `/api/sports` (all variations)
    - Pattern: `/api/sports-counts` (all variations)
  - **Location:** Lines 222-224

**Note:** Uses `clearCachePattern()` to clear all cache variations (with/without year parameters).

---

### 7. **Event Year Routes** (`routes/eventYears.js`)
**Status:** ✅ **VERIFIED** - All operations properly clear cache

**Operations:**
- ✅ **Create Event Year** (`POST /api/event-years`)
  - **Order:** Database operation → Clear cache → Return response
  - Clears:
    - `/api/event-years/active`
  - **Location:** Lines 82-83
  
- ✅ **Update Event Year** (`PUT /api/event-years/:year`)
  - **Order:** Database operation → Clear cache → Return response
  - Clears:
    - `/api/event-years/active`
  - **Location:** Lines 122-123
  
- ✅ **Activate Event Year** (`PUT /api/event-years/:year/activate`)
  - **Order:** Database operation → Clear cache → Return response
  - Clears:
    - `/api/event-years/active`
  - **Location:** Lines 150-151
  
- ✅ **Delete Event Year** (`DELETE /api/event-years/:year`)
  - **Order:** Database operation → Clear cache → Return response
  - Clears:
    - `/api/event-years/active`
  - **Location:** Lines 212-213

---

### 8. **Department Routes** (`routes/departments.js`)
**Status:** ✅ **VERIFIED** - All operations properly clear cache

**Operations:**
- ✅ **Create Department** (`POST /api/departments`)
  - **Order:** Database operation → Clear cache → Return response
  - Clears:
    - `/api/departments`
    - `/api/departments/active`
  - **Location:** Lines 74-76
  
- ✅ **Update Department** (`PUT /api/departments/:id`)
  - **Order:** Database operation → Clear cache → Return response
  - Clears:
    - `/api/departments`
    - `/api/departments/active`
  - **Location:** Lines 119-121
  
- ✅ **Delete Department** (`DELETE /api/departments/:id`)
  - **Order:** Database operation → Clear cache → Return response
  - Clears:
    - `/api/departments`
    - `/api/departments/active`
  - **Location:** Lines 158-160

---

## Key Patterns

### ✅ Good Practices Found:
1. **Correct Order**: All operations follow: Database operation → Clear cache → Return response
2. **Comprehensive Cache Clearing**: Related caches are cleared together (e.g., sports and sports-counts)
3. **Pattern-Based Clearing**: Sports routes use `clearCachePattern()` for efficient bulk clearing
4. **Conditional Clearing**: Points-table cache only cleared for league matches
5. **Year-Aware Clearing**: Cache keys include year parameters where applicable

### ✅ Order Verification:
**All routes follow the correct pattern:**
```
1. Database operation (save/update/delete)
2. Clear cache (clearCache / clearCachePattern)
3. Return response (sendSuccessResponse)
```

**This ensures:**
- Cache is cleared after database changes
- Next GET request fetches fresh data from database
- No stale data in cache
- Frontend receives updated data immediately

---

## Cache Clearing Patterns

### Pattern 1: Specific Endpoint Clearing
Used when exact cache keys are known:
```javascript
clearCache(`/api/teams/${sport}?year=${eventYear}`)
clearCache(`/api/participants/${sport}?year=${eventYear}`)
```

### Pattern 2: Pattern-Based Clearing
Used for endpoints with multiple variations (e.g., with/without year):
```javascript
clearCachePattern('/api/sports')
clearCachePattern('/api/sports-counts')
```

### Pattern 3: Conditional Clearing
Used when cache clearing depends on operation type:
```javascript
if (match_type === 'league') {
  clearCache(`/api/points-table/${sports_name}?year=${eventYear.year}`)
}
```

---

## Cross-Route Dependencies

### Sports Cache Dependencies
When sports are created/updated/deleted, the following caches are affected:
- `/api/sports` (all variations)
- `/api/sports-counts` (all variations)
- `/api/sports/:sport` (specific sport)

### Team/Participant Cache Dependencies
When teams/participants are created/updated/deleted:
- `/api/teams/:sport` (team operations)
- `/api/participants/:sport` (participant operations)
- `/api/participants-count/:sport` (count operations)
- `/api/sports-counts` (aggregate counts)
- `/api/sports/:sport` (sport document with participation data)

### Event Schedule Cache Dependencies
When matches are created/updated/deleted:
- `/api/event-schedule/:sport` (matches list)
- `/api/event-schedule/:sport/teams-players` (available teams/players)
- `/api/points-table/:sport` (for league matches only)

### Points Table Cache Dependencies
Points table cache is cleared when:
- League matches are created (`POST /api/event-schedule`)
- League matches are updated (`PUT /api/event-schedule/:id`)
- League matches are deleted (`DELETE /api/event-schedule/:id`)

**Note:** Points table is only affected by league matches, not knockout/final matches.

---

## Summary

**Status:** ✅ **ALL ROUTES VERIFIED AND WORKING CORRECTLY**

### Order Verification Results:
**✅ ALL ROUTES FOLLOW CORRECT ORDER:**
1. Database operation (save/update/delete)
2. **Clear cache AFTER** database operation
3. **Return response** with success/error

This ensures:
- Cache is cleared after database changes
- Next GET request fetches fresh data from database
- No stale data in cache
- Frontend receives updated data immediately

### Route Status:
All routes that perform database create/update/delete operations:
- ✅ Clear appropriate caches **AFTER** database operations
- ✅ Use correct cache clearing patterns (specific or pattern-based)
- ✅ Clear related caches together
- ✅ Handle conditional cache clearing (e.g., league matches)

### Recent Fixes:
- ✅ **POST /api/event-schedule**: Added points-table cache clearing for league matches
- ✅ **DELETE /api/event-schedule/:id**: Added points-table cache clearing for league matches
- ✅ **PUT /api/event-schedule/:id**: Already had points-table cache clearing (verified)

### No Issues Found:
- ✅ All cache clearing happens **AFTER** database operations
- ✅ All cache clearing happens **BEFORE** returning response
- ✅ No routes clear cache before database operations
- ✅ No stale data issues

**No additional changes needed at this time.**

---

## Testing Checklist

When testing backend cache behavior, verify:
1. ✅ Cache is cleared after database operations (check cache state)
2. ✅ Next GET request fetches fresh data from database (not cache)
3. ✅ Related caches are cleared together
4. ✅ Pattern-based clearing works for all variations
5. ✅ Conditional clearing works correctly (e.g., league matches)
6. ✅ Year parameters are included in cache keys where applicable

---

## Cache Key Patterns

### With Year Parameter:
- `/api/sports?year=2026`
- `/api/teams/:sport?year=2026`
- `/api/participants/:sport?year=2026`
- `/api/event-schedule/:sport?year=2026`
- `/api/points-table/:sport?year=2026`

### Without Year Parameter:
- `/api/departments`
- `/api/departments/active`
- `/api/event-years/active`
- `/api/players`
- `/api/me`

### Pattern-Based (Multiple Variations):
- `/api/sports` (matches all variations with/without year)
- `/api/sports-counts` (matches all variations with/without year)

---

## Best Practices

1. **Always clear cache after mutations** - Ensures fresh data on next request
2. **Clear related caches together** - Maintains data consistency
3. **Use pattern-based clearing for multiple variations** - More efficient
4. **Include year parameters in cache keys** - Supports multi-year data
5. **Clear conditionally when needed** - Only clear relevant caches (e.g., points-table for league matches)

---

## Notes

- Backend cache is separate from frontend cache
- Backend cache clearing ensures fresh data for all clients
- Frontend cache clearing ensures immediate UI refresh
- Both work together to provide optimal user experience
- Backend cache TTL provides automatic expiration as fallback

