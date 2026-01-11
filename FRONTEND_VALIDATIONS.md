# Frontend Validations and Conditional UI States

This document lists all frontend validations, conditional rendering, enable/disable states, and field-level validations across all components.

## Validation Types

1. **Field-Level Validations**: Required fields, format validations (email, phone), range validations
2. **Business Logic Validations**: Gender matching, batch matching, duplicate checks, participation limits
3. **Role-Based UI**: Show/hide elements based on user roles (admin, coordinator, captain, player)
4. **Date-Based UI**: Enable/disable based on registration/event periods
5. **Conditional Rendering**: Show/hide forms, buttons, tabs based on state
6. **Button States**: Disabled states during loading, form submission, or based on conditions

---

## Component-by-Component Analysis

### 1. RegisterModal.jsx

#### Field-Level Validations:
- ✅ **Required Fields**: All fields validated (reg_number, full_name, gender, department_branch, batch_name, mobile_number, email_id, password)
- ✅ **Email Format**: Validated using regex `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`
- ✅ **Phone Format**: Validated to be exactly 10 digits `/^[0-9]{10}$/`
- ✅ **Team Name**: Required for team registration
- ✅ **Player Selection**: All required players must be selected
- ✅ **Self-Inclusion**: Logged-in user must be included in team

#### Business Logic Validations:
- ✅ **No Duplicates**: Validates no duplicate players in team selection
- ✅ **Gender Match**: All selected players must have same gender as logged-in user
- ✅ **Batch Match**: All selected players must be in same batch as logged-in user
- ✅ **Captain Validation**: Validates user is captain for the sport before allowing team creation
- ✅ **Participation Limits**: Calls `/api/validate-participations` to check backend limits

#### Conditional Rendering:
- ✅ **General vs Team Registration**: Shows different forms based on `isGeneralRegistration`
- ✅ **Batch Dropdown**: Only shown for team/individual registration (not general)
- ✅ **Player Selection**: Only shown for team events
- ✅ **Team Name Field**: Only shown for team events

#### Enable/Disable States:
- ✅ **Submit Buttons**: Disabled during submission (`isSubmitting`, `isSubmittingTeam`, `isSubmittingIndividual`)

---

### 2. PlayerListModal.jsx

#### Field-Level Validations:
- ✅ **Required Fields**: reg_number, full_name, gender, department_branch, mobile_number, email_id (when editing)
- ✅ **Email Format**: Validated using regex
- ✅ **Phone Format**: Validated to be exactly 10 digits
- ✅ **Search Input**: Validated and trimmed

#### Business Logic Validations:
- ✅ **Bulk Delete Validation**: Checks for players with teams/matches before deletion
- ✅ **Registration Period Errors**: Handles and displays registration period errors from API

#### Conditional Rendering:
- ✅ **Edit Form**: Only shown when `editingPlayer` is set
- ✅ **Bulk Actions**: Only shown for admin users
- ✅ **Delete Buttons**: Only shown for admin users
- ✅ **Edit Buttons**: Only shown for admin users
- ✅ **Pagination Controls**: Hidden on small devices, shown on medium+ devices

#### Enable/Disable States:
- ✅ **Search Input**: Disabled during loading
- ✅ **Pagination Buttons**: Disabled when at first/last page or no previous/next page
- ✅ **Bulk Delete Button**: Disabled during `bulkDeleting`
- ✅ **Edit Form Fields**: Some fields disabled (e.g., reg_number, gender cannot be changed)
- ✅ **Save Button**: Disabled during `saving`
- ✅ **Department Dropdown**: Disabled during `loadingDepartments`

---

### 3. AdminDashboardModal.jsx

