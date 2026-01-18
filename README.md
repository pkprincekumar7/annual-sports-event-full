# Event Management

Event Management For An Sports Event Organizer

A full-stack application for managing sports event management with React frontend and Express.js backend.

## Tech Stack

### Frontend
- **React 18** - UI Library
- **Vite** - Build tool and dev server
- **Tailwind CSS** - Utility-first CSS framework
- **JWT Authentication** - Token-based authentication

### Backend
- **Express.js** - Web framework
- **MongoDB** - Database (via Mongoose)
- **JWT** - JSON Web Tokens for authentication
- **XLSX** - Excel file generation
- **CORS** - Cross-origin resource sharing

## Deployment Guides

The deployment steps are now split by OS and topic for easier navigation:

- `docs/deployment/README.md` (index of all guides)
- Ubuntu: systemd, Docker Engine, Docker Compose, Nginx
- Windows: Docker Desktop, Docker Compose, services (NSSM)
- macOS: Docker Desktop, Docker Compose, launchd services
- Other options: static hosting, PaaS, Docker without Compose, Kubernetes

## Available Scripts

### Frontend Scripts
- `npm run dev` - Start Vite development server (frontend)
- `npm run build` - Build frontend for production
- `npm run preview` - Preview production build locally

### Backend Scripts
- `npm start` - Start backend server (production mode)
- `npm run server` - Start backend server (alias for `npm start`)
- `npm run dev:server` - Start backend server with auto-reload (development mode)

## Environment Variables

The application uses environment variables for configuration:

### Frontend Variables
- `VITE_API_URL` - API server URL (default: `http://localhost:3001`)

**Note:** Frontend environment variables must start with `VITE_` to be accessible in the frontend code.

### Backend Variables
- `PORT` - Backend server port (default: `3001`)
- `MONGODB_URI` - MongoDB connection string (default: `mongodb://localhost:27017/annual-sports-event`)
- `JWT_SECRET` - Secret key for JWT token signing (default: `your-secret-key-change-in-production`)

**Note:** Registration and event periods are now managed per event year through the Event Year management interface. The `REGISTRATION_DEADLINE` environment variable is no longer used.

### Email Configuration Variables
- `EMAIL_PROVIDER` - Email provider: `gmail`, `sendgrid`, `resend`, or `smtp` (default: `gmail`)
- `GMAIL_USER` - Gmail email address (required if using Gmail)
- `GMAIL_APP_PASSWORD` - Gmail app password (required if using Gmail)
- `SENDGRID_USER` - SendGrid username (usually `apikey`, required if using SendGrid)
- `SENDGRID_API_KEY` - SendGrid API key (required if using SendGrid)
- `RESEND_API_KEY` - Resend API key (required if using Resend)
- `EMAIL_FROM` - Sender email address (optional, uses provider default if not set)
- `EMAIL_FROM_NAME` - Sender display name (optional, default: `Sports Event Management`)
- `APP_NAME` - Application name for emails (optional, default: `Sports Event Management System`)

**Note:** For detailed email setup instructions, see **[EMAIL_SETUP.md](./docs/guides/EMAIL_SETUP.md)**.

Create a `.env` file in the root directory to set these values. For production builds, set these variables in your hosting platform's environment settings.

## Project Structure

