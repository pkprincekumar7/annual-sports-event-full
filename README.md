# PCE Annual Sports - UMANG 2026

Annual Sports Events Registration Portal for Purnea College of Engineering, Purnea.

A full-stack application for managing annual sports event registrations with React frontend and Express.js backend.

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

## Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- MongoDB (local or remote instance)

## Installation

1. Clone the repository:
```bash
git clone https://github.com/pkprincekumar7/annual-sports-event-full.git
cd annual-sports-event-full
```

2. Install dependencies:
```bash
npm install
```

## Available Scripts

### Frontend Scripts
- `npm run dev` - Start Vite development server (frontend)
- `npm run build` - Build frontend for production
- `npm run preview` - Preview production build locally

### Backend Scripts
- `npm start` - Start backend server (production mode)
- `npm run server` - Start backend server (alias for `npm start`)
- `npm run dev:server` - Start backend server with auto-reload (development mode)

### Combined Development
For full-stack development, run both servers:
1. Terminal 1: `npm run dev:server` (backend)
2. Terminal 2: `npm run dev` (frontend)

3. Create a `.env` file in the root directory:
```env
# Frontend Configuration
VITE_API_URL=http://localhost:3001

# Backend Configuration
PORT=3001
MONGODB_URI=mongodb://localhost:27017/annual-sports-event
JWT_SECRET=your-secret-key-change-in-production
REGISTRATION_DEADLINE=2026-01-07T00:00:00
```

For production, update these values accordingly:
```env
VITE_API_URL=https://your-api-server.com
MONGODB_URI=mongodb://your-mongodb-connection-string
JWT_SECRET=your-strong-secret-key
```

4. Start the backend server:
```bash
# Development mode with auto-reload
npm run dev:server

# Or production mode
npm run server
# or
npm start
```

   The backend server will run on `http://localhost:3001` (or the port specified in `.env`)

5. Start the frontend development server (in a separate terminal):
```bash
npm run dev
```

   The frontend application will run on `http://localhost:5173` (Vite default port)

6. Build for production:
```bash
npm run build
```