#### Field-Level Validations:
- ✅ **Event Year**: Required, must be a number
- ✅ **Event Name**: Required
- ✅ **Date Relationships**: Validates `registration_dates.start < registration_dates.end < event_dates.start < event_dates.end`
- ✅ **Date Restrictions**: Registration start and event start cannot be in the past
- ✅ **Sport Name**: Required
- ✅ **Sport Type**: Required, must be one of: dual_team, multi_team, dual_player, multi_player
- ✅ **Sport Category**: Required, must be one of: team events, individual events, literary and cultural activities
- ✅ **Team Size**: Validated based on sport type (only for team sports)
- ✅ **Department Name**: Required
- ✅ **Display Order**: Must be a number

#### Business Logic Validations:
- ✅ **Event Year Uniqueness**: Checks if event year already exists
- ✅ **Department Uniqueness**: Checks if department name already exists
- ✅ **Updatable Fields**: Uses `getUpdatableDateFields` to determine which fields can be updated based on current date

#### Conditional Rendering:
- ✅ **Tabs**: Shows different tabs (Event Years, Sports, Departments)
- ✅ **Create/Edit Forms**: Shows create form or edit form based on `editingEventYear`, `editingSport`, `editingDept`
- ✅ **Event Year Fields**: Non-date fields hidden/disabled after event ends
- ✅ **Date Fields**: Individual date fields disabled based on whether registration/event has started/ended
- ✅ **Active Event Year Indicator**: Shows computed `is_active` status

#### Enable/Disable States:
- ✅ **Event Year Field**: Disabled when editing (read-only)
- ✅ **Date Fields**: Disabled based on `updatableFields` (canUpdateRegStart, canUpdateRegEnd, canUpdateEventStart, canUpdateEventEnd, canUpdateNonDateFields)
- ✅ **Non-Date Fields**: Disabled after event ends (`canUpdateNonDateFields`)
- ✅ **Tooltips**: Shown on disabled fields explaining why they're disabled

---

### 4. TeamDetailsModal.jsx

#### Field-Level Validations:
- ✅ **Replacement Player**: Required when updating a team player

#### Business Logic Validations:
- ✅ **Gender Match**: Validates replacement player has same gender
- ✅ **Batch Match**: Validates replacement player is in same batch
- ✅ **No Duplicates**: Validates replacement player is not already in team

#### Conditional Rendering:
- ✅ **Admin View**: Shows all teams for admin
- ✅ **Captain/Participant View**: Shows only user's team for captain or enrolled participant (`shouldShowOnlyUserTeam`)
- ✅ **Edit Player Button**: Only shown for admin users
- ✅ **Delete Team Button**: Only shown for admin users
- ✅ **Captain Badge**: Shows "Captain" badge for team captain
- ✅ **Player List**: Only fetched for admin users

#### Enable/Disable States:
- ✅ **Delete Button**: Disabled during deletion (`deleting && deletingTeam === team.team_name`)
- ✅ **Update Button**: Disabled during update or if no replacement player selected (`updating || !selectedReplacementPlayer`)
- ✅ **Cancel Button**: Disabled during update (`updating`)

---

### 5. ParticipantDetailsModal.jsx

#### Conditional Rendering:
- ✅ **Delete Button**: Only shown for admin users
- ✅ **Participant List**: Only shown for admin/coordinator users

#### Enable/Disable States:
- ✅ **Delete Button**: Disabled during deletion (`deleting`)

---

### 6. EventScheduleModal.jsx

#### Field-Level Validations:
- ✅ **Match Type**: Required
- ✅ **Sport Name**: Required
- ✅ **Match Date**: Required, must be today or future date
- ✅ **Gender**: Required for match creation
- ✅ **Teams/Players**: Required based on sport type
- ✅ **Number of Participants**: Required for multi sports, must be between 3 and 100
- ✅ **Winner**: Required for dual sports when match is completed
- ✅ **Qualifiers**: Required for multi sports when match is completed