```
├── public/
│   └── images/          # Static images
├── src/
│   ├── components/      # React components
│   │   ├── Navbar.jsx
│   │   ├── Hero.jsx
│   │   ├── SportsSection.jsx
│   │   ├── SportDetailsModal.jsx  # Unified modal for sport details (tabs)
│   │   ├── RegisterModal.jsx
│   │   ├── LoginModal.jsx
│   │   ├── AddCaptainModal.jsx
│   │   ├── RemoveCaptainModal.jsx
│   │   ├── TeamDetailsModal.jsx
│   │   ├── ParticipantDetailsModal.jsx
│   │   ├── EventScheduleModal.jsx  # Event schedule management
│   │   ├── PlayerListModal.jsx
│   │   ├── AboutSection.jsx
│   │   ├── Footer.jsx
│   │   ├── StatusPopup.jsx
│   │   └── ErrorBoundary.jsx  # React Error Boundary for error handling
│   ├── config/
│   │   └── api.js       # API configuration
│   ├── utils/
│   │   ├── api.js       # API utility functions (fetchWithAuth, decodeJWT, caching)
│   │   └── logger.js    # Logging utility for production-ready error handling
│   ├── App.jsx          # Main app component
│   ├── main.jsx         # Entry point
│   └── index.css        # Global styles with Tailwind
├── config/
│   └── database.js      # MongoDB connection configuration
├── models/
│   ├── Player.js        # Player Mongoose model with indexes
│   ├── Sport.js          # Sport Mongoose model (dual_team, multi_team, dual_player, multi_player)
│   ├── EventYear.js      # Event year Mongoose model (event_id derived from event_year + event_name)
│   ├── Department.js     # Department Mongoose model (not year-dependent)
│   ├── Batch.js          # Batch Mongoose model (organizes players by admission year)
│   ├── EventSchedule.js  # Event schedule Mongoose model (league, knockout, final)
│   └── PointsTable.js    # Points table Mongoose model (for league matches)
├── routes/              # Express.js route handlers
│   ├── auth.js          # Authentication routes (login, change-password, reset-password)
│   ├── players.js       # Player management routes (CRUD, enrollments, bulk operations)
│   ├── sports.js        # Sport management routes
│   ├── eventYears.js    # Event year management routes
│   ├── departments.js  # Department management routes
│   ├── batches.js       # Batch management routes
│   ├── teams.js         # Team management routes
│   ├── participants.js  # Participant management routes
│   ├── captains.js      # Captain management routes
│   ├── coordinators.js  # Coordinator management routes
│   ├── eventSchedule.js # Event schedule management routes
│   ├── pointsTable.js   # Points table routes (view, backfill)
│   └── exports.js       # Data export routes (Excel export)
├── utils/
│   ├── logger.js        # Backend logging utility
│   ├── cache.js         # In-memory cache utility
│   ├── errorHandler.js  # Error handling utilities
│   ├── yearHelpers.js   # Event year helper functions
│   ├── sportHelpers.js  # Sport helper functions
│   └── pointsTable.js   # Points table helper functions
├── server.js            # Express.js backend server
├── index.html
├── package.json         # Combined frontend and backend dependencies
├── vite.config.js
├── tailwind.config.js
├── postcss.config.js
└── .env                 # Environment variables (create this)
```

## Features

### Frontend Features
- ✅ Responsive design
- ✅ Countdown timer for event start with status messaging
- ✅ Dynamic registration form (team/individual events)
- ✅ Player login and JWT authentication
- ✅ Password management - Change password (authenticated users) and reset password (public via email)
- ✅ Profile management - View and edit profile information (admin can edit any player)
- ✅ Admin panel with comprehensive player management
- ✅ Coordinator role support - Coordinators can manage assigned sports
- ✅ Captain assignment and team management
- ✅ Batch management - Admin can create and manage batches for organizing players
- ✅ Team and individual event registration
- ✅ Participation tracking
- ✅ Total teams/participants count display - Shows total teams participated for team events and total players participated for non-team events on sports cards (logged-in users only)
- ✅ Already participated view - Shows popup with participation status and total count when user has already participated
- ✅ Unified sport details modal - Single modal with tabs for all sport-related actions (View Teams/Participants, Create Team/Enroll, View Events)
- ✅ Event schedule management - Admin/coordinators can create, view, update, and delete matches; users can view scheduled matches
- ✅ Match scheduling - Support for league, knockout, and final match types with automatic match number generation
- ✅ Match status updates - Admin/coordinators can update match status (scheduled, completed, draw, cancelled) with future date validation
- ✅ Winner/Loser selection - Admin/coordinators can declare winners for completed matches (dual sports) with automatic loser assignment
- ✅ Qualifiers system - Admin/coordinators can set qualifiers with positions for multi sports matches
- ✅ Future date restrictions - Status updates and winner/qualifier selection are blocked for future-dated matches (both frontend and backend validation)
- ✅ Points table display - View league standings with points, matches played, won, lost, draw, cancelled (dual sports only)
- ✅ Points table backfill - Admin/coordinator can recalculate points table entries for existing completed matches
- ✅ Year selector - Authenticated users can switch between events for viewing data
- ✅ Event year management - Admin can create, update, and delete event years (event_id derived from event_year + event_name)
- ✅ Sport management - Admin can create, update, and delete sports with sport types and categories
- ✅ Department management - Admin can create, update, and delete departments (not year-dependent)
- ✅ Player enrollment viewing - Admin can view all enrollments (non-team events, teams, matches) for any player
- ✅ Bulk player operations - Fetch enrollments and bulk delete players
- ✅ Player search and pagination - Server-side search and pagination for efficient player management
- ✅ Status popups for success/error messages
- ✅ Loading states for all API operations
- ✅ Form validation with proper error handling
- ✅ User data fetched from server (not stored in localStorage)
- ✅ All original styling preserved with Tailwind CSS
- ✅ Request caching and deduplication - Reduces API calls and improves performance (5 second TTL for all endpoints)
- ✅ Request cancellation - Prevents race conditions and memory leaks
- ✅ Response cloning - All error responses are cloned to prevent "body stream already read" errors
- ✅ Memory leak prevention - isMounted checks prevent state updates after component unmount
- ✅ Error Boundary - Catches React errors and displays user-friendly error UI
- ✅ Production-ready logging - Environment-aware logging utility (debug logs only in development)
- ✅ Persistent authentication - User stays logged in after page refresh (token-based)
- ✅ Modal behavior - Modals don't close on outside click (must use close button)