7. Preview production build:
```bash
npm run preview
```

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
│   ├── EventYear.js      # Event year Mongoose model
│   ├── Department.js     # Department Mongoose model
│   ├── EventSchedule.js  # Event schedule Mongoose model (league, knockout, final)
│   └── PointsTable.js    # Points table Mongoose model (for league matches)
├── routes/              # Express.js route handlers
│   ├── auth.js          # Authentication routes
│   ├── players.js       # Player management routes
│   ├── sports.js        # Sport management routes
│   ├── eventYears.js    # Event year management routes
│   ├── departments.js  # Department management routes
│   ├── teams.js         # Team management routes
│   ├── participants.js  # Participant management routes
│   ├── captains.js      # Captain management routes
│   ├── eventSchedule.js # Event schedule management routes
│   ├── pointsTable.js   # Points table routes
│   └── exports.js       # Data export routes
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
- ✅ Countdown timer for event start (shows "Registration closed!" when timer reaches zero)
- ✅ Dynamic registration form (team/individual events)
- ✅ Player login and JWT authentication
- ✅ Admin panel with player management
- ✅ Captain assignment and team management
- ✅ Team and individual event registration
- ✅ Participation tracking and limits
- ✅ Total teams/participants count display - Shows total teams participated for team events and total players participated for non-team events on sports cards (logged-in users only)
- ✅ Already participated view - Shows popup with participation status and total count when user has already participated
- ✅ Unified sport details modal - Single modal with tabs for all sport-related actions (View Teams/Participants, Create Team/Enroll, View Events)
- ✅ Event schedule management - Admin can create, view, update, and delete matches; users can view scheduled matches
- ✅ Match scheduling - Support for league, knockout, and final match types with automatic match number generation
- ✅ Match status updates - Admin can update match status (scheduled, completed, draw, cancelled) with future date validation
- ✅ Winner/Loser selection - Admin can declare winners for completed matches (dual sports) with automatic loser assignment
- ✅ Qualifiers system - Admin can set qualifiers with positions for multi sports matches
- ✅ Future date restrictions - Status updates and winner/qualifier selection are blocked for future-dated matches (both frontend and backend validation)
- ✅ Points table display - View league standings with points, matches played, won, lost, draw, cancelled (dual sports only)
- ✅ Year selector - Admin can switch between event years for viewing/managing data
- ✅ Event year management - Admin can create, update, activate, and delete event years
- ✅ Sport management - Admin can create, update, and delete sports with sport types and categories
- ✅ Department management - Admin can create, update, and delete departments
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
- ✅ JWT-based authentication
- ✅ Registration deadline enforcement
- ✅ Excel export functionality
- ✅ Team and individual event management
- ✅ Captain role management
- ✅ Participants count endpoint - Efficient aggregation-based endpoint for counting participants in non-team events
- ✅ Teams count in response - Team endpoints return total teams count along with team data
- ✅ Optimized MongoDB queries - Uses indexes and projections for better performance
- ✅ Password exclusion - Passwords never sent in API responses
- ✅ Production-ready logging - Environment-aware logging utility (debug logs only in development)
- ✅ Optimized user endpoint - `/api/me` endpoint for fetching current user (more efficient than fetching all players)
- ✅ Bulk sports counts endpoint - `/api/sports-counts` fetches all team and participant counts in a single request
- ✅ Event schedule management - Full CRUD operations for match scheduling with automatic match number generation per sport
- ✅ Match eligibility validation - Automatic validation for knockout matches (only winners/qualifiers can proceed)
- ✅ Match status and winner management - Update match status and declare winners (dual sports) with comprehensive validation
- ✅ Qualifiers management - Set qualifiers with positions for multi sports matches
- ✅ Future date validation - Prevents status updates and winner/qualifier selection for future-dated matches (both frontend and backend)
- ✅ Points table system - Automatic points calculation and tracking for league matches (dual sports only)
- ✅ Event year management - Full CRUD operations for event years with registration and event periods
- ✅ Sport management - Full CRUD operations for sports with sport types (dual_team, multi_team, dual_player, multi_player)
- ✅ Department management - Full CRUD operations for departments
- ✅ In-memory caching - Request caching with configurable TTL for improved performance
- ✅ EventSchedule model - Database model for storing match schedules with support for all sport types
- ✅ PointsTable model - Database model for tracking league match points and statistics
- ✅ Sport model - Database model for sports with type, category, and participation tracking
- ✅ EventYear model - Database model for event years with registration and event periods

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
- `GET /api/me` - Get current user data (requires authentication, optimized endpoint)

#### Player Management
- `GET /api/players` - Get all players (requires authentication)
- `POST /api/save-player` - Register new player
- `POST /api/save-players` - Register multiple players (batch)
- `PUT /api/update-player` - Update player data (admin only)

#### Participation Management
- `POST /api/update-participation` - Update individual participation (requires authentication)
- `POST /api/update-team-participation` - Update team participation (requires authentication)
- `POST /api/validate-participations` - Validate participations before team registration
- `DELETE /api/remove-participation` - Remove participation (admin only)

#### Captain Management
- `GET /api/sports` - Get team sports list (admin only)
- `GET /api/captains-by-sport` - Get captains grouped by sport (admin only)
- `POST /api/add-captain` - Assign captain role (admin only)
- `DELETE /api/remove-captain` - Remove captain role (admin only)

#### Team Management
- `GET /api/teams/:sport` - Get teams for a specific sport (requires authentication, returns `total_teams` count)
- `POST /api/update-team-player` - Replace player in team (admin only)
- `DELETE /api/delete-team` - Delete a team (admin only)

#### Participant Management
- `GET /api/participants/:sport` - Get participants for a specific sport (admin only)
- `GET /api/participants-count/:sport` - Get total participants count for a specific sport (requires authentication, no admin required)