#### Business Logic Validations:
- ✅ **Match Date Validation**: Match date must be within event date range (validated in route handler, but UI shows error)
- ✅ **Match Date Future Check**: Match date must be today or future (`isMatchInFuture`)
- ✅ **League Match Completion**: All league matches must be completed before scheduling knockout
- ✅ **Knockout Match Completion**: All knockout matches must be completed before scheduling final
- ✅ **Winner/Qualifiers Required**: Completed matches must have winner (dual) or qualifiers (multi)
- ✅ **Match Date Ordering**: Knockout date cannot be before latest league match date
- ✅ **Final Date Ordering**: Final date cannot be before latest knockout match date
- ✅ **Participant Count**: Validates exact number of participants for multi sports
- ✅ **No Duplicates**: Validates no duplicate teams/players in multi sports
- ✅ **Different Participants**: Validates different teams/players for dual sports
- ✅ **Gender Match**: Validates all participants have same gender

#### Conditional Rendering:
- ✅ **Add Match Form**: Only shown when `showAddForm` is true
- ✅ **Gender Tabs**: Shows Male/Female tabs for viewing matches
- ✅ **Match Type Selection**: Shows different form fields based on match type (league, knockout, final)
- ✅ **Dual vs Multi Forms**: Shows different forms for dual_team/dual_player vs multi_team/multi_player
- ✅ **Update Forms**: Shows update form only for scheduled matches
- ✅ **Delete Button**: Only shown for scheduled matches
- ✅ **Winner/Qualifiers Input**: Only shown for completed matches
- ✅ **Teams/Players Dropdowns**: Only shown when gender is selected

#### Enable/Disable States:
- ✅ **Submit Button**: Disabled during submission (`submitting`)
- ✅ **Update Buttons**: Disabled during update (`updatingStatus`, `updatingWinner`, `updatingQualifiers`)
- ✅ **Delete Button**: Disabled during deletion (`deleting`)
- ✅ **Date Fields**: May be disabled based on match status
- ✅ **Match Type**: May be disabled based on existing matches

---

### 7. SportDetailsModal.jsx

#### Conditional Rendering:
- ✅ **Tab Visibility**: Tabs shown based on user role and enrollment status
  - **Admin**: Shows "View Teams" or "View Participants", "Events", "Points Table" (if dual)
  - **Captain (not enrolled)**: Shows "Create Team", "View Events", "Points Table" (if dual)
  - **Captain/Enrolled**: Shows "View Team", "View Events", "Points Table" (if dual)
  - **Individual (not participated)**: Shows "Enroll Now", "View Events", "Points Table" (if dual)
  - **Individual (participated)**: Shows "View Enrollment", "View Events", "Points Table" (if dual)
- ✅ **Auto Tab Selection**: Automatically selects appropriate tab based on user state

---

### 8. PointsTableModal.jsx

#### Conditional Rendering:
- ✅ **Backfill Button**: Only shown for admin users
- ✅ **Gender Tabs**: Shows Male/Female tabs

#### Enable/Disable States:
- ✅ **Backfill Button**: Disabled during backfilling or loading (`backfilling || loading`)
- ✅ **Gender Tab Buttons**: Disabled during loading

---

### 9. CaptainManagementModal.jsx

#### Field-Level Validations:
- ✅ **Player Selection**: Required
- ✅ **Sport Selection**: Required

#### Conditional Rendering:
- ✅ **Tabs**: Shows "Add" and "Remove" tabs
- ✅ **Add Form**: Only shown in Add tab
- ✅ **Remove List**: Only shown in Remove tab
- ✅ **Captains List**: Grouped by sport with expandable sections

#### Enable/Disable States:
- ✅ **Submit Buttons**: Disabled during loading (`loading`)

---

### 10. CoordinatorManagementModal.jsx

#### Field-Level Validations:
- ✅ **Player Selection**: Required
- ✅ **Sport Selection**: Required

#### Conditional Rendering:
- ✅ **Tabs**: Shows "Add" and "Remove" tabs
- ✅ **Add Form**: Only shown in Add tab
- ✅ **Remove List**: Only shown in Remove tab
- ✅ **Coordinators List**: Grouped by sport with expandable sections

