# Guide: Splitting Backend and Frontend Applications

This guide provides step-by-step instructions to split the current monorepo structure into separate backend and frontend applications. This is useful for:
- Separate deployment strategies
- Independent scaling
- Different hosting platforms
- Team organization
- CI/CD pipeline separation

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Backend Application Setup](#backend-application-setup)
4. [Frontend Application Setup](#frontend-application-setup)
5. [Configuration Updates](#configuration-updates)
6. [Testing the Split](#testing-the-split)
7. [Deployment Considerations](#deployment-considerations)
8. [Troubleshooting](#troubleshooting)

## Overview

The current application structure combines both frontend and backend in a single repository. This guide will help you:

- **Backend**: Extract Express.js server, MongoDB models, and API routes
- **Frontend**: Extract React application, components, and build configuration

After splitting, you'll have:
- `annual-sports-backend/` - Backend application
- `annual-sports-frontend/` - Frontend application

## Prerequisites

- Git installed
- Node.js (v16 or higher) and npm installed
- MongoDB instance (local or remote)
- Basic knowledge of file system operations
- Terminal/Command line access

## Backend Application Setup

### Step 1: Create Backend Directory Structure

```bash
# Navigate to parent directory
cd /path/to/parent/directory

# Create backend directory
mkdir annual-sports-backend
cd annual-sports-backend

# Create directory structure
mkdir -p config models routes middleware utils constants
```

### Step 2: Copy Backend Files

From the current project, copy the following files to `annual-sports-backend/`:

```bash
# From the root of current project
cp server.js annual-sports-backend/
cp -r config/ annual-sports-backend/
cp -r models/ annual-sports-backend/
cp -r routes/ annual-sports-backend/
cp -r middleware/ annual-sports-backend/
cp -r utils/ annual-sports-backend/
cp -r constants/ annual-sports-backend/
```

**Files to copy:**
- `server.js` → `annual-sports-backend/server.js`
- `config/` → `annual-sports-backend/config/`
- `models/` → `annual-sports-backend/models/`
- `routes/` → `annual-sports-backend/routes/`
- `middleware/` → `annual-sports-backend/middleware/`
- `utils/` → `annual-sports-backend/utils/`
- `constants/` → `annual-sports-backend/constants/`

### Step 3: Create Backend package.json

Create `annual-sports-backend/package.json`:

```json
{
  "name": "annual-sports-backend",
  "version": "1.0.0",
  "type": "module",
  "description": "Backend API server for Annual Sports Event Management",
  "main": "server.js",
  "scripts": {
    "start": "node server.js",
    "server": "node server.js",
    "dev": "node --watch server.js"
  },
  "keywords": [
    "express",
    "mongodb",
    "api",
    "sports"
  ],
  "author": "",
  "license": "ISC",
  "dependencies": {
    "express": "^4.18.2",
    "cors": "^2.8.5",
    "xlsx": "^0.18.5",
    "jsonwebtoken": "^9.0.2",
    "dotenv": "^16.0.0",
    "mongoose": "^8.0.0",
    "nodemailer": "^6.9.8"
  },
  "devDependencies": {},
  "engines": {
    "node": ">=16.0.0"
  }
}
```

### Step 4: Create Backend .env File

Create `annual-sports-backend/.env`:

```env
# Server Configuration
PORT=3001
NODE_ENV=production

# Database Configuration
MONGODB_URI=mongodb://localhost:27017/annual-sports

# JWT Configuration
JWT_SECRET=your-secret-key-change-in-production

# Email Configuration (optional, required for password reset emails)
EMAIL_PROVIDER=gmail
GMAIL_USER=your-gmail-address
GMAIL_APP_PASSWORD=your-gmail-app-password
EMAIL_FROM=your-gmail-address
EMAIL_FROM_NAME=Sports Event Management
APP_NAME=Sports Event Management System

# Optional CORS Configuration (see "Backend CORS Configuration")
# CORS_ORIGIN=http://localhost:5173
```

### Step 5: Create Backend .gitignore

Create `annual-sports-backend/.gitignore`:

```
# Dependencies
node_modules/
package-lock.json

# Environment variables
.env
.env.local
.env.production

# Logs
logs/
*.log
npm-debug.log*

# OS files
.DS_Store
Thumbs.db

# IDE files
.vscode/
.idea/
*.swp
*.swo

# MongoDB data (if running locally)
data/
```

### Step 6: Create Backend README.md

Create `annual-sports-backend/README.md`:

```markdown
# Annual Sports Backend API

Backend API server for Annual Sports Event Management System.

## Installation

\`\`\`bash
npm install
\`\`\`

## Configuration

Create a `.env` file and configure:

- `PORT` - Server port (default: 3001)
- `MONGODB_URI` - MongoDB connection string
- `JWT_SECRET` - Secret key for JWT tokens

## Running

Development:
\`\`\`bash
npm run dev
\`\`\`

Production:
\`\`\`bash
npm start
\`\`\`

## API Endpoints

See main README.md for complete API documentation.
```

### Step 7: Install Backend Dependencies

```bash
cd annual-sports-backend
npm install
```

## Frontend Application Setup

### Step 1: Create Frontend Directory Structure

```bash
# Navigate to parent directory
cd /path/to/parent/directory

# Create frontend directory
mkdir annual-sports-frontend
cd annual-sports-frontend

# Create directory structure
mkdir -p src/components src/config src/utils src/hooks src/context src/constants public/images
```

### Step 2: Copy Frontend Files

From the current project, copy the following files to `annual-sports-frontend/`:

```bash
# From the root of current project
cp -r src/ annual-sports-frontend/
cp -r public/ annual-sports-frontend/
cp index.html annual-sports-frontend/
cp vite.config.js annual-sports-frontend/
cp tailwind.config.js annual-sports-frontend/
cp postcss.config.js annual-sports-frontend/
cp nginx.conf annual-sports-frontend/
```

**Files to copy:**
- `src/` → `annual-sports-frontend/src/` (includes components, hooks, context, utils, config, constants)
  - `src/components/ErrorBoundary.jsx` - Error Boundary component
  - `src/utils/logger.js` - Frontend logging utility
  - `src/utils/api.js` - API utility functions
- `public/` → `annual-sports-frontend/public/`
- `index.html` → `annual-sports-frontend/index.html`
- `vite.config.js` → `annual-sports-frontend/vite.config.js`
- `tailwind.config.js` → `annual-sports-frontend/tailwind.config.js`
- `postcss.config.js` → `annual-sports-frontend/postcss.config.js`
- `nginx.conf` → `annual-sports-frontend/nginx.conf` (needed for Docker/Nginx)

### Step 3: Create Frontend package.json

Create `annual-sports-frontend/package.json`:

```json
{
  "name": "annual-sports-frontend",
  "version": "1.0.0",
  "type": "module",
  "description": "Frontend application for Annual Sports Event Management",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "@types/react": "^18.3.3",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.1",
    "autoprefixer": "^10.4.20",
    "postcss": "^8.4.47",
    "tailwindcss": "^3.4.13",
    "vite": "^5.4.2"
  },
  "engines": {
    "node": ">=16.0.0"
  }
}
```

### Step 4: Create Frontend .env File

Create `annual-sports-frontend/.env`:

```env
# API Configuration
VITE_API_URL=http://localhost:3001

# For production, update to your backend URL:
# VITE_API_URL=https://api.yourdomain.com
```

### Step 5: Create Frontend .gitignore

Create `annual-sports-frontend/.gitignore`:

```
# Dependencies
node_modules/
package-lock.json

# Build output
dist/
dist-ssr/
*.local

# Environment variables
.env
.env.local
.env.production

# Logs
logs/
*.log
npm-debug.log*

# OS files
.DS_Store
Thumbs.db

# IDE files
.vscode/
.idea/
*.swp
*.swo

# Editor directories
.idea
*.suo
*.ntvs*
*.njsproj
*.sln
*.sw?
```

### Step 6: Create Frontend README.md

Create `annual-sports-frontend/README.md`:

```markdown
# Annual Sports Frontend

Frontend React application for Annual Sports Event Management System.

## Installation

\`\`\`bash
npm install
\`\`\`

## Configuration

Create `.env` file:

\`\`\`env
VITE_API_URL=http://localhost:3001
\`\`\`

## Running

Development:
\`\`\`bash
npm run dev
\`\`\`

Build:
\`\`\`bash
npm run build
\`\`\`

Preview:
\`\`\`bash
npm run preview
\`\`\`

## API Configuration

Update `VITE_API_URL` in `.env` to point to your backend API server.
```

### Step 7: Install Frontend Dependencies

```bash
cd annual-sports-frontend
npm install
```

## Configuration Updates

### Backend CORS Configuration

Current `server.js` uses the most permissive CORS configuration:

```javascript
app.use(cors())
```

If you want to restrict origins after the split, update `annual-sports-backend/server.js`:

```javascript
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true
}))
```

Then add to `.env`:
```env
CORS_ORIGIN=http://localhost:5173
```

### Frontend API Configuration

Ensure `annual-sports-frontend/src/config/api.js` correctly references the backend:

```javascript
// Should use VITE_API_URL from environment
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'
```

## Testing the Split

### Step 1: Test Backend

```bash
cd annual-sports-backend

# Start backend server
npm run dev

# In another terminal, test API
curl http://localhost:3001/api/players
# Should return authentication error (expected without token)
```

### Step 2: Test Frontend

```bash
cd annual-sports-frontend

# Start frontend dev server
npm run dev

# Open browser to http://localhost:5173
# Verify the application loads and can connect to backend
```

### Step 3: Verify Integration

1. Open frontend in browser: `http://localhost:5173`
2. Try logging in with test credentials
3. Verify API calls are working
4. Check browser console for any CORS errors
5. Check backend logs for incoming requests

## Deployment Considerations

### Backend Deployment

**Option 1: Traditional Server (systemd)**
- Follow the deployment steps in `docs/setup/README.md`
- Update service file to point to backend directory
- Service name: `annual-sports-backend`

**Option 2: Cloud Platforms**
- **Heroku**: Add `Procfile` with `web: node server.js`
- **Railway**: Configure start command
- **Render**: Set build and start commands
- **AWS EC2**: Use PM2 or systemd

**Option 3: Container (Docker)**
Create `annual-sports-backend/Dockerfile`:
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY . .
EXPOSE 3001
CMD ["node", "server.js"]
```

### Frontend Deployment

**Option 1: Static Hosting**
- Build: `npm run build`
- Deploy `dist/` folder to:
  - Vercel
  - Netlify
  - GitHub Pages
  - AWS S3 + CloudFront
  - Firebase Hosting

**Option 2: Traditional Server**
- Build: `npm run build`
- Serve `dist/` with Nginx or Apache
- Or use `npm run preview` with systemd

**Option 3: Container (Docker)**
Create `annual-sports-frontend/Dockerfile`:
```dockerfile
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

### Environment Variables in Production

**Backend (.env):**
```env
PORT=3001
MONGODB_URI=mongodb://your-production-mongodb-uri
JWT_SECRET=your-strong-production-secret
CORS_ORIGIN=https://your-frontend-domain.com
```

**Frontend (.env.production):**
```env
VITE_API_URL=https://api.yourdomain.com
```

## Directory Structure After Split

```
parent-directory/
├── annual-sports-backend/
│   ├── config/
│   │   └── database.js
│   ├── models/             # All Mongoose schemas
│   ├── routes/             # Express route handlers
│   ├── middleware/         # Auth, date restrictions, etc.
│   ├── utils/              # Logger, cache, email, helpers
│   ├── constants/          # Backend constants
│   ├── server.js
│   ├── package.json
│   ├── .env
│   ├── .gitignore
│   └── README.md
│
└── annual-sports-frontend/
    ├── src/
    │   ├── components/      # All React components
    │   ├── hooks/           # Custom hooks
    │   ├── context/         # Context providers
    │   ├── constants/       # Frontend constants
    │   ├── config/
    │   │   └── api.js
    │   ├── utils/           # API helpers, logging, etc.
    │   ├── App.jsx
    │   ├── main.jsx
    │   └── index.css
    ├── public/
    │   └── images/
    ├── index.html
    ├── vite.config.js
    ├── tailwind.config.js
    ├── postcss.config.js
    ├── package.json
    ├── .env
    ├── .gitignore
    └── README.md
```

## Troubleshooting

### Issue: CORS Errors

**Solution:**
1. Check backend CORS configuration
2. Verify `CORS_ORIGIN` in backend `.env` matches frontend URL
3. Ensure backend allows credentials if needed

### Issue: API Connection Failed

**Solution:**
1. Verify `VITE_API_URL` in frontend `.env`
2. Check backend is running on correct port
3. Verify network connectivity
4. Check firewall rules

### Issue: Environment Variables Not Working

**Solution:**
1. Frontend: Ensure variables start with `VITE_`
2. Restart dev server after changing `.env`
3. For production builds, set variables in build environment
4. Backend: Ensure `.env` file is in root directory

### Issue: MongoDB Connection Failed

**Solution:**
1. Verify MongoDB is running
2. Check `MONGODB_URI` in backend `.env`
3. Verify network access to MongoDB
4. Check MongoDB authentication credentials

### Issue: Build Errors

**Solution:**
1. Clear `node_modules` and reinstall: `rm -rf node_modules && npm install`
2. Clear build cache: `rm -rf dist/`
3. Check Node.js version matches requirements
4. Verify all dependencies are installed

## Additional Notes

### Git Repository Setup

If you want separate Git repositories:

```bash
# Backend repository
cd annual-sports-backend
git init
git add .
git commit -m "Initial backend setup"

# Frontend repository
cd ../annual-sports-frontend
git init
git add .
git commit -m "Initial frontend setup"
```

### Monorepo Alternative

If you prefer to keep them together but organized:

```
annual-sports-app/
├── backend/
│   └── (backend files)
├── frontend/
│   └── (frontend files)
└── package.json (root workspace config)
```

### CI/CD Pipeline

After splitting, you can set up separate CI/CD pipelines:

**Backend:**
- Test API endpoints
- Deploy to backend server
- Run database migrations

**Frontend:**
- Build and test
- Deploy to static hosting
- Run E2E tests

## Summary

After completing these steps, you'll have:

✅ Separate backend application with its own dependencies  
✅ Separate frontend application with its own dependencies  
✅ Independent configuration files  
✅ Ability to deploy separately  
✅ Clear separation of concerns  

Both applications can now be:
- Developed independently
- Deployed to different platforms
- Scaled separately
- Maintained by different teams

## Next Steps

1. Test both applications locally
2. Set up separate Git repositories (optional)
3. Configure CI/CD pipelines
4. Deploy to production environments
5. Update documentation with new URLs

---

**Note:** Remember to update any deployment scripts, CI/CD configurations, and documentation to reflect the new structure.