#### Sports Counts (Bulk)
- `GET /api/sports-counts` - Get all teams and participants counts for all sports in a single request (requires authentication, optimized bulk endpoint)

#### Event Schedule Management
- `GET /api/event-schedule/:sport` - Get all matches for a specific sport (requires authentication, supports ?year parameter)
- `GET /api/event-schedule/:sport/teams-players` - Get teams/players list for match scheduling dropdowns (admin only, supports ?year parameter)
- `POST /api/event-schedule` - Create a new match (admin only, auto-generates match number per sport)
  - Supports match types: league (dual sports only), knockout, final
  - Validates participant eligibility for knockout/final matches
  - Enforces league vs knockout restrictions
  - Validates final match restrictions
- `PUT /api/event-schedule/:id` - Update match winner, qualifiers, and status (admin only)
  - Status updates: Can update status to 'completed', 'draw', 'cancelled', or 'scheduled'
  - Winner selection: Can declare winner for completed matches in dual sports (automatically marks other participant as loser)
  - Qualifiers selection: Can set qualifiers with positions for completed matches in multi sports
  - Future date validation: Status updates and winner/qualifier selection are blocked for future-dated matches
  - Status change restrictions: Cannot change status from completed/draw/cancelled to any other status
- `DELETE /api/event-schedule/:id` - Delete a match (admin only, only if status is 'scheduled', allowed for future matches)

#### Points Table Management
- `GET /api/points-table/:sport` - Get points table for a specific sport (requires authentication, supports ?year parameter)
  - Only available for dual_team and dual_player sports
  - Returns points, matches played, won, lost, draw, cancelled
  - Automatically sorted by points (descending), then matches won (descending)
- `GET /api/points-table/:sport/:participant` - Get points for a specific participant (requires authentication, supports ?year parameter)

#### Event Year Management
- `GET /api/event-years` - Get all event years (admin only)
- `GET /api/event-years/active` - Get active event year (public)
- `POST /api/event-years` - Create new event year (admin only)
- `PUT /api/event-years/:year` - Update event year (admin only)
- `PUT /api/event-years/:year/activate` - Activate event year (admin only, deactivates all other years)
- `DELETE /api/event-years/:year` - Delete event year (admin only, only if not active and no data exists)

#### Sport Management
- `GET /api/sports` - Get all sports (supports ?year parameter)
- `GET /api/sports/:name` - Get sport by name (supports ?year parameter)
- `GET /api/sports-counts` - Get all sports with participation counts (supports ?year parameter)
- `POST /api/sports` - Create new sport (admin only)
- `PUT /api/sports/:id` - Update sport (admin only)
- `DELETE /api/sports/:id` - Delete sport (admin only, only if no matches or points entries exist)

#### Department Management
- `GET /api/departments` - Get all departments
- `GET /api/departments/active` - Get active departments
- `POST /api/departments` - Create new department (admin only)
- `PUT /api/departments/:id` - Update department (admin only, only display_order can be updated)
- `DELETE /api/departments/:id` - Delete department (admin only, only if no players are registered)

#### Data Export
- `GET /api/export-excel` - Export players data to Excel (admin only, supports ?year parameter)

### Authentication

- Uses JWT (JSON Web Tokens) for authentication
- Token is stored in `localStorage` as `authToken`
- User data is fetched from the server on app mount and after login (not stored in localStorage)
- Token is automatically included in all authenticated API requests via `fetchWithAuth` utility
- On token expiration (401/403), user is automatically logged out and redirected
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

This section describes how to deploy the application on a Linux server using systemd for process management. The service will automatically start on boot and restart on failure.

### Prerequisites

- Ubuntu/Debian Linux server (or similar distribution)
- Root or sudo access
- Node.js and npm installed
- Git (for cloning the repository)

### Step 1: Install Node.js and npm

If Node.js is not already installed on your server, install it using the following commands:

```bash
# Update package list
sudo apt update

# Install Node.js (this will install both nodejs and npm)
sudo apt install nodejs npm -y

# Verify installation
node --version
npm --version
```