### Backend Features
- ✅ RESTful API with Express.js
- ✅ MongoDB database with optimized indexes
- ✅ JWT-based authentication with token expiration
- ✅ Password management - Change password and reset password (via email) endpoints
- ✅ Registration deadline enforcement - Uses active event year registration dates
- ✅ Excel export functionality - Comprehensive player data export with participation status
- ✅ Team and individual event management
- ✅ Captain role management - Assign and remove captain roles for team sports
- ✅ Coordinator role management - Assign and remove coordinator roles for sports
- ✅ Batch management - Create and manage batches for organizing players by admission year
- ✅ Participants count endpoint - Efficient aggregation-based endpoint for counting participants in non-team events
- ✅ Teams count in response - Team endpoints return total teams count along with team data
- ✅ Optimized MongoDB queries - Uses indexes and projections for better performance
- ✅ Password exclusion - Passwords never sent in API responses
- ✅ Production-ready logging - Environment-aware logging utility (debug logs only in development)
- ✅ Optimized user endpoint - `/api/me` endpoint for fetching current user with computed fields (more efficient than fetching all players)
- ✅ Bulk sports counts endpoint - `/api/sports-counts` fetches all team and participant counts in a single request
- ✅ Event schedule management - Full CRUD operations for match scheduling with automatic match number generation per sport
- ✅ Match eligibility validation - Automatic validation for knockout matches (only winners/qualifiers can proceed)
- ✅ Match status and winner management - Update match status and declare winners (dual sports) with comprehensive validation
- ✅ Qualifiers management - Set qualifiers with positions for multi sports matches
- ✅ Future date validation - Prevents status updates and winner/qualifier selection for future-dated matches (both frontend and backend)
- ✅ Points table system - Automatic points calculation and tracking for league matches (dual sports only)
- ✅ Points table backfill - Recalculate points table entries for existing completed matches (admin/coordinator)
- ✅ Event year management - Full CRUD operations for event years with registration and event periods (event_id derived from event_year + event_name)
- ✅ Sport management - Full CRUD operations for sports with sport types (dual_team, multi_team, dual_player, multi_player)
- ✅ Department management - Full CRUD operations for departments (not year-dependent, no "active" concept)
- ✅ Player enrollment viewing - View all enrollments (non-team events, teams, matches) for any player
- ✅ Bulk player operations - Bulk enroll and bulk delete players from sports
- ✅ Player search and pagination - Server-side search and pagination for efficient player management
- ✅ Role-based access control - Admin, coordinator, captain, and player roles with appropriate permissions
- ✅ Event filtering - All operations use event_id for proper data isolation
- ✅ In-memory caching - Request caching with configurable TTL for improved performance
- ✅ EventSchedule model - Database model for storing match schedules with support for all sport types
- ✅ PointsTable model - Database model for tracking league match points and statistics
- ✅ Sport model - Database model for sports with type, category, and participation tracking
- ✅ EventYear model - Database model for event years with registration and event periods
- ✅ Batch model - Database model for organizing players by admission year/batch

## API Integration

The frontend communicates with an external API server. All API calls are configured through:

- **Configuration file:** `src/config/api.js`
- **Environment variable:** `VITE_API_URL` (defaults to `http://localhost:3001`)
- **Utility functions:** `src/utils/api.js`

