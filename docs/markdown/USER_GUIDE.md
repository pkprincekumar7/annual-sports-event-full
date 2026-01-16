# Annual Sports Event Management System - User Guide

## Overview

This guide provides comprehensive documentation for the Annual Sports Event Management System (UMANG). The system supports multiple event years, various sport types, and comprehensive match management for both **Admin Users** and **Regular Players**.

---

## Table of Contents

1. [Common Features (All Users)](#common-features-all-users)
2. [Coordinator User Features](#coordinator-user-features)
3. [Non-Admin User Features](#non-admin-user-features)
4. [Admin User Features](#admin-user-features)
5. [Sport Types and Registration Rules](#sport-types-and-registration-rules)
6. [Match Types and Scheduling](#match-types-and-scheduling)
7. [Points Table System](#points-table-system)
8. [Event Year Management](#event-year-management)
9. [Participation Limits and Constraints](#participation-limits-and-constraints)
10. [User Interface Features](#user-interface-features)
11. [Security Features](#security-features)

---

## Common Features (All Users)

### 1. **Homepage Access**
- **Event Information Display**: View event details including:
  - Event name (e.g., UMANG 2026)
  - Event dates (start and end dates)
  - Registration dates (start and end dates)
  - Real-time countdown timer showing time until event start
  - Event organizer, title, and highlight information
- **Sports Overview**: Browse all available sports organized by categories:
  - **Team Events**: Sports requiring team registration
  - **Individual Events**: Sports for individual participation
  - **Literary and Cultural Activities**: Cultural and literary events
- **Dynamic Sports Display**: Sports are fetched dynamically based on the active event year
- **Participation Counts**: View total teams/participants count for each sport (when logged in)

### 2. **User Registration**
- **New Account Creation**: Register as a new player with the following information:
  - Registration Number (unique identifier, required)
  - Full Name (required)
  - Gender (Male/Female, required)
  - Department/Branch (required, from available departments)
  - Batch (required, from available batches)
  - Mobile Number (10 digits, required)
  - Email ID (validated format, required)
  - Password (required)
- **Batch Assignment**: Players select a batch during registration and are assigned to it
- **Validation**: All fields are validated before submission
- **Registration Period**: Registration is only allowed during the registration period defined for the active event year and event name

### 3. **User Login**
- **Authentication**: Login using Registration Number and Password
- **Session Management**: JWT token-based authentication
- **Persistent Sessions**: Stay logged in after page refresh
- **Auto-logout**: Automatic logout on token expiration or invalid credentials
- **Role-Based Access**: System recognizes admin, coordinator, captain, and regular player roles

### 4. **Password Management**

#### **Change Password**
- **Access**: Available to all authenticated users
- **Process**:
  1. Click on profile/account settings
  2. Select "Change Password" option
  3. Enter current password
  4. Enter new password (minimum 6 characters)
  5. Confirm new password
  6. Submit to update password
- **Validation**:
  - Current password must be correct
  - New password must be at least 6 characters long
  - New password must be different from current password
  - Confirm password must match new password
- **Security**: Password is hashed and stored securely

#### **Reset Password**
- **Access**: Available to all users (public endpoint)
- **Process**:
  1. Click "Forgot Password" or "Reset Password" link
  2. Enter registered email ID
  3. Submit request
  4. System sends new password to email (if email exists)
- **Security**: System always shows success message (doesn't reveal if email exists)
- **Email Requirement**: Email must be registered in the system

### 5. **View Sports Information**
- **Sports List**: View all available sports for the active event year
- **Sport Categories**: Sports are organized by categories:
  - Team Events
  - Individual Events
  - Literary and Cultural Activities
- **Sport Details**: Click on any sport card to view:
  - Sport name and category
  - Sport type (dual_team, multi_team, dual_player, multi_player)
  - Participation counts
  - Available actions based on user role and participation status

### 6. **View Event Schedules**
- **Match Listings**: View all scheduled matches for any sport
- **Match Details**: See complete match information including:
  - Match number
  - Match type (League/Knockout/Final)
  - Participants (teams or players)
  - Match date
  - Match status (Scheduled, Completed, Draw, Cancelled)
  - Winner (for dual sports) or Qualifiers (for multi sports)
  - Points table (for league matches in dual sports)
- **Filter by Sport**: View schedules filtered by specific sport
- **Read-Only Access**: Regular players can view but not modify schedules

### 7. **Profile Management**

#### **View Profile**
- **Access**: Available to all authenticated users
- **Profile Information Displayed**:
  - Full Name
  - Registration Number
  - Gender
  - Department/Branch
  - Batch (assigned batch name)
  - Mobile Number
  - Email ID
  - Captain Roles: List of sports where user is assigned as captain
  - Coordinator Roles: List of sports where user is assigned as coordinator
  - Participation History: All sports/events registered for with team names (if applicable)
- **Event Year Filtering**: Profile data can be filtered by event year and event name

#### **Edit Profile (Admin Only)**
- **Editable Fields** (for other users, contact admin):
  - Full Name
  - Department/Branch
  - Mobile Number
  - Email ID
- **Non-Editable Fields** (for data integrity):
  - Registration Number
  - Gender
  - Batch (managed separately)
  - Password (use Change Password feature)
  - Participation records

### 8. **Year Selector (Admin Only)**
- **Year Switching**: Admin users can switch between different event years
- **Active Year Indicator**: Shows which year is currently active
- **Viewing Mode**: Allows viewing/managing data for past or future years
- **Auto-Selection**: Automatically selects active year on page load
- **Event Name Display**: Shows event name along with event year for clarity

---

## Coordinator User Features

Coordinators are players assigned by admin to manage specific sports. They have limited admin privileges for their assigned sports only.

### 1. **Sport Management (Assigned Sports Only)**
- **View Teams**: View all teams for assigned sports
- **View Participants**: View all participants for assigned individual sports
- **Manage Teams**: Update team members, delete teams for assigned sports
- **Manage Participants**: View participant lists for assigned sports

### 2. **Event Schedule Management (Assigned Sports Only)**
- **Create Matches**: Create matches for assigned sports
- **Update Matches**: Update match details, status, winners, qualifiers
- **Delete Matches**: Delete scheduled matches for assigned sports
- **View Schedules**: View all matches for assigned sports

### 3. **Points Table (Assigned Sports Only)**
- **View Points Table**: View points table for assigned dual sports
- **Cannot Backfill**: Points table backfill is admin-only

### 4. **Restrictions**
- **Cannot**: Edit or delete sports
- **Cannot**: Manage event years, departments, batches
- **Cannot**: Assign/remove captains or coordinators
- **Cannot**: Export data or perform bulk operations
- **Cannot**: Access admin dashboard for non-assigned sports
- **Cannot**: View or manage players outside their assigned sports

### 5. **Regular Player Features**
- Coordinators retain all regular player features (registration, profile, etc.)
- Can be assigned as captain for sports
- Can participate in events (subject to participation limits)

---

## Non-Admin User Features

### 1. **Individual Event Registration**

#### **For Individual/Cultural Events**
- **Enrollment**: Register for individual sports and cultural events
- **Direct Registration**: Single-click enrollment for events like:
  - Sprint events, Jump events, Throwing events
  - Cultural events (Essay Writing, Story Writing, Quiz, etc.)
  - Indoor games (Carrom, Chess)
- **Participation Status**: View enrollment status after registration
- **Tab Navigation**: 
  - If not participated: "Enroll Now" tab is shown first and auto-selected
  - If participated: "View Enrollment" tab is shown first and auto-selected
  - "View Events" tab always available
  - "Points Table" tab available for dual_player sports

#### **Registration Process**:
1. Click on a sport card
2. If not logged in, login prompt appears
3. After login, appropriate tabs appear based on participation status
4. Click "Enroll Now" to register
5. System validates participation limits
6. Success confirmation displayed
7. Modal closes automatically after successful registration

#### **Limitations**:
- Maximum 10 participations (unique sports)
- Cannot register for same sport twice
- Cannot register for team events individually
- Registration must be within registration period

### 2. **Team Event Registration (Captain Role)**

#### **Captain Assignment**
- **Captain Status**: Can be assigned as captain for team sports by admin
- **Captain Responsibilities**: Only captains can create teams for their assigned sports
- **Maximum Captain Roles**: Up to 10 captain assignments per player

#### **Team Creation Process**:
1. **Prerequisites**:
   - Must be assigned as captain for the sport (by admin)
   - Must not have already created a team for that sport
   - Must be within registration period
   
2. **Team Registration Steps**:
   - Click on team sport card
   - "Create Team" tab appears if user is captain and hasn't created team
   - Enter team name (must be unique for the sport)
   - Add team members by entering their registration numbers
   - System validates:
     - All players exist in database
     - Exactly one captain in team (the logged-in user)
     - All players have same gender
     - All players are in same year
     - No player is already in another team for this sport
     - Participation limits are not exceeded
     - Team size matches sport requirements (if applicable)
   - Submit team
   - Success confirmation displayed

#### **Team Management**:
- **View Team**: After creating a team, view team details including:
  - Team name
  - All team members with their details
  - Total team size
  - Captain information
- **Team Constraints**:
  - One team per captain per sport
  - Cannot modify team after creation (admin can update)
  - Cannot delete team (admin can delete)
  - Team name must be unique within the sport

### 3. **View Personal Information**
- **Profile Display**: View own registration details (see Profile Management section above)
- **Participation History**: See all sports/events registered for
- **Captain Roles**: View sports where assigned as captain
- **Coordinator Roles**: View sports where assigned as coordinator
- **Team Memberships**: View teams joined (if not captain)
- **Batch Information**: View assigned batch name

### 4. **Points Table (Dual Sports Only)**
- **League Standings**: View points table for dual_team and dual_player sports
- **Rankings**: See teams/players ranked by points (descending)
- **Statistics**: View:
  - Total points
  - Matches played
  - Matches won
  - Matches lost
  - Matches draw
  - Matches cancelled
- **Auto-Refresh**: Points table updates automatically when league match results are updated

### 5. **Participation Limits for Non-Admin Users**

#### **General Rules**:
- Maximum 10 unique sport participations
- Cannot participate in same sport twice
- Team events require team registration (cannot register individually)
- Registration must be within registration period

#### **Captain-Specific Rules**:
- Maximum 10 captain roles
- For captain sports: Team participations count towards captain limit
- For non-captain sports: Regular participation limit applies
- Formula: (Captain roles + Non-team participations) ≤ 10

#### **Team Participation Rules**:
- Can only be in one team per sport
- Team members must have same gender
- Team members must be in same batch (validated in the team creation UI)
- Cannot join multiple teams for same sport
- Team size must match sport requirements (for sports with fixed team size)

---

## Admin User Features

### 1. **Event Year Management**

#### **Create Event Year**
- **Process**:
  1. Navigate to Admin Dashboard → Event Years tab
  2. Fill in event year details:
     - Year (e.g., 2026, 2027) - **Required**
     - Event name - **Required** (e.g., "UMANG 2026", "Annual Sports 2027")
     - Event dates (start and end) - **Required**
     - Registration dates (start and end) - **Required**
     - Event organizer (optional, defaults to "Events Community")
     - Event title (optional, defaults to "Community Entertainment")
     - Event highlight (optional, defaults to "Community Entertainment Fest")
  3. Submit to create new event year
- **Validation**:
  - Year must be unique
  - Year must be a valid number
  - Event name is required (both year and event name are mandatory together)
  - Event dates must be valid date range
  - Registration dates must be valid date range
  - Registration dates must be before event dates
  - Registration start date cannot be in the past
  - Event start date cannot be in the past
- **Default Status**: New years are inactive by default
- **Note**: Event year creation is allowed even when no active event year exists (enables initial setup)

#### **Update Event Year**
- **Editable Fields**:
  - Event name
  - Event dates
  - Registration dates
  - Event organizer
  - Event title
  - Event highlight
- **Non-Editable Fields**:
  - Year (cannot be changed)
  - Created by (system field)
- **Update Restrictions**:
  - Updates are allowed until registration end date
  - Cannot update after registration period has ended
  - Date fields have restrictions based on whether registration/event has started/ended
  - Non-date fields cannot be updated after event ends

#### **Activate Event Year**
- **Process**: Select an event year and activate it
- **Effect**: 
  - Selected year becomes active
  - All other years are automatically deactivated
  - Only one year can be active at a time
  - Active year is used for default operations

#### **Delete Event Year**
- **Restrictions**:
  - Cannot delete active event year
  - Cannot delete if any data exists (sports, schedules, points entries)
  - Can only delete before registration start date
  - Cannot delete once registration period has started
- **Use Cases**: Remove unused or incorrectly created years before registration begins

### 2. **Sport Management**

#### **Create Sport**
- **Process**:
  1. Navigate to Admin Dashboard → Sports tab
  2. Select event year (or use active year)
  3. Fill in sport details:
     - Sport name (required, unique per event year and event name)
     - Event year (required, must be provided with event name)
     - Event name (required, must be provided with event year)
     - Sport type (dual_team, multi_team, dual_player, multi_player)
     - Category (team events, individual events, literary and cultural activities)
     - Team size (required for team sports, optional for others)
     - Image URI (optional, for sport image)
  4. Submit to create sport
- **Validation**:
  - Sport name must be unique for the event year and event name (event_id)
  - Both event year and event name are required together
  - Team size required for dual_team and multi_team types
  - Team size not allowed for dual_player and multi_player types
  - Category must match sport type

#### **Update Sport**
- **Editable Fields**:
  - Sport name (must remain unique for event year and event name)
  - Sport type (with validation)
  - Category
  - Team size (for team sports)
  - Image URI
- **Restrictions**:
  - Cannot change event_id
  - Sport must belong to the specified event year and event name (event_id validation)
  - Cannot update if matches or points entries exist
  - Optional query parameter: `event_id` (defaults to active event)

#### **Delete Sport**
- **Restrictions**:
  - Cannot delete if any matches exist
  - Cannot delete if any points table entries exist
  - Sport must belong to the specified event year and event name (event_id validation)
  - Optional query parameter: `event_id` (defaults to active event)
- **Use Cases**: Remove incorrectly created sports

### 3. **Department Management**

#### **Create Department**
- **Process**:
  1. Navigate to Admin Dashboard → Departments tab
  2. Fill in department details:
     - Department name (required, unique)
     - Department code (optional)
     - Display order (optional, defaults to 0)
  3. Submit to create department
- **Validation**:
  - Department name must be unique
  - Department name cannot be empty

#### **Update Department**
- **Editable Fields**:
  - Display order only
- **Non-Editable Fields**:
  - Department name (cannot be changed)
  - Department code (cannot be changed)

#### **Delete Department**
- **Restrictions**:
  - Cannot delete if any players are registered with this department
- **Use Cases**: Remove unused departments
- **Note**: Departments are not year-dependent and do not have an "active" concept

### 4. **Player Management**

#### **View All Players**
- **Player List**: View complete list of all registered players
- **Player Details**: See full information for each player including:
  - Registration number
  - Full name
  - Gender, Department, Batch
  - Contact information
  - Participation history
  - Captain assignments
  - Coordinator assignments
  - Team memberships
- **Search Functionality**: 
  - Search players by registration number, name, email, or department
  - Real-time search with debouncing
  - Server-side search for performance
- **Pagination**: 
  - Players displayed in pages (default: 20 per page)
  - Navigate through pages using pagination controls
  - Total count displayed
- **Event Year Filtering**: Filter players by event year and event name

#### **Update Player Information**
- **Editable Fields**:
  - Full Name
  - Department/Branch
  - Mobile Number
  - Email ID
- **Non-Editable Fields** (for data integrity):
  - Registration Number
  - Gender
  - Year
  - Password
  - Participation records
  - Captain assignments

#### **View Player Enrollments**
- **Enrollment Details**: View complete enrollment information for any player:
  - Non-team events: List of individual/cultural events player is enrolled in
  - Teams: List of teams player is part of (with team names and sports)
  - Matches: List of matches player has participated in (if any)
- **Access**: Click on player in player list to view enrollments
- **Event Year Filtering**: Enrollments filtered by event year and event name

#### **Remove Participation**
- **Individual Events**: Remove player participation from non-team events
- **Use Cases**: Correct registration errors, handle withdrawals
- **Restrictions**: Cannot remove team participations (must delete team first)

#### **Bulk Player Operations**
- **Bulk Enroll Players**: 
  - Enroll multiple players to a sport at once
  - Select players from list or enter registration numbers
  - Validates all players before enrollment
  - Shows success/error for each player
- **Bulk Delete Players**:
  - Remove multiple players from a sport at once
  - Shows enrollment details before deletion
  - Confirmation required for bulk operations
  - Validates that players can be removed (no team dependencies)
- **Use Cases**: Efficiently manage large numbers of participants

### 5. **Captain Management**

#### **Assign Captain Role**
- **Process**:
  1. Navigate to Admin Dashboard → Add/Remove Captain
  2. Select player by registration number
  3. Select team sport
  4. Select event year and event name (both required together)
  5. Assign captain role
- **Validation**:
  - Player must exist
  - Sport must be a team sport (dual_team or multi_team)
  - Player cannot already be captain for that sport
  - Maximum 10 captain roles per player
  - Player must meet participation limits
  - Both event year and event name are required together
- **Team Sports**: Only dual_team and multi_team sports can have captains

#### **Remove Captain Role**
- **Process**:
  1. Navigate to Admin Dashboard → Add/Remove Captain
  2. Select player by registration number
  3. Select sport
  4. Select event year and event name (both required together)
  5. Remove captain role
- **Restrictions**:
  - Cannot remove if player has created a team for that sport
  - Must delete team first before removing captain role
  - Both event year and event name are required together

#### **View Captains by Sport**
- **Grouped Display**: See all captains organized by sport
- **Captain List**: View all players assigned as captains for each team sport
- **Event Filtering**: Can filter by event year and event name (both or neither)

### 6. **Coordinator Management**

#### **Assign Coordinator Role**
- **Process**:
  1. Navigate to Admin Dashboard → Add/Remove Coordinator
  2. Select player by registration number
  3. Select sport
  4. Select event year and event name (both required together)
  5. Assign coordinator role
- **Validation**:
  - Player must exist
  - Sport must exist for the specified event year and event name
  - Player cannot already be coordinator for that sport
  - Both event year and event name are required together
- **Coordinator Permissions**: 
  - Can perform admin operations for their assigned sports only
  - Can view and manage teams for assigned sports
  - Can view and manage participants for assigned sports
  - Can create, update, and delete matches for assigned sports
  - Can update match status and declare winners/qualifiers for assigned sports
  - Can view points table for assigned sports
  - Can view teams and players for assigned sports
  - **Cannot**: Edit or delete sports
  - **Cannot**: Manage event years, departments, batches
  - **Cannot**: Assign/remove captains or coordinators
  - **Cannot**: Export data or perform bulk operations outside their sports

#### **Remove Coordinator Role**
- **Process**:
  1. Navigate to Admin Dashboard → Add/Remove Coordinator
  2. Select player by registration number
  3. Select sport
  4. Select event year and event name (both required together)
  5. Remove coordinator role
- **Restrictions**:
  - Both event year and event name are required together

#### **View Coordinators by Sport**
- **Grouped Display**: See all coordinators organized by sport
- **Coordinator List**: View all players assigned as coordinators for each sport
- **Event Filtering**: Can filter by event year and event name (both or neither)

### 7. **Batch Management**

#### **Create Batch**
- **Process**:
  1. Navigate to Admin Dashboard → Add/Remove Batch
  2. Enter batch name (e.g., "2024-2028", "2025 Batch")
  3. Select event year and event name (both required together)
  4. Submit to create batch
- **Validation**:
  - Batch name is required
  - Batch name must be unique for the event year and event name
  - Both event year and event name are required together
- **Use Cases**: Organize players by admission year or batch

#### **Delete Batch**
- **Process**:
  1. Navigate to Admin Dashboard → Add/Remove Batch
  2. Select batch to delete
  3. Select event year and event name (both required together)
  4. Confirm deletion
- **Restrictions**:
  - Both event year and event name are required together
  - Cannot delete if batch contains players

#### **View Batches**
- **Batch List**: View all batches for an event year and event name
- **Player List**: View all players in each batch
- **Event Filtering**: Can filter by event year and event name (both or neither)

### 8. **Team Management**

#### **View All Teams**
- **Team Listings**: View all teams for any sport
- **Team Details**: See complete team information:
  - Team name
  - All team members
  - Captain information
  - Team size
- **Filter by Sport**: View teams for specific sports

#### **Update Team Members**
- **Replace Player**: Replace a player in an existing team
- **Validation**:
  - New player must exist
  - New player must have same gender as team
  - New player must be in same batch as team (validated in UI)
  - New player cannot already be in another team for that sport
  - New player must meet participation limits
  - Cannot add multiple captains to same team
  - Cannot replace captain
- **Use Cases**: Handle player withdrawals, substitutions
- **Event Filtering**: Optional event year and event name parameters (both or neither)

#### **Delete Teams**
- **Team Deletion**: Remove entire team from a sport
- **Effect**: All team members' participation records updated
- **Use Cases**: Handle team withdrawals, correct registration errors
- **Event Filtering**: Optional event year and event name parameters in request body (both or neither)

### 9. **Participant Management**

#### **View Participants**
- **Individual Events**: View all participants for any individual/cultural sport
- **Participant List**: See complete list with player details
- **Count Display**: See total participant count

#### **Participant Counts**
- **Bulk View**: View participation counts for all sports at once
- **Team Counts**: See total teams for each team sport
- **Individual Counts**: See total participants for each individual/cultural sport

### 10. **Event Schedule Management**

#### **Create Matches**
- **Match Types**:
  - **League**: Round-robin style, all participants can compete (only for dual_team and dual_player)
  - **Knockout**: Elimination style, only winners/qualifiers proceed
  - **Final**: Final match of the tournament
- **Match Information**:
  - Sport selection
  - Match type (League/Knockout/Final)
  - Sport type (dual_team, multi_team, dual_player, multi_player)
  - Participants (teams or players)
  - Match date (must be today or future)
  - Event year and event name (optional, both or neither - defaults to active event year)
- **Auto-Numbering**: Match numbers auto-generated per sport (1, 2, 3...)
- **Validation**:
  - Participants must be different
  - For dual sports: Exactly 2 participants required
  - For multi sports: More than 2 participants required
  - All participants must have same gender
  - Match date cannot be in the past
  - Match date must be within event period (filtered by event_id)
  - League matches not allowed for multi_team and multi_player sports
  - Cannot schedule league matches if knockout matches exist
  - Knockout matches must be scheduled after all league matches
  - Final match restrictions (see below)
  - If event year is provided, event name must also be provided (or neither)

#### **Match Type Restrictions**:
- **League Matches**:
  - Only allowed for dual_team and dual_player sports
  - Cannot be scheduled if any knockout match exists
  - All participants can compete regardless of previous results
- **Knockout Matches**:
  - Allowed for all sport types
  - Participants must not be in another scheduled knockout match
  - Participants must not be knocked out from previous matches
  - Must be scheduled after all league matches (if league matches exist)
- **Final Matches**:
  - For dual sports: Must be set when exactly 2 eligible participants remain
  - For multi sports: Can be set when all eligible participants are in the match
  - Cannot schedule new matches if final match exists (scheduled or completed)
  - Can reschedule if final match is draw or cancelled

#### **Update Match Status**
- **Status Options**:
  - **Scheduled**: Match is planned
  - **Completed**: Match has finished
  - **Draw**: Match ended in tie
  - **Cancelled**: Match was cancelled
- **Restrictions**:
  - Cannot update status for future matches
  - Status can only be updated on or after match date
  - Cannot change status from completed/draw/cancelled to any other status
  - Once a match is completed/draw/cancelled, status cannot be changed

#### **Declare Winners (Dual Sports)**
- **Winner Selection**: Select winner from participants
- **Automatic Loser Assignment**: Other participant automatically marked as loser
- **Restrictions**:
  - Can only declare winner for completed matches
  - Cannot declare winner for future matches
  - Winner must be one of the participants
  - Status must be "completed" to set winner

#### **Set Qualifiers (Multi Sports)**
- **Qualifier Selection**: Select multiple qualifiers with positions (1st, 2nd, 3rd, etc.)
- **Process**:
  1. Mark match as completed
  2. Click "Qualified" button for each participant
  3. Positions are assigned automatically (1, 2, 3...)
  4. Click "Freeze" to save qualifiers
- **Restrictions**:
  - Can only set qualifiers for completed matches
  - Cannot set qualifiers for future matches
  - Qualifiers must be from match participants
  - Positions must be unique and sequential
- **Knockout Logic**: Participants not in qualifiers are marked as knocked out

#### **Delete Matches**
- **Deletion Rules**:
  - Can only delete matches with "scheduled" status
  - Can delete future matches (for rescheduling)
  - Cannot delete completed, draw, or cancelled matches
- **Use Cases**: Correct scheduling errors, reschedule matches
- **Rescheduling Process**:
  1. Delete the scheduled match
  2. Create new match with updated date/participants
  3. Match number may change (auto-generated)

#### **View Match Schedules**
- **Complete View**: See all matches for any sport
- **Match Details**: Full information including status, winners, qualifiers, dates
- **Filtering**: Filter by sport, status, date
- **Event Year Filtering**: Can filter by event year and event name (both or neither)
- **Teams and Players View**: 
  - View all teams and players eligible for a sport
  - Helps in match scheduling by showing available participants
  - Filtered by event year and event name

### 11. **Points Table Management**

#### **View Points Table**
- **Display**: View points table for dual_team and dual_player sports
- **Sorting**: Automatically sorted by points (descending), then matches won
- **Statistics**: Shows:
  - Participant name
  - Total points
  - Matches played
  - Matches won
  - Matches lost
  - Matches draw
  - Matches cancelled
- **Gender Filtering**: Points table filtered by gender (Male/Female)
- **Auto-Update**: Points table updates automatically when league match results change
- **Not Applicable**: Points table is not available for multi_team and multi_player sports
- **Event Year Filtering**: Can filter by event year and event name (both or neither)

#### **Backfill Points Table**
- **Purpose**: Recalculate points table entries for existing completed matches
- **Use Cases**: 
  - Points table entries missing for completed matches
  - Data inconsistencies after manual database changes
  - Recovering from errors
- **Process**:
  1. Navigate to Points Table for a sport
  2. Click "Backfill Points Table" button (admin only)
  3. System recalculates all points from completed league matches
  4. Updates points table entries
- **Restrictions**:
  - Admin only
  - Only allowed during event status update period
  - Only processes league matches (not knockout/final)
- **Result**: Shows number of entries processed and any errors

#### **Points Calculation**:
- **Winner**: 2 points
- **Loser**: 0 points
- **Draw**: 1 point each participant
- **Cancelled**: 1 point each participant
- **Automatic**: Points are calculated and updated automatically

### 12. **Data Export**

#### **Excel Export**
- **Export Function**: Download complete player data as Excel file
- **Data Included**:
  - Player Information:
    - Registration Number
    - Full Name
    - Gender
    - Department/Branch
    - Year (academic year)
    - Mobile Number
    - Email ID
  - Participation Status:
    - For each sport: Shows "CAPTAIN", "PARTICIPANT", or "NA"
    - For team sports: Additional column with team name
    - For individual sports: Shows "PARTICIPANT" or "NA"
  - Dynamic Sport Columns: All sports for the event year are included as columns
- **Format**: Standard Excel (.xlsx) format
- **Event Filtering**: Optional event year and event name query parameters (both or neither, defaults to active event year)
- **File Naming**: Automatically named as `Players_Report_{eventYear}_{date}.xlsx`
- **Use Cases**: 
  - Reporting and analysis
  - Record keeping
  - Sharing participation data
  - Generating reports for management
- **Access**: Admin only

### 13. **System Administration**

#### **Registration Period Management**
- **Period Enforcement**: System blocks new registrations outside registration period
- **Configurable**: Registration period set per event year and event name (event_id)
- **Effect**: After registration period ends, non-GET requests are blocked except event schedule, points table, event year, department, and password operations
- **Event Year Management**: Event year create/update/delete operations have custom date restrictions:
  - Create: Allowed (no past date restrictions for initial setup)
  - Update: Allowed until registration end date
  - Delete: Allowed only before registration start date

#### **Event Period Management**
- **Period Enforcement**: System blocks match scheduling outside event period
- **Configurable**: Event period set per event year and event name (event_id)
- **Effect**: Matches can only be scheduled within event period
- **Admin Override**: Admin can still manage matches outside event period

#### **Access Control**
- **Admin-Only Features**: Protected endpoints require admin authentication
- **User Verification**: System verifies user exists in database on each request
- **Token Validation**: JWT tokens validated on every authenticated request
- **Role-Based Access**: Different features available based on user role

---

## Sport Types and Registration Rules

### Sport Type System

The system uses four sport types:

1. **dual_team**: Team sport with exactly 2 teams per match (e.g., Badminton Doubles, Table Tennis Doubles)
2. **multi_team**: Team sport with more than 2 teams per match (e.g., Cricket, Volleyball)
3. **dual_player**: Individual sport with exactly 2 players per match (e.g., Chess, Carrom)
4. **multi_player**: Individual sport with more than 2 players per match (e.g., Sprint 100m, Long Jump)

### Team Events (dual_team, multi_team)

**Registration Rules**:
- Must register as a team (cannot register individually)
- Team must have exactly one captain
- Only assigned captains can create teams
- Team name must be unique per sport
- All team members must have same gender
- All team members must be in same year
- Players can only be in one team per sport
- Team size must match sport requirements (if sport has fixed team size)

**Examples**: Cricket, Volleyball, Badminton, Table Tennis, Kabaddi, Relay 4×100 m, Relay 4×400 m

### Individual Events (dual_player, multi_player)

**Registration Rules**:
- Individual registration only
- Cannot register as team
- Direct enrollment process
- One registration per player per sport
- Gender-based competition (participants must have same gender in matches)

**Examples**: 
- Sprint 100 m, Sprint 200 m, Sprint 400 m
- Long Jump, High Jump
- Javelin, Shot Put, Discus Throw
- Essay Writing, Story Writing, Group Discussion, Debate, Extempore, Quiz, Dumb Charades, Painting, Singing
- Carrom, Chess

---

## Match Types and Scheduling

### Match Type System

The system supports three match types:

1. **League**: Round-robin style matches (only for dual_team and dual_player)
2. **Knockout**: Elimination matches
3. **Final**: Final match of the tournament

### League Matches

**Purpose**: Round-robin style competition
**Rules**: 
- All participants can compete regardless of previous results
- Points are awarded (2 for win, 1 for draw/cancelled, 0 for loss)
- Points table is maintained automatically
- Only applicable for dual_team and dual_player sports
- Cannot be scheduled if any knockout match exists

**Use Case**: Group stages, preliminary rounds

### Knockout Matches

**Purpose**: Elimination tournament
**Rules**: 
- Only winners/qualifiers from previous matches can proceed
- Participants in scheduled knockout matches cannot be scheduled in new matches
- Participants knocked out from completed matches cannot be scheduled
- Must be scheduled after all league matches (if league matches exist)
- For dual sports: Winner proceeds, loser is knocked out
- For multi sports: Qualifiers proceed, others are knocked out

**Use Case**: Elimination rounds, semi-finals

### Final Matches

**Purpose**: Final match of the tournament
**Rules**:
- For dual sports: Must be set when exactly 2 eligible participants remain
- For multi sports: Can be set when all eligible participants are in the match
- Cannot schedule new matches if final match exists (scheduled or completed)
- Can reschedule if final match is draw or cancelled
- Once final match is completed, no further matches can be scheduled

**Use Case**: Finals, championship matches

### Match Statuses

1. **Scheduled**: Match is planned but not yet played
2. **Completed**: Match has finished, winner/qualifiers can be declared
3. **Draw**: Match ended in tie (no winner for dual sports)
4. **Cancelled**: Match was cancelled

### Match Scheduling Restrictions

#### **League Match Restrictions**:
- Only allowed for dual_team and dual_player sports
- Cannot be scheduled if any knockout match exists
- All participants can compete

#### **Knockout Match Restrictions**:
- Participants must not be in another scheduled knockout match
- Participants must not be knocked out from previous matches
- Must be scheduled after all league matches (if league matches exist)
- For dual sports: Only winner proceeds
- For multi sports: Only qualifiers proceed

#### **Final Match Restrictions**:
- Cannot schedule new matches if final match exists (scheduled or completed)
- Can reschedule if final match is draw or cancelled
- For dual sports: Must be set when exactly 2 eligible participants remain
- For multi sports: Can be set when all eligible participants are in the match

---

## Points Table System

### Overview

The points table system tracks league match performance for dual_team and dual_player sports only.

### Applicability

- **Applicable For**: dual_team and dual_player sports
- **Not Applicable For**: multi_team and multi_player sports (no league matches)

### Points Calculation

- **Winner**: 2 points
- **Loser**: 0 points
- **Draw**: 1 point each participant
- **Cancelled**: 1 point each participant

### Statistics Tracked

- **Points**: Total points accumulated
- **Matches Played**: Total matches participated
- **Matches Won**: Number of matches won
- **Matches Lost**: Number of matches lost
- **Matches Draw**: Number of matches ended in draw
- **Matches Cancelled**: Number of matches cancelled

### Display

- **Sorting**: Automatically sorted by points (descending), then matches won (descending)
- **Auto-Update**: Updates automatically when league match results change
- **Access**: Available to all users (admin and regular players)

### Usage

- **League Standings**: View current rankings
- **Knockout Qualification**: Identify top performers for knockout rounds
- **Performance Tracking**: Monitor team/player performance throughout league phase

---

## Event Year Management

### Overview

The system supports multiple event years, allowing management of annual sports events across different years.

### Event Year Structure

- **Year**: Unique year number (e.g., 2026, 2027)
- **Event Name**: Name of the event (e.g., "UMANG 2026", "Annual Sports 2027") - **Required with year**
- **Event Dates**: Start and end dates of the event
- **Registration Dates**: Start and end dates for registration period
- **Event Organizer**: Organizer name (default: "Events Community")
- **Event Title**: Event title (default: "Community Entertainment")
- **Event Highlight**: Event highlight text (default: "Community Entertainment Fest")
- **Is Active**: Boolean flag indicating active year (computed based on dates)
- **Event ID**: System uses `event_id` to identify unique events (derived from `event_year` + `event_name`)

### Active Year

- **Single Active Year**: Only one year can be active at a time
- **Auto-Deactivation**: Activating a year automatically deactivates all other years
- **Default Operations**: Active year is used for default operations when year is not specified
- **Display**: Active year is highlighted in the year selector

### Year Switching (Admin Only)

- **Year Selector**: Admin can switch between years using dropdown
- **Viewing Mode**: Allows viewing/managing data for any year and event name combination
- **Data Isolation**: Each event year and event name combination's data is isolated (sports, matches, participants)
- **Auto-Selection**: Active year is automatically selected on page load
- **Event Name Display**: Event name is displayed along with event year for clarity

### Registration and Event Periods

- **Registration Period**: Period during which players can register
- **Event Period**: Period during which matches can be scheduled
- **Enforcement**: System enforces these periods based on active year and event name (event_id)
- **Admin Override**: Admin can manage data outside these periods
- **Event ID**: Periods are identified by both event year and event name together

---

## Participation Limits and Constraints

### General Participation Limits

1. **Maximum Participations**: 10 unique sports per player
2. **No Duplicates**: Cannot participate in same sport twice
3. **Registration Period**: Registration only allowed during registration period
4. **Event Period**: Match scheduling only allowed during event period

### Captain-Specific Limits

1. **Maximum Captain Roles**: 10 captain assignments per player
2. **Team Participation Limit**: For captain sports, team participations count towards captain limit
3. **Formula**: (Captain roles + Non-team participations) ≤ 10

### Team Constraints

1. **One Team Per Sport**: Player can only be in one team per sport (per event year and event name)
2. **Gender Matching**: All team members must have same gender
3. **Batch Matching**: All team members must be in same batch (validated in UI)
4. **One Captain Per Team**: Each team must have exactly one captain
5. **Unique Team Names**: Team names must be unique within a sport (per event year and event name)
6. **Team Size**: Team size must match sport requirements (if sport has fixed team size)

### Match Scheduling Constraints

1. **Knockout Eligibility**: Only winners/qualifiers from previous matches can proceed
2. **Future Date Validation**: Cannot update status or declare winners for future matches
3. **Match Deletion**: Only scheduled matches can be deleted
4. **Winner Declaration**: Can only declare winners for completed matches
5. **Qualifier Setting**: Can only set qualifiers for completed matches
6. **Status Changes**: Cannot change status from completed/draw/cancelled to any other status
7. **Final Match Restrictions**: Cannot schedule new matches if final match exists (scheduled or completed)

---

## User Interface Features

### Modal System

- **Sport Details Modal**: Unified interface with tabs for different actions
- **Tab-Based Navigation**: Easy switching between view, create, and events
- **Context-Aware Tabs**: Tabs change based on user role and participation status
- **Auto-Selection**: Appropriate tab is auto-selected based on context

### Tab System

#### **For Non-Admin Users**:
- **Team Sports**:
  - If captain and not enrolled: "Create Team" tab
  - If enrolled or not captain: "View Team" tab
  - "View Events" tab always available
  - "Points Table" tab for dual_team sports
- **Individual Sports**:
  - If not participated: "Enroll Now" tab (auto-selected)
  - If participated: "View Enrollment" tab (auto-selected)
  - "View Events" tab always available
  - "Points Table" tab for dual_player sports

#### **For Admin Users**:
- **Team Sports**:
  - "View Teams" tab
  - "Events" tab
  - "Points Table" tab for dual_team sports
- **Individual Sports**:
  - "View Participants" tab
  - "Events" tab
  - "Points Table" tab for dual_player sports

### Status Notifications

- **Success Messages**: Green popup for successful operations
- **Error Messages**: Red popup for errors with clear descriptions
- **Auto-Dismiss**: Messages automatically disappear after few seconds
- **Non-Intrusive**: Messages don't block user interaction

### Loading States

- **Button Loading**: Buttons show loading state during API calls
- **Data Loading**: Loading indicators while fetching data
- **Prevent Multiple Submissions**: Buttons disabled during processing
- **Smooth Transitions**: Loading states provide visual feedback

### Responsive Design

- **Mobile Friendly**: Works on all device sizes
- **Touch Optimized**: Easy interaction on mobile devices
- **Adaptive Layout**: Layout adjusts to screen size
- **Consistent Experience**: Same functionality across devices

### Cache Management

- **Automatic Cache Clearing**: Cache is cleared after database operations
- **Immediate UI Refresh**: UI components refresh immediately after operations
- **Fresh Data**: Users always see up-to-date information
- **Optimized Performance**: Caching improves performance while maintaining data freshness

---

## Security Features

### Authentication

- **JWT Tokens**: Secure token-based authentication
- **Token Expiration**: Tokens expire after 24 hours
- **Auto-Logout**: Automatic logout on token expiration
- **Password Protection**: Passwords never sent in API responses
- **Secure Storage**: Tokens stored securely in browser

### Authorization

- **Role-Based Access**: Admin, coordinator, captain, and player roles
- **Endpoint Protection**: Admin-only endpoints protected
- **Coordinator Access**: Coordinators can perform admin operations (except editing/deleting sports) for their assigned sports only
- **Captain Access**: Captains can create teams for sports where they are assigned as captain
- **User Verification**: User existence verified on each request
- **Token Validation**: JWT tokens validated on every authenticated request
- **Event ID Filtering**: All operations use both event year and event name for proper data isolation

### Data Validation

- **Input Validation**: All inputs validated before processing
- **Duplicate Prevention**: System prevents duplicate registrations
- **Constraint Enforcement**: Business rules enforced at API level
- **Error Handling**: Comprehensive error handling and user feedback

### Period Enforcement

- **Registration Period**: New registrations blocked outside registration period
- **Event Period**: Match scheduling blocked outside event period
- **Admin Override**: Admin can manage data outside these periods
- **Automatic Enforcement**: System automatically enforces periods based on active year and event name (event_id)
- **Event Year Management**: Custom date restrictions for event year operations:
  - Create: Allowed (enables initial setup)
  - Update: Allowed until registration end date
  - Delete: Allowed only before registration start date

---

## Important Notes

1. **Registration Period**: New registrations are blocked outside the registration period defined for the active event year and event name
2. **Event Period**: Match scheduling is blocked outside the event period defined for the active event year and event name
3. **Admin Account**: Admin user has registration number "admin"
4. **Data Integrity**: Gender cannot be modified after registration
5. **Batch Assignment**: Players select a batch during registration (year field removed from player registration)
6. **Team Modifications**: Only admin and coordinators can modify teams after creation
7. **Match Scheduling**: Match dates cannot be in the past and must be within event period
8. **Future Matches**: Status updates and winner/qualifier selection blocked for future matches
9. **Knockout Validation**: System automatically validates knockout match eligibility
10. **Participation Limits**: All limits enforced by system, cannot be bypassed
11. **Points Table**: Only available for dual_team and dual_player sports
12. **League Matches**: Only allowed for dual_team and dual_player sports
13. **Final Matches**: Cannot schedule new matches if final match exists (scheduled or completed)
14. **Status Changes**: Cannot change status from completed/draw/cancelled to any other status
15. **Year Management**: Only one year can be active at a time (determined by dates)
16. **Event Year and Event Name**: Both parameters must be provided together when required, or neither when optional
17. **Event ID**: System uses both event year and event name to isolate data between different events
18. **Event Year Updates**: Updates allowed until registration end date; deletes allowed only before registration start date
19. **Cache Refresh**: UI components refresh immediately after database operations
20. **Coordinator Role**: Coordinators can perform admin operations for their assigned sports only

---

## Support and Troubleshooting

### Common Issues

1. **Cannot Register**: 
   - Check if registration period has ended
   - Verify you are logged in
   - Check participation limits

2. **Cannot Create Team**: 
   - Verify you are assigned as captain for that sport
   - Check if you have already created a team
   - Verify registration period is active
   - Verify you are included in the team
   - Check that all team members have same gender and batch (validated in UI)

3. **Participation Limit Reached**: 
   - Remove existing participation or contact admin
   - Check captain role assignments

4. **Team Creation Failed**: 
   - Check all team members meet requirements (gender, batch)
   - Verify team size matches sport requirements
   - Check if players are already in another team
   - Verify you are included in the team as captain
   - Check participation limits

5. **Login Issues**: 
   - Verify registration number and password are correct
   - Check if account exists
   - Try clearing browser cache

6. **Match Scheduling Failed**:
   - Check if match date is within event period
   - Verify participants are eligible
   - Check match type restrictions

### Getting Help

- Contact system administrator for:
  - Captain assignments
  - Coordinator assignments
  - Batch management
  - Team modifications
  - Participation limit issues
  - Account problems
  - Technical support
  - Event year management
  - Sport management
  - Event year and event name parameter issues

---

## Conclusion

This Annual Sports Event Management System provides comprehensive functionality for regular players, captains, coordinators, and administrators. Regular players can register for events, create teams (if captain), and view schedules and points tables. Captains can create teams for their assigned sports. Coordinators can perform admin operations for their assigned sports. Administrators have full control over event year management, sport management, department management, player management, team management, captain assignments, coordinator assignments, batch management, and event scheduling. The system uses event_id filtering (event year and event name) to ensure proper data isolation between different events. All business rules are enforced automatically to ensure data integrity and fair competition.

---

**Document Version**: 2.1  
**Last Updated**: January 2026  
**System**: UMANG - Annual Sports Event Management