**Note:** The default Node.js version from Ubuntu repositories might be older. For Node.js v16 or higher, consider using NodeSource repository:

```bash
# Install Node.js 18.x (LTS)
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs
```

### Step 2: Clone and Setup the Project

1. Clone the repository to your desired location (e.g., `/var/www/annual-sports-event-full`):

```bash
# Navigate to the directory where you want to install the application
cd /var/www

# Clone the repository (replace with your actual repository URL)
sudo git clone <repository-url> annual-sports-event-full

# Change ownership to your user (replace 'ubuntu' with your username)
sudo chown -R ubuntu:ubuntu annual-sports-event-full

# Navigate to the project directory
cd annual-sports-event-full
```

2. Install project dependencies:

```bash
npm install
```

3. Create the `.env` file with production API URL:

```bash
# Create .env file
nano .env
```

Add the following content (replace with your actual API server URL):

```env
VITE_API_URL=https://your-api-server.com
```

Save and exit (Ctrl+X, then Y, then Enter).

4. Build the application for production:

```bash
npm run build
```

This creates an optimized production build in the `dist/` directory.

### Step 3: Create systemd Service File

Create a systemd service file to manage the application as a system service:

```bash
sudo nano /etc/systemd/system/annual-sports-frontend.service
```

Add the following configuration (replace `/var/www/annual-sports-event-full` with your actual project path and `ubuntu` with your username):

```ini
[Unit]
Description=Annual Sports Frontend - Vite Preview Server
After=network.target

[Service]
Type=simple
User=ubuntu
Group=ubuntu
WorkingDirectory=/var/www/annual-sports-event-full
Environment=NODE_ENV=production
Environment=PORT=5173
ExecStart=/usr/bin/npm run preview
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=annual-sports-frontend

# Security settings
PrivateTmp=true
NoNewPrivileges=true

[Install]
WantedBy=multi-user.target
```

**Configuration Explanation:**
- `Description`: Human-readable description of the service
- `After=network.target`: Ensures the service starts after network is available
- `Type=simple`: Service runs in the foreground
- `User` and `Group`: User account that will run the service (replace with your username)
- `WorkingDirectory`: Full path to your project directory
- `Environment`: Sets environment variables (NODE_ENV=production, PORT=5173)
- `ExecStart`: Command to start the service (`npm run preview` serves the built `dist/` folder)
- `Restart=always`: Automatically restart the service if it crashes
- `RestartSec=10`: Wait 10 seconds before restarting
- `StandardOutput` and `StandardError`: Redirect logs to systemd journal
- `SyslogIdentifier`: Tag for log entries
- `PrivateTmp`: Use private /tmp directory for security
- `WantedBy=multi-user.target`: Start service at boot

Save and exit the file (Ctrl+X, then Y, then Enter).

### Step 4: Enable and Start the Service

1. Reload systemd to recognize the new service:

```bash
sudo systemctl daemon-reload
```

2. Enable the service to start automatically on boot:

```bash
sudo systemctl enable annual-sports-frontend
```

3. Start the service:

```bash
sudo systemctl start annual-sports-frontend
```

4. Check the service status:

```bash
sudo systemctl status annual-sports-frontend
```

You should see output indicating the service is active and running. The service will be accessible on `http://your-server-ip:5173` (or the configured port).

### Step 5: Managing the Service

#### Check Service Status

```bash
sudo systemctl status annual-sports-frontend
```

#### Stop the Service

```bash
sudo systemctl stop annual-sports-frontend
```

#### Start the Service

```bash
sudo systemctl start annual-sports-frontend
```

#### Restart the Service

```bash
sudo systemctl restart annual-sports-frontend
```

**Note:** Restart the service after making changes to the code or configuration:

1. Rebuild the application: `npm run build`
2. Restart the service: `sudo systemctl restart annual-sports-frontend`

#### Disable Auto-start on Boot

```bash
sudo systemctl disable annual-sports-frontend
```

#### View Service Logs