### API Calls

All API calls use relative paths (e.g., `/api/login`) which are automatically prepended with the configured API URL from `VITE_API_URL`.

### Backend API Endpoints

#### Authentication
- `POST /api/login` - User authentication (returns JWT token)
- `GET /api/me` - Get current user data (requires authentication, optimized endpoint, includes computed fields: participated_in, captain_in, coordinator_in, batch_name)
- `POST /api/change-password` - Change password (requires authentication)
- `POST /api/reset-password` - Reset password via email (public endpoint)

#### Player Management
- `GET /api/players` - Get all players with pagination and search (requires authentication, supports ?page, ?limit, ?search, ?event_id)
- `POST /api/save-player` - Register new player (public, during registration period)
- `POST /api/bulk-player-enrollments` - Fetch enrollments for multiple players (admin only)
- `PUT /api/update-player` - Update player data (admin only)
- `GET /api/player-enrollments/:reg_number` - Get all enrollments for a player (admin only, supports ?event_id)
- `POST /api/bulk-delete-players` - Bulk delete players (admin only)

#### Participation Management
- `POST /api/update-participation` - Update individual participation (requires authentication, requires event_id in body)
- `POST /api/update-team-participation` - Update team participation (requires authentication, requires event_id in body)
- `POST /api/validate-participations` - Validate participations before team registration (requires authentication)
- `DELETE /api/remove-participation` - Remove participation (admin only, requires event_id in body)

#### Captain Management
- `GET /api/sports` - Get sports list (public, supports ?event_id)
- `GET /api/captains-by-sport` - Get captains grouped by sport (admin/coordinator for assigned sports, supports ?event_id)
- `POST /api/add-captain` - Assign captain role (admin/coordinator for assigned sports, requires event_id)
- `DELETE /api/remove-captain` - Remove captain role (admin/coordinator for assigned sports, requires event_id)

#### Coordinator Management
- `GET /api/coordinators-by-sport` - Get coordinators grouped by sport (admin only, supports ?event_id)
- `POST /api/add-coordinator` - Assign coordinator role (admin only, requires event_id)
- `DELETE /api/remove-coordinator` - Remove coordinator role (admin only, requires event_id)

#### Batch Management
- `GET /api/batches` - Get all batches (public, supports ?event_id)
- `POST /api/add-batch` - Create new batch (admin only, requires event_id)
- `DELETE /api/remove-batch` - Delete batch (admin only, requires event_id)

#### Team Management
- `GET /api/teams/:sport` - Get teams for a specific sport (requires authentication, returns `total_teams` count, supports ?event_id)
- `POST /api/update-team-player` - Replace player in team (admin/coordinator only, requires event_id in body)
- `DELETE /api/delete-team` - Delete a team (admin/coordinator only, requires event_id in body)

#### Participant Management
- `GET /api/participants/:sport` - Get participants for a specific sport (admin/coordinator only, supports ?event_id)
- `GET /api/participants-count/:sport` - Get total participants count for a specific sport (requires authentication, no admin required, supports ?event_id)

#### Sports Counts (Bulk)
- `GET /api/sports-counts` - Get all teams and participants counts for all sports in a single request (requires authentication, optimized bulk endpoint)

#### Event Schedule Management
- `GET /api/event-schedule/:sport` - Get all matches for a specific sport (requires authentication, supports ?event_id)
- `GET /api/event-schedule/:sport/teams-players` - Get teams/players list for match scheduling dropdowns (admin/coordinator only, supports ?event_id)
- `POST /api/event-schedule` - Create a new match (admin/coordinator only, auto-generates match number per sport, requires event_id in body)
  - Supports match types: league (dual sports only), knockout, final
  - Validates participant eligibility for knockout/final matches
  - Enforces league vs knockout restrictions
  - Validates final match restrictions
  - Match date must be within event period
- `PUT /api/event-schedule/:id` - Update match winner, qualifiers, and status (admin/coordinator only)
  - Status updates: Can update status to 'completed', 'draw', 'cancelled', or 'scheduled'
  - Winner selection: Can declare winner for completed matches in dual sports (automatically marks other participant as loser)
  - Qualifiers selection: Can set qualifiers with positions for completed matches in multi sports
  - Future date validation: Status updates and winner/qualifier selection are blocked for future-dated matches
  - Status change restrictions: Cannot change status from completed/draw/cancelled to any other status