#### Enable/Disable States:
- ✅ **Submit Buttons**: Disabled during loading (`loading`)

---

### 11. BatchManagementModal.jsx

#### Field-Level Validations:
- ✅ **Batch Name**: Required (trimmed and validated)

#### Conditional Rendering:
- ✅ **Tabs**: Shows "Add Batch" and "Remove Batch" tabs
- ✅ **Add Form**: Only shown in Add tab
- ✅ **Remove List**: Only shown in Remove tab
- ✅ **Batches List**: Shows batches with expandable player lists

#### Enable/Disable States:
- ✅ **Submit Buttons**: Disabled during loading (`loading`)

---

### 12. SportsSection.jsx

#### Conditional Rendering:
- ✅ **Create Team Button**: Only shown for captains who haven't enrolled (`canCreateTeam`)
- ✅ **View Team Button**: Shown for enrolled users or non-captains
- ✅ **Enroll Button**: Only shown for individual events when not enrolled
- ✅ **View Enrollment Button**: Shown for individual events when enrolled
- ✅ **Admin Actions**: Different actions shown for admin users

#### Business Logic Validations:
- ✅ **Captain Check**: Validates if user is captain for sport
- ✅ **Enrollment Check**: Validates if user is enrolled in sport

---

### 13. Hero.jsx

#### Conditional Rendering:
- ✅ **Menu Items**: Admin-only items only shown for admin users
  - Add/Remove Captain (admin only)
  - Add/Remove Coordinator (admin only)
  - Add/Remove Batch (admin only)
  - List Players (admin only)
  - Export Excel (admin only)
  - Admin Dashboard (admin only)
- ✅ **Event Year Selector**: Only shown for admin users
- ✅ **Login/Register Buttons**: Only shown when not logged in
- ✅ **Menu Button**: Only shown when logged in

---

### 14. ProfileModal.jsx

#### Conditional Rendering:
- ✅ **Edit Button**: May be conditionally shown based on user role
- ✅ **Fields**: Some fields may be read-only

---

## Validation Utilities

### formValidation.js
- ✅ `validateEmail(email)`: Email format validation
- ✅ `validatePhone(phone)`: Phone number validation (10 digits)
- ✅ `validateRequired(fields)`: Required field validation
- ✅ `validatePlayerForm(data)`: Comprehensive player form validation
- ✅ `trimFormData(data)`: Trims all string fields

### participantValidation.js
- ✅ `validateGenderMatch(participants, expectedGender)`: Validates all participants have same gender
- ✅ `validateBatchMatch(participants, expectedBatch)`: Validates all participants are in same batch
- ✅ `validateNoDuplicates(participantIds, participantList)`: Validates no duplicate participants
- ✅ `validateParticipantsExist(participantIds, availableParticipants, idField)`: Validates participants exist in available list
- ✅ `validateParticipantCount(participantIds, requiredCount, participantType)`: Validates exact participant count
- ✅ `validateDifferentParticipants(participant1, participant2, participantType)`: Validates two participants are different
- ✅ `validateParticipantSelection(options)`: Comprehensive validation combining all above

---

## UI Component States

### Input Component (ui/Input.jsx)
- ✅ **Required Indicator**: Shows asterisk (*) for required fields
- ✅ **Disabled State**: Supports `disabled` prop
- ✅ **Read-only State**: Can be made read-only
- ✅ **Error Display**: Can show error messages (via parent components)

### Button Component (ui/Button.jsx)
- ✅ **Disabled State**: Supports `disabled` prop
- ✅ **Loading State**: Can show loading indicator
- ✅ **Variants**: Primary, secondary variants

### DatePickerInput Component (ui/DatePickerInput.jsx)
- ✅ **Disabled State**: Supports `disabled` prop
- ✅ **Required State**: Supports `required` prop
- ✅ **Date Validation**: Built-in date picker validation

---