**Real-time log monitoring:**
```bash
sudo journalctl -u annual-sports-frontend -f
```

**View last 50 log entries:**
```bash
sudo journalctl -u annual-sports-frontend -n 50
```

**View logs since today:**
```bash
sudo journalctl -u annual-sports-frontend --since today
```

**View logs with timestamps:**
```bash
sudo journalctl -u annual-sports-frontend --since "2024-01-01 00:00:00"
```

### Step 6: Firewall Configuration

If you're using UFW (Uncomplicated Firewall), allow traffic on port 5173:

```bash
# Allow port 5173
sudo ufw allow 5173/tcp

# Or allow from specific IP only (more secure)
sudo ufw allow from <your-ip> to any port 5173

# Check firewall status
sudo ufw status
```

### Step 7: Reverse Proxy (Optional but Recommended)

For production, it's recommended to use a reverse proxy (Nginx or Apache) in front of the Vite preview server. This provides:
- SSL/TLS encryption (HTTPS)
- Better performance
- Standard ports (80/443)
- Additional security features

#### Nginx Configuration Example

1. Install Nginx:

```bash
sudo apt install nginx -y
```

2. Create Nginx configuration:

```bash
sudo nano /etc/nginx/sites-available/annual-sports-frontend
```

Add the following configuration:

```nginx
server {
    listen 80;
    server_name your-domain.com;  # Replace with your domain or IP

    location / {
        proxy_pass http://localhost:5173;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

3. Enable the site:

```bash
sudo ln -s /etc/nginx/sites-available/annual-sports-frontend /etc/nginx/sites-enabled/
sudo nginx -t  # Test configuration
sudo systemctl reload nginx
```

## Backend Deployment

This section describes how to deploy the backend API server on a Linux server using systemd for process management. The service will automatically start on boot and restart on failure.

### Prerequisites

- Ubuntu/Debian Linux server (or similar distribution)
- Root or sudo access
- Node.js and npm installed
- MongoDB installed and running (local or remote)
- Git (for cloning the repository)

### Step 1: Install Node.js and npm

If Node.js is not already installed on your server, install it using the following commands:

```bash
# Update package list
sudo apt update

# Install Node.js (this will install both nodejs and npm)
sudo apt install nodejs npm -y

# Verify installation
node --version
npm --version
```

**Note:** The default Node.js version from Ubuntu repositories might be older. For Node.js v16 or higher, consider using NodeSource repository:

```bash
# Install Node.js 18.x (LTS)
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs
```

### Step 2: Install MongoDB

If MongoDB is not already installed, install it:

```bash
# Import MongoDB public GPG key
curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc | sudo gpg -o /usr/share/keyrings/mongodb-server-7.0.gpg --dearmor

# Add MongoDB repository
echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list

# Update package list
sudo apt update

# Install MongoDB
sudo apt install -y mongodb-org

# Start MongoDB service
sudo systemctl start mongod
sudo systemctl enable mongod
```

### Step 3: Clone and Setup the Project

1. Clone the repository to your desired location (e.g., `/var/www/annual-sports-event-full`):

```bash
# Navigate to the directory where you want to install the application
cd /var/www

# Clone the repository (replace with your actual repository URL)
sudo git clone <repository-url> annual-sports-event-full

# Change ownership to your user (replace 'ubuntu' with your username)
sudo chown -R ubuntu:ubuntu annual-sports-event-full

# Navigate to the project directory
cd annual-sports-event-full
```

2. Install project dependencies:

```bash
npm install
```

3. Create the `.env` file with production configuration:

```bash
# Create .env file
nano .env
```

Add the following content (replace with your actual values):

```env
# Backend Configuration
PORT=3001
MONGODB_URI=mongodb://localhost:27017/annual-sports-event
JWT_SECRET=your-strong-secret-key-change-in-production
REGISTRATION_DEADLINE=2026-01-07T00:00:00
```

Save and exit (Ctrl+X, then Y, then Enter).

**Note:** For production, use a strong, random JWT_SECRET and ensure MongoDB connection string is correct.

### Step 4: Create systemd Service File

Create a systemd service file to manage the backend API server as a system service:

```bash
sudo nano /etc/systemd/system/annual-sports-backend.service
```

Add the following configuration (replace `/var/www/annual-sports-event-full` with your actual project path and `ubuntu` with your username):

```ini
[Unit]
Description=Annual Sports Backend - Express.js API Server
After=network.target mongod.service