- `DELETE /api/event-schedule/:id` - Delete a match (admin/coordinator only, only if status is 'scheduled', allowed for future matches)

#### Points Table Management
- `GET /api/points-table/:sport` - Get points table for a specific sport (requires authentication, supports ?event_id, ?gender)
  - Only available for dual_team and dual_player sports
  - Returns points, matches played, won, lost, draw, cancelled
  - Automatically sorted by points (descending), then matches won (descending)
  - Gender parameter required (Male or Female)
- `POST /api/points-table/backfill/:sport` - Backfill points table for a sport (admin/coordinator for assigned sports, supports ?event_id)
  - Recalculates points table entries for existing completed matches
  - Only processes league matches

#### Event Year Management
- `GET /api/event-years` - Get all event years (authenticated users)
- `GET /api/event-years/active` - Get active event year (public)
- `POST /api/event-years` - Create new event year (admin only, requires event_year and event_name)
  - Allowed even when no active event year exists (enables initial setup)
- `PUT /api/event-years/:event_id` - Update event year (admin only)
  - Updates allowed until registration end date
  - Supports updating event_name, event dates, registration dates, organizer, title, highlight
- `DELETE /api/event-years/:event_id` - Delete event year (admin only)
  - Can only delete before registration start date
  - Cannot delete if active or if data exists

#### Sport Management
- `GET /api/sports` - Get all sports (public, supports ?event_id)
- `GET /api/sports/:name` - Get sport by name (public, supports ?event_id)
- `GET /api/sports-counts` - Get all sports with participation counts (requires authentication, supports ?event_id)
- `POST /api/sports` - Create new sport (admin only, requires event_id)
- `PUT /api/sports/:id` - Update sport (admin only, optional ?event_id)
- `DELETE /api/sports/:id` - Delete sport (admin only, optional ?event_id, only if no matches or points entries exist)

#### Department Management
- `GET /api/departments` - Get all departments (public, departments are not year-dependent, no "active" concept)
- `POST /api/departments` - Create new department (admin only)
- `PUT /api/departments/:id` - Update department (admin only, only display_order can be updated)
- `DELETE /api/departments/:id` - Delete department (admin only, only if no players are registered)

#### Data Export
- `GET /api/export-excel` - Export players data to Excel (admin only, supports ?event_id)
  - Includes all player information and participation status for all sports
  - Shows CAPTAIN, PARTICIPANT, or NA for each sport
  - Includes team names for team sports
  - Dynamic sport columns based on event

### Authentication

- Uses JWT (JSON Web Tokens) for authentication
- Token is stored in `localStorage` as `authToken`
- User data is fetched from the server on app mount and after login (not stored in localStorage)
- Token is automatically included in all authenticated API requests via `fetchWithAuth` utility
- On token expiration (401), user is logged out and redirected; 403 does not clear auth
- Authentication persistence: User stays logged in after page refresh - token is preserved and user data is automatically fetched on app mount
- Optimized user fetching: Uses `/api/me` endpoint to fetch only current user data (more efficient than `/api/players`)

### API Utility Functions

The application uses utility functions in `src/utils/api.js`:

- `fetchWithAuth(url, options)` - Makes authenticated API calls with automatic token inclusion, caching, and deduplication
- `fetchCurrentUser()` - Optimized function to fetch current user data using `/api/me` endpoint (uses cache, more efficient than fetching all players)
- `decodeJWT(token)` - Decodes JWT token on client side (for display purposes only)
- `clearCache(url)` - Clears cached data for a specific endpoint or all cache

### Logging and Error Handling

#### Frontend Logging (`src/utils/logger.js`)
- **Environment-aware logging**: Debug/info/warn logs only shown in development
- **Error logging**: Errors always logged (even in production)
- **API logging**: Special `api()` method for API-related debug information
- **Methods**: `debug()`, `info()`, `warn()`, `error()`, `api()`

#### Backend Logging (`utils/logger.js`)
- **Environment-aware logging**: Debug/info/warn logs only shown in development
- **Error logging**: Errors always logged (even in production)
- **Server logging**: Special `server()` method for server startup messages
- **Methods**: `debug()`, `info()`, `warn()`, `error()`, `api()`, `server()`

