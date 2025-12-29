# Annual Sports Event Management System - User Functionality Report

## Overview

This report provides a comprehensive explanation of all functionalities available in the Annual Sports Event Management System (UMANG 2026) for both **Admin Users** and **Non-Admin Users** (Regular Players).

---

## Table of Contents

1. [Common Features (All Users)](#common-features-all-users)
2. [Non-Admin User Features](#non-admin-user-features)
3. [Admin User Features](#admin-user-features)
4. [Event Types and Registration Rules](#event-types-and-registration-rules)
5. [Participation Limits and Constraints](#participation-limits-and-constraints)
6. [Event Schedule Management](#event-schedule-management)

---

## Common Features (All Users)

### 1. **Homepage Access**
- **Event Information Display**: View event details including:
  - Event name: UMANG 2026
  - Event dates: January 9-13, 2026
  - Registration dates: January 2-6, 2026
  - Real-time countdown timer showing time until event start
- **Sports Overview**: Browse all available sports and events with visual cards showing sport images

### 2. **User Registration**
- **New Account Creation**: Register as a new player with the following information:
  - Registration Number (unique identifier)
  - Full Name
  - Gender (Male/Female)
  - Department/Branch (CSE, CSE (AI), ECE, EE, CE, ME, MTE)
  - Year (1st Year (2025), 2nd Year (2024), 3rd Year (2023), 4th Year (2022))
  - Mobile Number (10 digits)
  - Email ID (validated format)
  - Password
- **Validation**: All fields are validated before submission
- **Registration Deadline**: Registration closes on January 6, 2026 (enforced by system)

### 3. **User Login**
- **Authentication**: Login using Registration Number and Password
- **Session Management**: JWT token-based authentication
- **Persistent Sessions**: Stay logged in after page refresh
- **Auto-logout**: Automatic logout on token expiration or invalid credentials

### 4. **View Sports Information**
- **Sports List**: View all available sports organized by categories:
  - **Team Sports**: Cricket, Volleyball, Badminton, Table Tennis, Kabaddi, Relay 4×100 m, Relay 4×400 m
  - **Individual Sports**: Sprint 100 m, Sprint 200 m, Sprint 400 m, Long Jump, High Jump, Javelin, Shot Put, Discus Throw
  - **Cultural Events**: Essay Writing, Story Writing, Group Discussion, Debate, Extempore, Quiz, Dumb Charades, Painting, Singing
  - **Indoor Games**: Carrom, Chess
- **Participation Counts**: View total teams/participants count for each sport (when logged in)

### 5. **View Event Schedules**
- **Match Listings**: View all scheduled matches for any sport
- **Match Details**: See match information including:
  - Match number
  - Match type (League/Knockout)
  - Participants (teams or players)
  - Match date
  - Match status (Scheduled, Completed, Draw, Cancelled)
  - Winner (if match is completed)
- **Filter by Sport**: View schedules filtered by specific sport

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
- **Limitations**:
  - Maximum 10 participations (unique sports)
  - Cannot register for same sport twice
  - Cannot register for team events individually

#### **Registration Process**:
1. Click on a sport card
2. If not logged in, login prompt appears
3. After login, "Enroll Now" tab appears in sport details modal
4. Click "Enroll Now" to register
5. System validates participation limits
6. Success confirmation displayed

### 2. **Team Event Registration (Captain Role)**

#### **Captain Assignment**
- **Captain Status**: Can be assigned as captain for team sports by admin
- **Captain Responsibilities**: Only captains can create teams for their assigned sports

#### **Team Creation Process**:
1. **Prerequisites**:
   - Must be assigned as captain for the sport (by admin)
   - Must not have already created a team for that sport
   
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
   - Submit team
   - Success confirmation displayed

#### **Team Management**:
- **View Team**: After creating a team, view team details including:
  - Team name
  - All team members with their details
  - Total team size
- **Team Constraints**:
  - One team per captain per sport
  - Cannot modify team after creation (admin can update)
  - Cannot delete team (admin can delete)

### 3. **View Personal Information**
- **Profile Display**: View own registration details
- **Participation History**: See all sports/events registered for
- **Captain Roles**: View sports where assigned as captain
- **Team Memberships**: View teams joined (if not captain)

### 4. **View Event Schedules**
- **Read-Only Access**: View all scheduled matches
- **Match Information**: See complete match details
- **Status Tracking**: Monitor match status and results
- **No Editing**: Cannot create, modify, or delete matches

### 5. **Participation Limits for Non-Admin Users**

#### **General Rules**:
- Maximum 10 unique sport participations
- Cannot participate in same sport twice
- Team events require team registration (cannot register individually)

#### **Captain-Specific Rules**:
- Maximum 10 captain roles
- For captain sports: Team participations count towards captain limit
- For non-captain sports: Regular participation limit applies
- Formula: (Captain roles + Non-team participations) ≤ 10

#### **Team Participation Rules**:
- Can only be in one team per sport
- Team members must have same gender
- Team members must be in same year
- Cannot join multiple teams for same sport

---

## Admin User Features

### 1. **Player Management**

#### **View All Players**
- **Player List**: View complete list of all registered players
- **Player Details**: See full information for each player including:
  - Registration number
  - Full name
  - Gender, Department, Year
  - Contact information
  - Participation history
  - Captain assignments
- **Search and Filter**: Navigate through player list

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

#### **Remove Participation**
- **Individual Events**: Remove player participation from non-team events
- **Use Cases**: Correct registration errors, handle withdrawals
- **Restrictions**: Cannot remove team participations (must delete team first)

### 2. **Captain Management**

#### **Assign Captain Role**
- **Process**:
  1. Select player by registration number
  2. Select team sport
  3. Assign captain role
- **Validation**:
  - Player must exist
  - Sport must be a team sport
  - Player cannot already be captain for that sport
  - Maximum 10 captain roles per player
  - Player must meet participation limits
- **Team Sports**: Cricket, Volleyball, Badminton, Table Tennis, Kabaddi, Relay 4×100 m, Relay 4×400 m

#### **Remove Captain Role**
- **Process**:
  1. Select player by registration number
  2. Select sport
  3. Remove captain role
- **Restrictions**:
  - Cannot remove if player has created a team for that sport
  - Must delete team first before removing captain role

#### **View Captains by Sport**
- **Grouped Display**: See all captains organized by sport
- **Captain List**: View all players assigned as captains for each team sport

### 3. **Team Management**

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
  - New player must be in same year as team
  - New player cannot already be in another team for that sport
  - New player must meet participation limits
  - Cannot add multiple captains to same team
- **Use Cases**: Handle player withdrawals, substitutions

#### **Delete Teams**
- **Team Deletion**: Remove entire team from a sport
- **Effect**: All team members' participation records updated
- **Use Cases**: Handle team withdrawals, correct registration errors

### 4. **Participant Management**

#### **View Participants**
- **Individual Events**: View all participants for any individual/cultural sport
- **Participant List**: See complete list with player details
- **Count Display**: See total participant count

#### **Participant Counts**
- **Bulk View**: View participation counts for all sports at once
- **Team Counts**: See total teams for each team sport
- **Individual Counts**: See total participants for each individual/cultural sport

### 5. **Event Schedule Management**

#### **Create Matches**
- **Match Types**:
  - **League**: Round-robin style, all participants can compete
  - **Knockout**: Elimination style, only winners proceed
- **Match Information**:
  - Sport selection
  - Match type (League/Knockout)
  - Sport type (Team/Individual/Cultural)
  - Participants (teams or players)
  - Match date (must be today or future)
- **Auto-Numbering**: Match numbers auto-generated per sport (1, 2, 3...)
- **Validation**:
  - Participants must be different
  - For individual events: Players must have same gender
  - For knockout: Only winners from previous matches can be added
  - Match date cannot be in the past

#### **Update Match Status**
- **Status Options**:
  - **Scheduled**: Match is planned
  - **Completed**: Match has finished
  - **Draw**: Match ended in tie
  - **Cancelled**: Match was cancelled
- **Restrictions**:
  - Cannot update status for future matches
  - Status can only be updated on or after match date

#### **Declare Winners**
- **Winner Selection**: Select winner from participants
- **Automatic Loser Assignment**: Other participant automatically marked as loser
- **Restrictions**:
  - Can only declare winner for completed matches
  - Cannot declare winner for future matches
  - Winner must be one of the participants
  - Status must be "completed" to set winner

#### **Delete Matches**
- **Deletion Rules**:
  - Can only delete matches with "scheduled" status
  - Can delete future matches (for rescheduling)
  - Cannot delete completed, draw, or cancelled matches
- **Use Cases**: Correct scheduling errors, reschedule matches

#### **View Match Schedules**
- **Complete View**: See all matches for any sport
- **Match Details**: Full information including status, winners, dates
- **Filtering**: Filter by sport, status, date

### 6. **Data Export**

#### **Excel Export**
- **Export Function**: Download complete player data as Excel file
- **Data Included**:
  - All player information
  - Participation status for all sports
  - Captain assignments
  - Team memberships
- **Format**: Standard Excel (.xlsx) format
- **Use Cases**: Reporting, record keeping, analysis

### 7. **System Administration**

#### **Registration Deadline Management**
- **Deadline Enforcement**: System blocks new registrations after deadline
- **Configurable**: Deadline set via environment variable
- **Default**: January 6, 2026
- **Effect**: After deadline, only GET requests and login allowed

#### **Access Control**
- **Admin-Only Features**: Protected endpoints require admin authentication
- **User Verification**: System verifies user exists in database on each request
- **Token Validation**: JWT tokens validated on every authenticated request

---

## Event Types and Registration Rules

### Team Events
**Sports**: Cricket, Volleyball, Badminton, Table Tennis, Kabaddi, Relay 4×100 m, Relay 4×400 m

**Registration Rules**:
- Must register as a team (cannot register individually)
- Team must have exactly one captain
- Only assigned captains can create teams
- Team name must be unique per sport
- All team members must have same gender
- All team members must be in same year
- Players can only be in one team per sport

### Individual Events
**Sports**: Sprint 100 m, Sprint 200 m, Sprint 400 m, Long Jump, High Jump, Javelin, Shot Put, Discus Throw

**Registration Rules**:
- Individual registration only
- Cannot register as team
- Direct enrollment process
- One registration per player per sport

### Cultural Events
**Sports**: Essay Writing, Story Writing, Group Discussion, Debate, Extempore, Quiz, Dumb Charades, Painting, Singing

**Registration Rules**:
- Individual registration only
- Cannot register as team
- Direct enrollment process
- One registration per player per sport

### Indoor Games
**Sports**: Carrom, Chess

**Registration Rules**:
- Individual registration only
- Cannot register as team
- Direct enrollment process
- One registration per player per sport

---

## Participation Limits and Constraints

### General Participation Limits

1. **Maximum Participations**: 10 unique sports per player
2. **No Duplicates**: Cannot participate in same sport twice
3. **Registration Deadline**: Registration closes on January 6, 2026

### Captain-Specific Limits

1. **Maximum Captain Roles**: 10 captain assignments per player
2. **Team Participation Limit**: For captain sports, team participations count towards captain limit
3. **Formula**: (Captain roles + Non-team participations) ≤ 10

### Team Constraints

1. **One Team Per Sport**: Player can only be in one team per sport
2. **Gender Matching**: All team members must have same gender
3. **Year Matching**: All team members must be in same year
4. **One Captain Per Team**: Each team must have exactly one captain
5. **Unique Team Names**: Team names must be unique within a sport

### Match Scheduling Constraints

1. **Knockout Eligibility**: Only winners from previous matches can proceed
2. **Future Date Validation**: Cannot update status or declare winners for future matches
3. **Match Deletion**: Only scheduled matches can be deleted
4. **Winner Declaration**: Can only declare winners for completed matches

---

## Event Schedule Management

### Match Types

#### League Matches
- **Purpose**: Round-robin style competition
- **Rules**: All participants can compete regardless of previous results
- **Use Case**: Group stages, preliminary rounds

#### Knockout Matches
- **Purpose**: Elimination tournament
- **Rules**: Only winners from previous matches can proceed
- **Validation**: System automatically checks if participants lost previous matches
- **Use Case**: Finals, elimination rounds

### Match Statuses

1. **Scheduled**: Match is planned but not yet played
2. **Completed**: Match has finished, winner can be declared
3. **Draw**: Match ended in tie (no winner)
4. **Cancelled**: Match was cancelled

### Match Management Workflow

1. **Create Match**: Admin creates match with participants and date
2. **Match Scheduled**: Status is "scheduled" by default
3. **Match Day**: On or after match date, admin can update status
4. **Complete Match**: Admin sets status to "completed"
5. **Declare Winner**: Admin selects winner (if applicable)
6. **View Results**: All users can view match results

---

## User Interface Features

### Modal System
- **Sport Details Modal**: Unified interface with tabs for different actions
- **Tab-Based Navigation**: Easy switching between view, create, and events
- **Context-Aware Tabs**: Tabs change based on user role and participation status

### Status Notifications
- **Success Messages**: Green popup for successful operations
- **Error Messages**: Red popup for errors with clear descriptions
- **Auto-Dismiss**: Messages automatically disappear after few seconds

### Loading States
- **Button Loading**: Buttons show loading state during API calls
- **Data Loading**: Loading indicators while fetching data
- **Prevent Multiple Submissions**: Buttons disabled during processing

### Responsive Design
- **Mobile Friendly**: Works on all device sizes
- **Touch Optimized**: Easy interaction on mobile devices
- **Adaptive Layout**: Layout adjusts to screen size

---

## Security Features

### Authentication
- **JWT Tokens**: Secure token-based authentication
- **Token Expiration**: Tokens expire after 24 hours
- **Auto-Logout**: Automatic logout on token expiration
- **Password Protection**: Passwords never sent in API responses

### Authorization
- **Role-Based Access**: Admin and non-admin roles
- **Endpoint Protection**: Admin-only endpoints protected
- **User Verification**: User existence verified on each request

### Data Validation
- **Input Validation**: All inputs validated before processing
- **Duplicate Prevention**: System prevents duplicate registrations
- **Constraint Enforcement**: Business rules enforced at API level

---

## Important Notes

1. **Registration Deadline**: After January 6, 2026, new registrations are blocked
2. **Admin Account**: Admin user has registration number "admin"
3. **Data Integrity**: Gender and Year cannot be modified after registration
4. **Team Modifications**: Only admin can modify teams after creation
5. **Match Scheduling**: Match dates cannot be in the past
6. **Future Matches**: Status updates and winner selection blocked for future matches
7. **Knockout Validation**: System automatically validates knockout match eligibility
8. **Participation Limits**: All limits enforced by system, cannot be bypassed

---

## Support and Troubleshooting

### Common Issues

1. **Cannot Register**: Check if registration deadline has passed
2. **Cannot Create Team**: Verify you are assigned as captain for that sport
3. **Participation Limit Reached**: Remove existing participation or contact admin
4. **Team Creation Failed**: Check all team members meet requirements (gender, year)
5. **Login Issues**: Verify registration number and password are correct

### Getting Help

- Contact system administrator for:
  - Captain assignments
  - Team modifications
  - Participation limit issues
  - Account problems
  - Technical support

---

## Conclusion

This Annual Sports Event Management System provides comprehensive functionality for both regular players and administrators. Regular players can register for events, create teams (if captain), and view schedules. Administrators have full control over player management, team management, captain assignments, and event scheduling. The system enforces all business rules automatically to ensure data integrity and fair competition.

---

**Document Version**: 1.0  
**Last Updated**: January 2026  
**System**: UMANG 2026 - Annual Sports Event Management