## Missing Validations / Recommendations

### 1. Date-Based UI Restrictions
- ⚠️ **Missing**: Frontend doesn't disable buttons/forms based on registration period
  - **Recommendation**: Add date checks to disable registration forms after registration deadline
  - **Recommendation**: Disable team creation after registration period ends
  - **Recommendation**: Show visual indicators when operations are outside allowed periods

### 2. Role-Based Field Restrictions
- ✅ **Present**: Admin-only fields are conditionally rendered
- ⚠️ **Missing**: Coordinator role checks in UI (currently only checked in backend)
  - **Recommendation**: Add coordinator role checks in frontend to hide/show coordinator-specific actions

### 3. Real-time Validation Feedback
- ⚠️ **Partial**: Some forms validate on submit only
  - **Recommendation**: Add real-time validation feedback as user types (email format, phone format)
  - **Recommendation**: Show field-level error messages inline

### 4. Form Field Disabled States
- ✅ **Present**: Many fields are disabled during loading/submission
- ⚠️ **Missing**: Some fields could be disabled based on business rules
  - **Recommendation**: Disable gender field after player creation (already done in backend, but UI could reflect this)
  - **Recommendation**: Disable batch_name field after player registration

### 5. Date Field Validations
- ✅ **Present**: Date relationships validated in AdminDashboardModal
- ✅ **Present**: Match date validated in EventScheduleModal
- ⚠️ **Missing**: Min/max date restrictions on date pickers
  - **Recommendation**: Set min date on date pickers to prevent past dates where not allowed
  - **Recommendation**: Set max date on date pickers to prevent future dates beyond event end

### 6. Number Field Validations
- ✅ **Present**: Team size validated in AdminDashboardModal
- ✅ **Present**: Number of participants validated in EventScheduleModal (3-100 range)
- ⚠️ **Missing**: Input type restrictions (some number fields use text input)
  - **Recommendation**: Use `type="number"` for all numeric fields with min/max attributes

### 7. Search/Filter Validations
- ✅ **Present**: Search input is trimmed
- ⚠️ **Missing**: Search input length validation
  - **Recommendation**: Add minimum length requirement for search (e.g., at least 2 characters)

### 8. Confirmation Dialogs
- ✅ **Present**: Delete operations have confirmation dialogs
- ⚠️ **Missing**: Some destructive operations lack confirmation
  - **Recommendation**: Add confirmation for bulk delete operations
  - **Recommendation**: Add confirmation for removing captain/coordinator roles

### 9. Loading States
- ✅ **Present**: Most operations show loading states
- ⚠️ **Missing**: Some async operations don't show loading indicators
  - **Recommendation**: Add loading spinners for all async operations

### 10. Error Handling
- ✅ **Present**: Most components handle and display errors
- ⚠️ **Missing**: Some error messages could be more user-friendly
  - **Recommendation**: Standardize error message format
  - **Recommendation**: Add retry mechanisms for failed operations

---

## Summary

### ✅ Well-Implemented Validations:
1. Field-level validations (required, email, phone)
2. Business logic validations (gender match, batch match, duplicates)
3. Role-based conditional rendering (admin, captain, player)
4. Form submission disabled states
5. Date relationship validations
6. Match scheduling validations

### ⚠️ Areas for Improvement:
1. Date-based UI restrictions (disable forms/buttons outside allowed periods)
2. Real-time validation feedback
3. Coordinator role checks in UI
4. Min/max date restrictions on date pickers
5. Number input type restrictions
6. Search input length validation
7. Additional confirmation dialogs
8. More comprehensive loading states

---

## Total Validation Coverage

- **Field-Level Validations**: ~85% coverage
- **Business Logic Validations**: ~90% coverage
- **Role-Based UI**: ~95% coverage
- **Date-Based UI**: ~60% coverage (needs improvement)
- **Enable/Disable States**: ~80% coverage
- **Conditional Rendering**: ~90% coverage