#### Error Boundary (`src/components/ErrorBoundary.jsx`)
- **React Error Boundary**: Catches JavaScript errors in component tree
- **User-friendly UI**: Displays error message with "Try Again" and "Refresh Page" options
- **Development mode**: Shows detailed error information and stack trace
- **Production mode**: Shows clean error message without technical details

### Performance Optimizations

#### Frontend API Caching
- **Request Caching**: GET requests are cached with configurable TTL (all set to 5 seconds)
  - All endpoints: 5 seconds TTL for consistent behavior
- **Request Deduplication**: Identical concurrent requests share the same promise
- **Request Cancellation**: All API calls support AbortController for cancellation
- **Cache Invalidation**: Automatic cache clearing on authentication failures
- **Response Cloning**: All responses are cloned to prevent "body stream already read" errors when multiple consumers read the same response

#### Backend MongoDB Optimizations
- **Database Indexes**: Optimized indexes on frequently queried fields
  - `reg_number` (unique index)
  - `captain_in` array field
  - `participated_in.sport` and `participated_in.team_name` (compound index)
- **Query Optimizations**:
  - Password fields excluded from responses using `.select('-password')`
  - Query deduplication in validation endpoints
  - Efficient array queries using `$elemMatch`
  - Lean queries for read-only operations

## Development

### Running Locally

1. Ensure MongoDB is running (local or remote)
2. Set environment variables in `.env` file:
   - `VITE_API_URL` (defaults to `http://localhost:3001` if not set)
   - `MONGODB_URI` (defaults to `mongodb://localhost:27017/annual-sports-event`)
   - `JWT_SECRET` (use a strong secret in production)
   - `PORT` (defaults to `3001`)

3. Start the backend server:
   ```bash
   npm run dev:server  # Development mode with auto-reload
   # or
   npm run server      # Production mode
   ```

4. In a separate terminal, start the frontend development server:
   ```bash
   npm run dev
   ```

5. Open `http://localhost:5173` in your browser

### Building for Production

1. Set environment variables for production in `.env` or hosting platform settings
2. Build the frontend:
   ```bash
   npm run build
   ```
3. The `dist/` folder contains the production build
4. Start the backend server:
   ```bash
   npm start
   ```
5. Deploy both frontend (`dist/` folder) and backend (`server.js` and related files) to your hosting platform

## Production Deployment

Production instructions are split by OS and topic in `docs/deployment/README.md`.
Use those guides for Ubuntu systemd + Nginx, Windows services, macOS launchd, Docker, and Docker Compose.

## Component Overview

### Main Components

- **App.jsx** - Main application component, handles routing, authentication state, and user data management
- **Hero.jsx** - Hero section with event countdown timer and welcome message
- **SportsSection.jsx** - Displays available sports and handles sport selection
- **Navbar.jsx** - Navigation bar with login/logout functionality

### Modal Components

- **SportDetailsModal.jsx** - Unified modal for sport details with tabbed interface
  - Shows different tabs based on user role (admin/non-admin), sport type, and participation status
  - Tabs: View Teams/Participants, Create Team/Enroll, View Enrollment, View Events, Points Table
  - Auto-selects appropriate tab based on context (e.g., "Enroll Now" if not participated)
  - Embeds other modals as content (RegisterModal, TeamDetailsModal, ParticipantDetailsModal, EventScheduleModal, PointsTableModal)
- **AdminDashboardModal.jsx** - Admin dashboard for managing event years, sports, and departments
  - Three tabs: Event Years, Sports, Departments
  - Full CRUD operations for each entity
  - Year selector integration for sports management
- **EventYearSelector.jsx** - Event selector component for authenticated users
  - Allows switching between events
  - Shows active year indicator
  - Auto-selects active year on load
- **PointsTableModal.jsx** - Points table display for dual sports
  - Shows league standings with points and statistics
  - Auto-refreshes when tab becomes active
  - Sorted by points (descending), then matches won (descending)
- **RegisterModal.jsx** - Handles player registration and event participation (team/individual)
  - Shows total teams count for team event registration
  - Shows total participants count for non-team event registration
  - Displays "Already Participated" view with total count when user has already participated
  - Can be embedded in SportDetailsModal
- **LoginModal.jsx** - User login form
- **AddCaptainModal.jsx** - Admin interface for assigning captain roles
- **RemoveCaptainModal.jsx** - Admin interface for removing captain roles
- **TeamDetailsModal.jsx** - Displays team details and allows team management
  - Shows total teams participated count for all users
  - Can be embedded in SportDetailsModal