[Service]
Type=simple
User=ubuntu
Group=ubuntu
WorkingDirectory=/var/www/annual-sports-event-full
Environment=NODE_ENV=production
Environment=PORT=3001
ExecStart=/usr/bin/npm start
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=annual-sports-backend

# Security settings
PrivateTmp=true
NoNewPrivileges=true

[Install]
WantedBy=multi-user.target
```

**Configuration Explanation:**
- `Description`: Human-readable description of the service
- `After=network.target mongod.service`: Ensures the service starts after network and MongoDB are available
- `Type=simple`: Service runs in the foreground
- `User` and `Group`: User account that will run the service (replace with your username)
- `WorkingDirectory`: Full path to your project directory
- `Environment`: Sets environment variables (NODE_ENV=production, PORT=3001)
- `ExecStart`: Command to start the service (`npm start` runs `node server.js`)
- `Restart=always`: Automatically restart the service if it crashes
- `RestartSec=10`: Wait 10 seconds before restarting
- `StandardOutput` and `StandardError`: Redirect logs to systemd journal
- `SyslogIdentifier`: Tag for log entries
- `PrivateTmp`: Use private /tmp directory for security
- `WantedBy=multi-user.target`: Start service at boot

Save and exit the file (Ctrl+X, then Y, then Enter).

### Step 5: Enable and Start the Service

1. Reload systemd to recognize the new service:

```bash
sudo systemctl daemon-reload
```

2. Enable the service to start automatically on boot:

```bash
sudo systemctl enable annual-sports-backend
```

3. Start the service:

```bash
sudo systemctl start annual-sports-backend
```

4. Check the service status:

```bash
sudo systemctl status annual-sports-backend
```

You should see output indicating the service is active and running. The backend API will be accessible on `http://your-server-ip:3001` (or the configured port).

### Step 6: Managing the Service

#### Check Service Status

```bash
sudo systemctl status annual-sports-backend
```

#### Stop the Service

```bash
sudo systemctl stop annual-sports-backend
```

#### Start the Service

```bash
sudo systemctl start annual-sports-backend
```

#### Restart the Service

```bash
sudo systemctl restart annual-sports-backend
```

**Note:** Restart the service after making changes to the code or configuration:

1. Pull latest changes: `git pull origin main` (or your branch name)
2. Install new dependencies if needed: `npm install`
3. Update `.env` if needed: `nano .env`
4. Restart the service: `sudo systemctl restart annual-sports-backend`

#### Disable Auto-start on Boot

```bash
sudo systemctl disable annual-sports-backend
```

#### View Service Logs

**Real-time log monitoring:**
```bash
sudo journalctl -u annual-sports-backend -f
```

**View last 50 log entries:**
```bash
sudo journalctl -u annual-sports-backend -n 50
```

**View logs since today:**
```bash
sudo journalctl -u annual-sports-backend --since today
```

**View logs with timestamps:**
```bash
sudo journalctl -u annual-sports-backend --since "2024-01-01 00:00:00"
```

### Step 7: Firewall Configuration

If you're using UFW (Uncomplicated Firewall), allow traffic on port 3001:

```bash
# Allow port 3001
sudo ufw allow 3001/tcp

# Or allow from specific IP only (more secure)
sudo ufw allow from <your-ip> to any port 3001

# Check firewall status
sudo ufw status
```

### Step 8: Reverse Proxy (Optional but Recommended)

For production, it's recommended to use a reverse proxy (Nginx or Apache) in front of the Express.js server. This provides:
- SSL/TLS encryption (HTTPS)
- Better performance
- Standard ports (80/443)
- Additional security features

