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
git clone <repository-url>
cd annual-sports-event-ui
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
MONGODB_URI=mongodb://localhost:27017/annual-sports
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
- `MONGODB_URI` - MongoDB connection string (default: `mongodb://localhost:27017/annual-sports`)
- `JWT_SECRET` - Secret key for JWT token signing (default: `your-secret-key-change-in-production`)
- `REGISTRATION_DEADLINE` - Registration deadline date (default: `2026-01-07T00:00:00`)

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
│   │   ├── RegisterModal.jsx
│   │   ├── LoginModal.jsx
│   │   ├── AddCaptainModal.jsx
│   │   ├── RemoveCaptainModal.jsx
│   │   ├── TeamDetailsModal.jsx
│   │   ├── ParticipantDetailsModal.jsx
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
│   └── Player.js        # Player Mongoose model with indexes
├── utils/
│   └── logger.js        # Backend logging utility
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
- ✅ Status popups for success/error messages
- ✅ Loading states for all API operations
- ✅ Form validation with proper error handling
- ✅ User data fetched from server (not stored in localStorage)
- ✅ All original styling preserved with Tailwind CSS
- ✅ **Request caching and deduplication** - Reduces API calls and improves performance
- ✅ **Request cancellation** - Prevents race conditions and memory leaks
- ✅ **Error Boundary** - Catches React errors and displays user-friendly error UI
- ✅ **Production-ready logging** - Environment-aware logging utility (debug logs only in development)
- ✅ **Persistent authentication** - User stays logged in after page refresh (token-based)
- ✅ **Modal behavior** - Modals don't close on outside click (must use close button)

### Backend Features
- ✅ RESTful API with Express.js
- ✅ MongoDB database with optimized indexes
- ✅ JWT-based authentication
- ✅ Registration deadline enforcement
- ✅ Excel export functionality
- ✅ Team and individual event management
- ✅ Captain role management
- ✅ **Optimized MongoDB queries** - Uses indexes and projections for better performance
- ✅ **Password exclusion** - Passwords never sent in API responses
- ✅ **Production-ready logging** - Environment-aware logging utility (debug logs only in development)
- ✅ **Optimized user endpoint** - `/api/me` endpoint for fetching current user (more efficient than fetching all players)

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
- `GET /api/teams/:sport` - Get teams for a specific sport (requires authentication)
- `POST /api/update-team-player` - Replace player in team (admin only)
- `DELETE /api/delete-team` - Delete a team (admin only)

#### Participant Management
- `GET /api/participants/:sport` - Get participants for a specific sport (admin only)

#### Data Export
- `GET /api/export-excel` - Export players data to Excel (admin only)

### Authentication

- Uses JWT (JSON Web Tokens) for authentication
- Token is stored in `localStorage` as `authToken`
- User data is fetched from the server on app mount and after login (not stored in localStorage)
- Token is automatically included in all authenticated API requests via `fetchWithAuth` utility
- On token expiration (401/403), user is automatically logged out and redirected
- **Authentication persistence**: User stays logged in after page refresh - token is preserved and user data is automatically fetched on app mount
- **Optimized user fetching**: Uses `/api/me` endpoint to fetch only current user data (more efficient than `/api/players`)

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
- **Request Caching**: GET requests are cached with configurable TTL
  - Players list: 30 seconds
  - Sports list: 5 minutes
  - Default: 10 seconds
- **Request Deduplication**: Identical concurrent requests share the same promise
- **Request Cancellation**: All API calls support AbortController for cancellation
- **Cache Invalidation**: Automatic cache clearing on authentication failures

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
   - `MONGODB_URI` (defaults to `mongodb://localhost:27017/annual-sports`)
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

1. Clone the repository to your desired location (e.g., `/var/www/annual-sports-event-ui`):

```bash
# Navigate to the directory where you want to install the application
cd /var/www

# Clone the repository (replace with your actual repository URL)
sudo git clone <repository-url> annual-sports-event-ui

# Change ownership to your user (replace 'ubuntu' with your username)
sudo chown -R ubuntu:ubuntu annual-sports-event-ui

# Navigate to the project directory
cd annual-sports-event-ui
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

Add the following configuration (replace `/var/www/annual-sports-event-ui` with your actual project path and `ubuntu` with your username):

```ini
[Unit]
Description=Annual Sports Frontend - Vite Preview Server
After=network.target

[Service]
Type=simple
User=ubuntu
Group=ubuntu
WorkingDirectory=/var/www/annual-sports-event-ui
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
cd /var/www/annual-sports-event-ui
ls -la dist/  # Should show built files
```

4. Test running the preview command manually:
```bash
cd /var/www/annual-sports-event-ui
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
ls -la /var/www/annual-sports-event-ui
```

2. Fix ownership if needed:
```bash
sudo chown -R ubuntu:ubuntu /var/www/annual-sports-event-ui
```

3. Ensure the service user has execute permissions:
```bash
sudo chmod +x /var/www/annual-sports-event-ui
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

### Updating the Application

When you need to update the application:

1. Navigate to the project directory:
```bash
cd /var/www/annual-sports-event-ui
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

## Component Overview

### Main Components

- **App.jsx** - Main application component, handles routing, authentication state, and user data management
- **Hero.jsx** - Hero section with event countdown timer and welcome message
- **SportsSection.jsx** - Displays available sports and handles sport selection
- **Navbar.jsx** - Navigation bar with login/logout functionality

### Modal Components

- **RegisterModal.jsx** - Handles player registration and event participation (team/individual)
- **LoginModal.jsx** - User login form
- **AddCaptainModal.jsx** - Admin interface for assigning captain roles
- **RemoveCaptainModal.jsx** - Admin interface for removing captain roles
- **TeamDetailsModal.jsx** - Displays team details and allows team management
- **ParticipantDetailsModal.jsx** - Displays individual participant details
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
- **Request Caching**: Reduces redundant API calls by caching GET requests
- **Request Deduplication**: Prevents multiple identical requests from executing simultaneously
- **Request Cancellation**: All API calls support cancellation to prevent memory leaks
- **Optimized User Fetching**: Uses `fetchCurrentUser()` helper with dedicated `/api/me` endpoint (fetches only current user, not all players)

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
- **Error Boundary** wraps the entire application to catch and handle React errors gracefully
- **Logging utilities** are used throughout the codebase for production-ready error tracking
- All console statements have been replaced with logger utilities for better production control
- **Authentication persistence**: User authentication is preserved across page refreshes using JWT tokens stored in localStorage
- **Optimized API calls**: `/api/me` endpoint fetches only current user data instead of all players, improving performance and reducing network traffic
- **Modal UX**: Modals require explicit close action (X button or Cancel) - they don't close on outside click to prevent accidental closures

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

## Splitting Backend and Frontend

If you need to separate the backend and frontend into independent applications, see **[SPLIT_GUIDE.md](./SPLIT_GUIDE.md)** for detailed step-by-step instructions.

The split guide covers:
- Creating separate backend and frontend directories
- Configuring independent package.json files
- Setting up environment variables
- Deployment considerations
- Troubleshooting common issues

## License

[Add your license information here]