- **ParticipantDetailsModal.jsx** - Displays individual participant details
  - Can be embedded in SportDetailsModal
- **EventScheduleModal.jsx** - Event schedule management interface
  - Admin: Create, view, update, and delete matches
    - Create matches with league (dual sports only), knockout, or final type
    - Dynamic match type dropdown based on sport type and participant count
    - Gender-based participant filtering for match scheduling
    - Update match status (scheduled, completed, draw, cancelled) - only for non-future matches
    - Declare winners for completed matches in dual sports - automatically marks other participant as loser
    - Set qualifiers with positions for completed matches in multi sports
    - Remove matches (only scheduled matches, including future matches)
  - Users: View scheduled matches with full details
  - Supports league, knockout, and final match types
  - Auto-generates match numbers per sport
  - Validates match eligibility (knockout/final matches only allow eligible participants)
  - Enforces league vs knockout restrictions
  - Enforces final match restrictions
  - Future date validation: Status dropdown and winner/qualifier buttons hidden for future matches
  - Winner/Loser badges: Visual indicators for completed matches with declared winners
  - Qualifiers display: Shows qualifiers with positions for multi sports matches
  - Can be embedded in SportDetailsModal
- **PlayerListModal.jsx** - Admin interface for viewing and editing all players

### Utility Components

- **StatusPopup.jsx** - Displays success/error messages
- **AboutSection.jsx** - About section content
- **Footer.jsx** - Footer content
- **ErrorBoundary.jsx** - React Error Boundary for catching and handling React errors

## State Management

The application uses React hooks for state management:

- **Local State** - `useState` for component-level state
- **Effects** - `useEffect` for side effects (API calls, timers)
- **Authentication** - JWT token stored in `localStorage`, user data in component state
- **User Data** - Fetched from server on mount and after updates, not persisted in localStorage

## Performance Features

### Frontend Optimizations
- **Request Caching**: Reduces redundant API calls by caching GET requests (5 second TTL)
- **Request Deduplication**: Prevents multiple identical requests from executing simultaneously
- **Request Cancellation**: All API calls support cancellation to prevent memory leaks
- **Response Cloning**: All responses are cloned to allow multiple consumers without "body stream already read" errors
- **Memory Leak Prevention**: isMounted checks prevent state updates after component unmount
- **Optimized User Fetching**: Uses `fetchCurrentUser()` helper with dedicated `/api/me` endpoint (fetches only current user, not all players)
- **Bulk Counts Fetching**: Uses `/api/sports-counts` to fetch all team and participant counts in a single request

### Backend Optimizations
- **MongoDB Indexes**: Strategic indexes on frequently queried fields
- **Query Projections**: Password fields excluded from all responses
- **Lean Queries**: Read-only queries use `.lean()` for better performance
- **Efficient Array Queries**: Uses `$elemMatch` for complex array queries
- **Query Deduplication**: Combined queries where possible to reduce database calls

## Notes