#### Nginx Configuration Example

1. Install Nginx (if not already installed):

```bash
sudo apt install nginx -y
```

2. Create Nginx configuration:

```bash
sudo nano /etc/nginx/sites-available/annual-sports-backend
```

Add the following configuration:

```nginx
server {
    listen 80;
    server_name api.your-domain.com;  # Replace with your domain or IP

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

3. Enable the site:

```bash
sudo ln -s /etc/nginx/sites-available/annual-sports-backend /etc/nginx/sites-enabled/
sudo nginx -t  # Test configuration
sudo systemctl reload nginx
```

### Troubleshooting

#### Service Fails to Start

1. Check service status and logs:
```bash
sudo systemctl status annual-sports-frontend
sudo journalctl -u annual-sports-frontend -n 50
```

2. Verify the project path in the service file is correct:
```bash
cat /etc/systemd/system/annual-sports-frontend.service
```

3. Ensure the project is built:
```bash
cd /var/www/annual-sports-event-full
ls -la dist/  # Should show built files
```

4. Test running the preview command manually:
```bash
cd /var/www/annual-sports-event-full
npm run preview
```

#### Port Already in Use

If port 5173 is already in use, you can:

1. Change the port in `vite.config.js`:
```javascript
server: {
  port: 3000,  // Change to available port
}
```

2. Rebuild and restart the service:
```bash
npm run build
sudo systemctl restart annual-sports-frontend
```

#### Permission Issues

If you encounter permission errors:

1. Check file ownership:
```bash
ls -la /var/www/annual-sports-event-full
```

2. Fix ownership if needed:
```bash
sudo chown -R ubuntu:ubuntu /var/www/annual-sports-event-full
```

3. Ensure the service user has execute permissions:
```bash
sudo chmod +x /var/www/annual-sports-event-full
```

#### Service Not Accessible

1. Check if the service is running:
```bash
sudo systemctl status annual-sports-frontend
```

2. Verify the port is listening:
```bash
sudo netstat -tlnp | grep 5173
# or
sudo ss -tlnp | grep 5173
```

3. Check firewall rules:
```bash
sudo ufw status
```

4. Test locally on the server:
```bash
curl http://localhost:5173
```

### Backend Troubleshooting

#### Backend Service Fails to Start

1. Check service status and logs:
```bash
sudo systemctl status annual-sports-backend
sudo journalctl -u annual-sports-backend -n 50
```

2. Verify the project path in the service file is correct:
```bash
cat /etc/systemd/system/annual-sports-backend.service
```

3. Ensure MongoDB is running:
```bash
sudo systemctl status mongod
# If not running, start it:
sudo systemctl start mongod
```

4. Check MongoDB connection in `.env` file:
```bash
cd /var/www/annual-sports-event-full
cat .env | grep MONGODB_URI
```

5. Test running the server command manually:
```bash
cd /var/www/annual-sports-event-full
npm start
```

6. Verify Node.js and npm are installed:
```bash
node --version
npm --version
```

#### Backend Port Already in Use

If port 3001 is already in use, you can:

1. Change the port in `.env` file:
```bash
nano .env
# Change PORT=3001 to PORT=3002 (or another available port)
```

2. Update the systemd service file to match:
```bash
sudo nano /etc/systemd/system/annual-sports-backend.service
# Update Environment=PORT=3001 to Environment=PORT=3002
```

3. Reload and restart the service:
```bash
sudo systemctl daemon-reload
sudo systemctl restart annual-sports-backend
```

#### Backend Permission Issues

If you encounter permission errors:

1. Check file ownership:
```bash
ls -la /var/www/annual-sports-event-full
```

2. Fix ownership if needed:
```bash
sudo chown -R ubuntu:ubuntu /var/www/annual-sports-event-full
```

3. Ensure the service user has execute permissions:
```bash
sudo chmod +x /var/www/annual-sports-event-full
```

#### Backend Service Not Accessible

1. Check if the service is running:
```bash
sudo systemctl status annual-sports-backend
```

2. Verify the port is listening:
```bash
sudo netstat -tlnp | grep 3001
# or
sudo ss -tlnp | grep 3001
```

3. Check firewall rules:
```bash
sudo ufw status
```

4. Test locally on the server:
```bash
curl http://localhost:3001/api/players
# Should return an authentication error (which means the server is running)
```

#### MongoDB Connection Issues

1. Check if MongoDB is running:
```bash
sudo systemctl status mongod
```

2. Check MongoDB logs:
```bash
sudo journalctl -u mongod -n 50
```

3. Test MongoDB connection:
```bash
mongosh
# Or if using older version:
mongo
```

4. Verify MongoDB URI in `.env`:
```bash
cat /var/www/annual-sports-event-full/.env | grep MONGODB_URI
```

5. Check MongoDB authentication (if using remote MongoDB):
```bash
# Ensure credentials are correct in MONGODB_URI
# Format: mongodb://username:password@host:port/database
```

#### Environment Variables Not Loading

1. Verify `.env` file exists and has correct format:
```bash
cd /var/www/annual-sports-event-full
cat .env
```

2. Check if `.env` file is in the correct location (project root):
```bash
ls -la .env
```

3. Ensure no syntax errors in `.env` file (no spaces around `=`):
```bash
# Correct: PORT=3001
# Incorrect: PORT = 3001
```

4. Restart the service after changing `.env`:
```bash
sudo systemctl restart annual-sports-backend
```

### Updating the Application

When you need to update the application:

1. Navigate to the project directory:
```bash
cd /var/www/annual-sports-event-full
```

2. Pull the latest changes:
```bash
git pull origin main  # or your branch name
```

3. Install any new dependencies:
```bash
npm install
```

4. Update `.env` if needed:
```bash
nano .env
```

5. Rebuild the application:
```bash
npm run build
```

6. Restart the service:
```bash
sudo systemctl restart annual-sports-frontend
```

7. Verify the service is running:
```bash
sudo systemctl status annual-sports-frontend
```

### Updating the Backend Application

When you need to update the backend API server:

1. Navigate to the project directory:
```bash
cd /var/www/annual-sports-event-full
```

2. Pull the latest changes:
```bash
git pull origin main  # or your branch name
```

3. Install any new dependencies:
```bash
npm install
```

4. Update `.env` if needed:
```bash
nano .env
```

5. Restart the service:
```bash
sudo systemctl restart annual-sports-backend
```

6. Verify the service is running:
```bash
sudo systemctl status annual-sports-backend
```

7. Check the logs to ensure everything started correctly:
```bash
sudo journalctl -u annual-sports-backend -n 50
```

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
- **YearSelector.jsx** - Year selector component for admin users
  - Allows switching between event years
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
- Match Deletion: Only matches with 'scheduled' status can be deleted by admin (including future matches)
- Match Status Updates: Status can only be updated for matches that are not in the future (both frontend and backend validation)
- Status Change Restrictions: Cannot change status from completed/draw/cancelled to any other status
- Winner Selection: Winners can only be declared for completed matches in dual sports that are not in the future (both frontend and backend validation)
- Qualifiers Selection: Qualifiers can only be set for completed matches in multi sports that are not in the future
- Winner/Loser Assignment: When a winner is selected in dual sports, the other participant is automatically marked as loser
- Qualifiers Assignment: When qualifiers are set in multi sports, participants not in qualifiers are marked as knocked out
- Points Table: Automatically calculated and updated for league matches in dual sports (2 points for win, 1 for draw/cancelled, 0 for loss)
- Remove Button: Available for all scheduled matches (including future matches) to allow cancellation/rescheduling
- Status Dropdown: Only visible for scheduled matches that are not in the future
- Event Year Management: Registration and event periods are managed per event year, not via environment variables
- Year Selector: Admin can switch between event years to view/manage data for different years
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
