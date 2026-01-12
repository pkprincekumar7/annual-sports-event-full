# Security Audit Report - Annual Sports Event Management System

## Executive Summary

This document provides a comprehensive security audit of the Annual Sports Event Management System, covering authentication, authorization, input validation, period restrictions, and other security measures.

**Last Updated**: January 2026  
**System Version**: 2.0

---

## Table of Contents

1. [Authentication & Authorization](#authentication--authorization)
2. [API Endpoints Security](#api-endpoints-security)
3. [Input Validation & Sanitization](#input-validation--sanitization)
4. [Period-Based Restrictions](#period-based-restrictions)
5. [Data Protection](#data-protection)
6. [CORS Configuration](#cors-configuration)
7. [Security Concerns & Recommendations](#security-concerns--recommendations)
8. [Testing Recommendations](#testing-recommendations)

---

## Authentication & Authorization

### Authentication Middleware

#### `authenticateToken`
- **Purpose**: Verifies JWT token and checks if user exists in database
- **Implementation**:
  - Extracts token from `Authorization: Bearer <token>` header
  - Verifies token signature using `JWT_SECRET`
  - Checks token expiration
  - Verifies user exists in database (prevents deleted user access)
  - Attaches user info to `req.user`
- **Error Responses**:
  - `401 Unauthorized`: No token provided
  - `403 Forbidden`: Invalid/expired token or user not found
- **Status**: ✅ **Properly implemented**

#### `requireAdmin`
- **Purpose**: Checks if user is admin (must be used after `authenticateToken`)
- **Implementation**:
  - Checks `req.user.reg_number === ADMIN_REG_NUMBER` (from constants)
  - Returns `403 Forbidden` with message "Admin access required" if not admin
- **Status**: ✅ **Properly implemented**

### JWT Token Configuration

- **Secret**: Stored in environment variable `JWT_SECRET` (defaults to weak secret for development)
- **Expiration**: Configured via `JWT_EXPIRES_IN` constant (default: 24 hours)
- **Token Payload**: Contains `reg_number`, `full_name`, `isAdmin`
- **Storage**: Tokens stored in browser `localStorage` on frontend
- **Verification**: Token verified on every authenticated request
- **User Verification**: User existence verified in database on every request (prevents deleted user access)

---

## API Endpoints Security

### Public Endpoints (No Authentication Required)

1. `POST /api/login` - ✅ Public (correct)
2. `POST /api/save-player` - ✅ Public (registration, requires registration period)
3. `POST /api/save-players` - ✅ Public (batch registration, requires registration period)
4. `GET /api/event-years/active` - ✅ Public (read-only)

### Authenticated Endpoints (Any Logged-in User)

1. `GET /api/me` - ✅ `authenticateToken` only
2. `GET /api/players` - ✅ `authenticateToken` only
3. `POST /api/validate-participations` - ✅ `authenticateToken` only
4. `POST /api/update-team-participation` - ✅ `authenticateToken, requireRegistrationPeriod`
5. `POST /api/update-participation` - ✅ `authenticateToken, requireRegistrationPeriod`
6. `GET /api/teams/:sport` - ✅ `authenticateToken` only (supports ?year parameter)
7. `GET /api/participants-count/:sport` - ✅ `authenticateToken` only (supports ?year parameter)
8. `GET /api/sports-counts` - ✅ `authenticateToken` only (supports ?year parameter)
9. `GET /api/sports/:name` - ✅ `authenticateToken` only (supports ?year parameter)
10. `GET /api/event-schedule/:sport` - ✅ `authenticateToken` only (supports ?year parameter)
11. `GET /api/points-table/:sport` - ✅ `authenticateToken` only (supports ?year parameter)
12. `GET /api/points-table/:sport/:participant` - ✅ `authenticateToken` only (supports ?year parameter)

### Admin-Only Endpoints (Require Admin Access)

#### Event Year Management
1. `GET /api/event-years` - ✅ `authenticateToken, requireAdmin`
2. `POST /api/event-years` - ✅ `authenticateToken, requireAdmin, requireRegistrationPeriod`
3. `PUT /api/event-years/:year` - ✅ `authenticateToken, requireAdmin, requireRegistrationPeriod`
4. `PUT /api/event-years/:year/activate` - ✅ `authenticateToken, requireAdmin, requireRegistrationPeriod`
5. `DELETE /api/event-years/:year` - ✅ `authenticateToken, requireAdmin, requireRegistrationPeriod`

#### Sport Management
6. `GET /api/sports` - ✅ `authenticateToken, requireAdmin` (supports ?year parameter)
7. `POST /api/sports` - ✅ `authenticateToken, requireAdmin, requireRegistrationPeriod`
8. `PUT /api/sports/:id` - ✅ `authenticateToken, requireAdmin, requireRegistrationPeriod`
9. `DELETE /api/sports/:id` - ✅ `authenticateToken, requireAdmin, requireRegistrationPeriod`

#### Department Management
10. `GET /api/departments` - ✅ `authenticateToken, requireAdmin`
11. `GET /api/departments` - ✅ Public (no auth required - departments are not year-dependent)
12. `POST /api/departments` - ✅ `authenticateToken, requireAdmin`
13. `PUT /api/departments/:id` - ✅ `authenticateToken, requireAdmin`
14. `DELETE /api/departments/:id` - ✅ `authenticateToken, requireAdmin`

#### Captain Management
15. `GET /api/captains-by-sport` - ✅ `authenticateToken, requireAdmin` (supports ?year parameter)
16. `POST /api/add-captain` - ✅ `authenticateToken, requireAdmin, requireRegistrationPeriod`
17. `DELETE /api/remove-captain` - ✅ `authenticateToken, requireAdmin, requireRegistrationPeriod`

#### Team Management
18. `GET /api/participants/:sport` - ✅ `authenticateToken, requireAdmin` (supports ?year parameter)
19. `POST /api/update-team-player` - ✅ `authenticateToken, requireAdmin, requireRegistrationPeriod`
20. `DELETE /api/delete-team` - ✅ `authenticateToken, requireAdmin, requireRegistrationPeriod`

#### Participant Management
21. `DELETE /api/remove-participation` - ✅ `authenticateToken, requireAdmin, requireRegistrationPeriod`

#### Player Management
22. `PUT /api/update-player` - ✅ `authenticateToken, requireAdmin, requireRegistrationPeriod`

#### Event Schedule Management
23. `GET /api/event-schedule/:sport/teams-players` - ✅ `authenticateToken, requireAdmin` (supports ?year parameter)
24. `POST /api/event-schedule` - ✅ `authenticateToken, requireAdmin, requireEventPeriod`
25. `PUT /api/event-schedule/:id` - ✅ `authenticateToken, requireAdmin, requireEventPeriod`
26. `DELETE /api/event-schedule/:id` - ✅ `authenticateToken, requireAdmin, requireEventPeriod`

#### Data Export
27. `GET /api/export-excel` - ✅ `authenticateToken, requireAdmin` (supports ?year parameter)

### Security Verification

#### ✅ All Admin-Only Endpoints Protected
All endpoints that should be admin-only have the `requireAdmin` middleware, which:
- Checks `req.user.reg_number === ADMIN_REG_NUMBER` (from constants)
- Returns `403 Forbidden` status code with proper error message
- Is placed after `authenticateToken` middleware (correct order)

#### ✅ Period-Based Restrictions
- Registration operations require `requireRegistrationPeriod` middleware
- Event scheduling operations require `requireEventPeriod` middleware
- Periods are managed per event year (not global)

#### ✅ Frontend Protection
- Admin-only modals are conditionally rendered based on admin status
- Admin-only buttons are conditionally shown (`isAdmin` check)
- All API calls use `fetchWithAuth` which includes authentication token
- Frontend handles 403 errors properly (clears token and reloads)
- Year selector only visible to admin users

#### ✅ Backend Protection
- All admin-only endpoints have `requireAdmin` middleware
- Middleware order is correct: `authenticateToken` → `requireAdmin` → `requireRegistrationPeriod`/`requireEventPeriod`
- Returns proper HTTP status codes (400, 401, 403, 404, 500) with clear error messages
- User existence verified on every authenticated request

---

## Input Validation & Sanitization

### Input Trimming
- **Function**: `trimObjectFields()` in `utils/validation.js`
- **Purpose**: Trims whitespace from all string fields in request body
- **Usage**: Applied to all user inputs before validation
- **Status**: ✅ **Properly implemented**

### Field Validation

#### Player Registration (`validatePlayerData`)
- **Registration Number**: Required, must be unique
- **Full Name**: Required, trimmed
- **Gender**: Required, must be one of `['Male', 'Female']`
- **Department**: Required, validated against Department collection (must exist)
- **Year**: Required, must match format "1st Year (2025)", "2nd Year (2024)", etc.
- **Mobile Number**: Required, must be exactly 10 digits
- **Email**: Required, validated with regex pattern
- **Password**: Required (no complexity requirements)

#### Player Update (`validateUpdatePlayerData`)
- **Editable Fields**: Full name, department, mobile number, email
- **Non-Editable Fields**: Registration number, gender, year, password
- **Department Validation**: Validated against Department collection (must exist)

#### Sport Validation
- **Name**: Required, normalized to lowercase, unique per year
- **Type**: Required, must be one of `['dual_team', 'multi_team', 'dual_player', 'multi_player']`
- **Category**: Required, must be one of `['team events', 'individual events', 'literary and cultural activities']`
- **Team Size**: Required for team sports, must be positive integer

#### Match Validation
- **Match Type**: Must be one of `['league', 'knockout', 'final']`
- **Status**: Must be one of `['scheduled', 'completed', 'draw', 'cancelled']`
- **Match Date**: Must be today or future date, must be within event period
- **Participants**: Must exist in sport's participation arrays
- **Gender Matching**: All participants must have same gender
- **Year Matching**: All team members must be in same year

### Validation Status
- ✅ **Email validation**: Regex pattern validation
- ✅ **Phone validation**: 10-digit numeric validation
- ✅ **Department validation**: Database lookup validation
- ✅ **Sport type validation**: Enum validation
- ✅ **Match type validation**: Enum validation
- ✅ **Date validation**: Format and range validation
- ⚠️ **Password validation**: No complexity requirements (see Security Concerns)

---

## Period-Based Restrictions

### Registration Period Middleware (`requireRegistrationPeriod`)

- **Purpose**: Restricts operations to registration date range
- **Allowed Operations**: Player registration, team creation, participation updates, sport/event year management
- **Period Source**: Event year's `registration_dates.start` and `registration_dates.end`
- **Year Support**: Accepts optional `?year` parameter (defaults to active year)
- **Error Response**: `400 Bad Request` with period information
- **Status**: ✅ **Properly implemented**

### Event Period Middleware (`requireEventPeriod`)

- **Purpose**: Restricts match scheduling to event date range
- **Allowed Operations**: Match creation, update, deletion
- **Period Source**: Event year's `event_dates.start` and `event_dates.end`
- **Year Support**: Accepts optional `?year` parameter (defaults to active year)
- **Error Response**: `400 Bad Request` with period information
- **Status**: ✅ **Properly implemented**

### Legacy Registration Deadline Middleware (`checkRegistrationDeadline`)

- **Purpose**: Legacy middleware for backward compatibility
- **Implementation**: Blocks non-GET requests after hardcoded deadline
- **Status**: ⚠️ **Deprecated** - Replaced by `requireRegistrationPeriod` (still present for compatibility)

### Period Validation
- ✅ **Registration Period**: Enforced per event year
- ✅ **Event Period**: Enforced per event year
- ✅ **Match Date Validation**: Match dates must be within event period
- ✅ **Future Date Validation**: Status updates blocked for future matches

---

## Data Protection

### Password Handling

#### Current Implementation
- **Storage**: Passwords stored in plain text in database
- **Transmission**: Passwords sent in request body (should use HTTPS)
- **Response**: Passwords excluded from all API responses using `.select('-password')`
- **Comparison**: Plain text comparison in login endpoint

#### Security Status
- ⚠️ **CRITICAL**: Passwords are stored in plain text
- ✅ **Response Protection**: Passwords never sent in API responses
- ⚠️ **Transmission**: Should use HTTPS in production

### Sensitive Data Exclusion

- ✅ **Passwords**: Excluded from all responses
- ✅ **JWT Secret**: Stored in environment variable
- ✅ **Error Messages**: Don't expose sensitive information
- ✅ **User Verification**: User existence verified on every request

### Cache Security

- **Type**: In-memory cache (not persistent)
- **TTL**: Configurable per endpoint (5-10 seconds)
- **Invalidation**: Cache cleared after mutations
- **Security**: No sensitive data cached
- **Status**: ✅ **Properly implemented**

---

## CORS Configuration

### Current Configuration
```javascript
app.use(cors())  // Allows all origins, methods, and headers
```

### Security Status
- ⚠️ **CRITICAL**: CORS allows all origins (permissive configuration)
- **Purpose**: Configured for development and Netlify deployment
- **Recommendation**: Restrict to specific origins in production

### Production Recommendations
- Restrict CORS to specific allowed origins
- Configure allowed methods (GET, POST, PUT, DELETE)
- Configure allowed headers
- Enable credentials if needed

---

## Security Concerns & Recommendations

### 🔴 Critical Issues

#### 1. Password Storage (Plain Text)
- **Issue**: Passwords stored in plain text in database
- **Risk**: High - If database is compromised, all passwords are exposed
- **Recommendation**: 
  - Implement password hashing using `bcrypt` or `argon2`
  - Hash passwords before storing in database
  - Compare hashed passwords during login
  - Consider password complexity requirements

#### 2. CORS Configuration (All Origins)
- **Issue**: CORS allows all origins
- **Risk**: Medium - Allows requests from any domain
- **Recommendation**:
  - Restrict CORS to specific allowed origins in production
  - Use environment variable for allowed origins
  - Configure per environment (development vs production)

### 🟡 Medium Priority Issues

#### 3. JWT Secret (Default Value)
- **Issue**: Default JWT secret is weak and predictable
- **Risk**: Medium - If default secret is used, tokens can be forged
- **Recommendation**:
  - Always set `JWT_SECRET` via environment variable
  - Use strong, random secret (at least 32 characters)
  - Rotate secrets periodically
  - Never commit secrets to version control

#### 4. Password Complexity
- **Issue**: No password complexity requirements
- **Risk**: Low-Medium - Weak passwords are easier to guess
- **Recommendation**:
  - Implement password complexity requirements (min length, uppercase, lowercase, numbers, special characters)
  - Provide clear feedback to users
  - Consider password strength meter

#### 5. Rate Limiting
- **Issue**: No rate limiting on API endpoints
- **Risk**: Medium - Vulnerable to brute force attacks and DoS
- **Recommendation**:
  - Implement rate limiting (e.g., using `express-rate-limit`)
  - Different limits for different endpoints
  - Stricter limits for authentication endpoints
  - IP-based and user-based rate limiting

#### 6. Input Sanitization
- **Issue**: Limited input sanitization (only trimming)
- **Risk**: Low-Medium - Potential XSS vulnerabilities
- **Recommendation**:
  - Implement HTML sanitization for user inputs
  - Validate and sanitize all inputs
  - Use parameterized queries (Mongoose handles this)
  - Consider using libraries like `validator.js` or `sanitize-html`

### 🟢 Low Priority / Best Practices

#### 7. HTTPS Enforcement
- **Issue**: No HTTPS enforcement
- **Risk**: Low - Data transmitted in plain text (if not using HTTPS)
- **Recommendation**:
  - Always use HTTPS in production
  - Enforce HTTPS redirects
  - Use secure cookies if implementing cookie-based auth

#### 8. Security Headers
- **Issue**: No security headers configured
- **Risk**: Low - Missing additional security layers
- **Recommendation**:
  - Implement security headers (helmet.js)
  - Content-Security-Policy
  - X-Frame-Options
  - X-Content-Type-Options
  - Strict-Transport-Security

#### 9. Error Message Information Disclosure
- **Status**: ✅ **Good** - Error messages don't expose sensitive information
- **Recommendation**: Continue current practice

#### 10. SQL Injection Protection
- **Status**: ✅ **Good** - Using Mongoose (parameterized queries)
- **Recommendation**: Continue using Mongoose for all database operations

---

## Testing Recommendations

### Manual Testing Checklist

#### 1. Authentication Testing

**Test Admin-Only Endpoints as Non-Admin User**
```bash
# Login as non-admin user and get token
curl -X POST http://localhost:3001/api/login \
  -H "Content-Type: application/json" \
  -d '{"reg_number":"testuser","password":"password"}'

# Try to call admin endpoint
curl -H "Authorization: Bearer <non-admin-token>" \
     http://localhost:3001/api/add-captain \
     -X POST -H "Content-Type: application/json" \
     -d '{"reg_number":"test","sport":"cricket"}'
# Expected: 403 Forbidden
```

**Test Admin-Only Endpoints as Admin User**
```bash
# Login as admin and get token
curl -X POST http://localhost:3001/api/login \
  -H "Content-Type: application/json" \
  -d '{"reg_number":"admin","password":"adminpassword"}'

# Call admin endpoint
# Expected: 200 OK
```

**Test Without Token**
```bash
# Call admin endpoint without token
curl http://localhost:3001/api/add-captain \
     -X POST -H "Content-Type: application/json" \
     -d '{"reg_number":"test","sport":"cricket"}'
# Expected: 401 Unauthorized
```

**Test Invalid Token**
```bash
# Call endpoint with invalid token
curl -H "Authorization: Bearer invalid-token" \
     http://localhost:3001/api/me
# Expected: 403 Forbidden
```

#### 2. Period Restriction Testing

**Test Registration Outside Registration Period**
```bash
# Try to register player outside registration period
curl -X POST http://localhost:3001/api/save-player \
  -H "Content-Type: application/json" \
  -d '{"reg_number":"test123","full_name":"Test User",...}'
# Expected: 400 Bad Request with period information
```

**Test Match Scheduling Outside Event Period**
```bash
# Try to schedule match outside event period
curl -H "Authorization: Bearer <admin-token>" \
     http://localhost:3001/api/event-schedule \
     -X POST -H "Content-Type: application/json" \
     -d '{"sports_name":"cricket","match_date":"2027-01-01",...}'
# Expected: 400 Bad Request with period information
```

#### 3. Input Validation Testing

**Test Invalid Email Format**
```bash
# Try to register with invalid email
curl -X POST http://localhost:3001/api/save-player \
  -H "Content-Type: application/json" \
  -d '{"reg_number":"test123","email_id":"invalid-email",...}'
# Expected: 400 Bad Request with validation error
```

**Test Invalid Phone Number**
```bash
# Try to register with invalid phone
curl -X POST http://localhost:3001/api/save-player \
  -H "Content-Type: application/json" \
  -d '{"reg_number":"test123","mobile_number":"123",...}'
# Expected: 400 Bad Request with validation error
```

**Test Invalid Department**
```bash
# Try to register with non-existent department
curl -X POST http://localhost:3001/api/save-player \
  -H "Content-Type: application/json" \
  -d '{"reg_number":"test123","department_branch":"InvalidDept",...}'
# Expected: 400 Bad Request with validation error
```

#### 4. Authorization Testing

**Test Direct API Access**
- Without token: Should return 401
- With invalid token: Should return 403
- With valid non-admin token: Should return 403 for admin endpoints
- With valid admin token: Should return 200 for admin endpoints

**Test Frontend Manipulation**
- Try to call admin endpoints from browser console
- Backend should reject with 403 even if frontend allows the call

### Automated Testing Recommendations

1. **Unit Tests**: Test middleware functions in isolation
2. **Integration Tests**: Test complete request/response cycles
3. **Security Tests**: Use tools like OWASP ZAP or Burp Suite
4. **Penetration Testing**: Regular security audits

---

## Conclusion

### ✅ Strengths

1. **Authentication**: Properly implemented JWT-based authentication
2. **Authorization**: All admin endpoints properly protected
3. **Input Validation**: Comprehensive validation for all user inputs
4. **Period Restrictions**: Properly enforced registration and event periods
5. **Data Protection**: Passwords excluded from all responses
6. **Error Handling**: Proper HTTP status codes and error messages
7. **User Verification**: User existence verified on every request

### ⚠️ Areas for Improvement

1. **Password Security**: Implement password hashing (CRITICAL)
2. **CORS Configuration**: Restrict to specific origins in production (CRITICAL)
3. **JWT Secret**: Ensure strong secret in production (MEDIUM)
4. **Rate Limiting**: Implement rate limiting (MEDIUM)
5. **Input Sanitization**: Enhance sanitization for XSS prevention (MEDIUM)
6. **HTTPS**: Enforce HTTPS in production (LOW)
7. **Security Headers**: Implement security headers (LOW)

### Overall Security Status

**Current Status**: ⚠️ **Functional but needs improvements for production**

The application has a solid security foundation with proper authentication, authorization, and input validation. However, critical improvements are needed, especially password hashing and CORS configuration, before deploying to production.

**Recommendation**: Address critical issues (password hashing, CORS) before production deployment. Medium and low priority issues can be addressed in subsequent releases.

---

**Document Version**: 2.0  
**Last Updated**: January 2026  
**Next Review**: Before production deployment