- Images are stored in `public/images/` directory
- Admin user credentials: Registration Number: `admin`
- All API calls are made through `src/utils/api.js` utility functions with caching support
- The application uses relative API paths that are automatically resolved using the configured base URL
- Form submissions show loading states only during actual API calls, not during client-side validation
- Error handling ensures buttons are re-enabled after API errors so users can retry
- MongoDB indexes are automatically created when the Player model is first loaded
- Cache is automatically cleared on authentication failures
- Request cancellation prevents state updates after component unmount
- Response cloning prevents "body stream already read" errors when multiple components consume the same response
- Memory leak prevention: All async state updates check isMounted before updating state
- Error Boundary wraps the entire application to catch and handle React errors gracefully
- Logging utilities are used throughout the codebase for production-ready error tracking
- All console statements have been replaced with logger utilities for better production control
- Authentication persistence: User authentication is preserved across page refreshes using JWT tokens stored in localStorage
- Optimized API calls: `/api/me` endpoint fetches only current user data instead of all players, improving performance and reducing network traffic
- Bulk counts API: `/api/sports-counts` fetches all team and participant counts in a single request, reducing API calls
- Modal UX: Modals require explicit close action (X button or Cancel) - they don't close on outside click to prevent accidental closures
- Event Schedule: Match numbers are auto-generated per sport (e.g., Cricket: 1, 2, 3; Volleyball: 1, 2, 3)
- Sport Types: System supports four sport types - dual_team, multi_team, dual_player, multi_player
- Match Types: System supports three match types - league (dual sports only), knockout, final
- Match Eligibility: Knockout/final matches automatically validate that only eligible participants (winners/qualifiers) can proceed
- League Matches: Only allowed for dual_team and dual_player sports, cannot be scheduled if knockout matches exist
- Final Matches: Cannot schedule new matches if final match exists (scheduled or completed), can reschedule if draw or cancelled
- Match Deletion: Only matches with 'scheduled' status can be deleted by admin/coordinator (including future matches)
- Match Status Updates: Status can only be updated for matches that are not in the future (both frontend and backend validation)
- Status Change Restrictions: Cannot change status from completed/draw/cancelled to any other status
- Winner Selection: Winners can only be declared for completed matches in dual sports that are not in the future (both frontend and backend validation)
- Qualifiers Selection: Qualifiers can only be set for completed matches in multi sports that are not in the future
- Winner/Loser Assignment: When a winner is selected in dual sports, the other participant is automatically marked as loser
- Qualifiers Assignment: When qualifiers are set in multi sports, participants not in qualifiers are marked as knocked out
- Points Table: Automatically calculated and updated for league matches in dual sports (2 points for win, 1 for draw/cancelled, 0 for loss)
- Points Table Backfill: Admin/coordinator can recalculate points table entries for existing completed matches
- Remove Button: Available for all scheduled matches (including future matches) to allow cancellation/rescheduling
- Status Dropdown: Only visible for scheduled matches that are not in the future
- Event Year Management: Registration and event periods are managed per event year with derived event_id
- Event Filtering: All operations use event_id for proper data isolation
- Event Year Restrictions: Updates allowed until registration end date; deletes allowed only before registration start date
- Year Selector: Authenticated users can switch between events to view data for different years
- Coordinator Role: Coordinators can perform admin operations (except editing/deleting sports) for their assigned sports only
- Batch Management: Players are organized by batches (year field removed from player registration)
- Password Management: Change password (authenticated users) and reset password (public via email)
- Profile Management: View and edit profile information with participation history, captain roles, coordinator roles
- Bulk Operations: Bulk enroll and bulk delete players from sports
- Player Search: Server-side search and pagination for efficient player management
- Player Enrollments: Admin can view all enrollments (non-team events, teams, matches) for any player
- Departments: Not year-dependent, no "active" concept
- Cache Management: Both frontend and backend use caching with automatic cache invalidation after database operations

## Security Considerations

### Current Implementation
- ✅ JWT-based authentication with token expiration
- ✅ Password fields excluded from all API responses
- ✅ Input validation on all endpoints
- ✅ Admin-only endpoints properly protected
- ✅ CORS configuration for cross-origin requests
- ✅ Error messages don't expose sensitive information

### Recommendations for Production
- ⚠️ **Password Hashing**: Currently passwords are stored in plain text. For production, implement password hashing using bcrypt or similar library
- ⚠️ **JWT Secret**: Ensure `JWT_SECRET` is set via environment variable and uses a strong, random secret
- ⚠️ **CORS**: Restrict CORS origins to specific domains in production instead of allowing all origins
- ⚠️ **HTTPS**: Always use HTTPS in production to encrypt data in transit
- ⚠️ **Rate Limiting**: Consider implementing rate limiting to prevent abuse
- ⚠️ **Input Sanitization**: Consider additional input sanitization for XSS prevention

## Documentation

### Deployment Guides
For OS-specific setup and deployment instructions, see **[docs/deployment/README.md](./docs/deployment/README.md)**.

### User Guide
For comprehensive user documentation covering all features, functionality, and usage instructions, see **[USER_GUIDE.md](./USER_GUIDE.md)**.

The user guide covers:
- Common features for all users
- Non-admin user features
- Admin user features
- Sport types and registration rules
- Match types and scheduling
- Points table system
- Event year management
- Participation limits and constraints
- User interface features
- Security features

### Splitting Backend and Frontend

If you need to separate the backend and frontend into independent applications, see **[SPLIT_GUIDE.md](./SPLIT_GUIDE.md)** for detailed step-by-step instructions.

The split guide covers:
- Creating separate backend and frontend directories
- Configuring independent package.json files
- Setting up environment variables
- Deployment considerations
- Troubleshooting common issues

## License

[Add your license information here]
