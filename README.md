# Porta Gateway v1.5.0

A secure authentication gateway for the ARCA (Academic Resource Curation Archive) ecosystem, built with React, TypeScript, and Vite. Deployed on Vercel with Supabase backend integration.

## Overview

Porta Gateway serves as the central authentication service for ARCA applications, providing:

- **Centralized Authentication**: Single sign-on for multiple ARCA apps
- **ARCA App Integration**: Secure API endpoints for authentication requests
- **Supabase Integration**: Database-backed user management and authentication
- **Admin Dashboard**: Complete user and application management interface
- **Messaging System**: SendGrid-powered email notifications with template management
- **User Creation**: Admin tools for creating users with automatic welcome emails
- **Role Management**: Granular role assignment with email notifications
- **Production Ready**: Deployed on Vercel with comprehensive error handling

## Quick Start

### Prerequisites

- Node.js ≥20.19.0
- npm or yarn
- Supabase project with authentication enabled
- Vercel account (for deployment)

### Installation

```bash
# Clone the repository
git clone https://github.com/Lvigentini/porta-gateway.git
cd porta-gateway

# Install dependencies
npm install

# Set up environment variables (see Environment Variables section)
cp .env.example .env
# Edit .env with your actual values

# Start development server
npm run dev
```

## Environment Variables

Create a `.env` file with the following variables:

```env
VITE_ARCA_APP_SECRET=your_arca_app_secret_here
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_JWT_SECRET=your_jwt_secret_for_token_generation
SENDGRID_API_KEY=your_sendgrid_api_key_here
```

### Vercel Environment Variables

For production deployment, set these in your Vercel project settings:

- `VITE_ARCA_APP_SECRET`: Custom secret for ARCA app validation
- `VITE_SUPABASE_URL`: Your Supabase project URL
- `VITE_SUPABASE_ANON_KEY`: Your Supabase anonymous key
- `VITE_JWT_SECRET`: Secret for JWT token generation
- `SENDGRID_API_KEY`: SendGrid API key for email functionality (messaging system)

## How We Got This Working

### Critical Issues Resolved

1. **Split TypeScript Configuration Problem**: 
   - **Issue**: Conflicting `.js` and `.ts` files caused dev server to serve old compiled code
   - **Solution**: Removed all compiled `.js` files, used unified TypeScript config
   - **Impact**: Fixed persistent cache issues where changes weren't reflected

2. **Incorrect Supabase Keys**:
   - **Issue**: Using expired/wrong `VITE_SUPABASE_ANON_KEY` causing "Invalid API key" errors
   - **Solution**: Updated to correct anon key from Supabase project
   - **Impact**: Fixed all 401 authentication and database connectivity issues

3. **ARCA App Secret Validation**:
   - **Issue**: Missing `app_secret` field in authentication requests
   - **Solution**: Added `VITE_ARCA_APP_SECRET` to credentials and environment variables
   - **Impact**: Fixed "Invalid app credentials" errors

4. **Environment Variable Naming**:
   - **Issue**: Inconsistent naming between `VITE_CLIENT_*` and `VITE_*` prefixes
   - **Solution**: Standardized on `VITE_*` prefix following ARCA patterns
   - **Impact**: Fixed environment variable access issues

### Key Debugging Techniques

- **Browser cache issues**: Used timestamp-based filenames and no-cache headers
- **Vercel deployment issues**: Direct `vercel --prod` deployment for immediate testing
- **Database connectivity**: Direct Supabase REST API calls with service role for debugging
- **Environment variable validation**: Added comprehensive debug logging

## API Endpoints

### Authentication

#### `POST /api/auth/login`

Authenticates users and returns JWT tokens.

**Request:**
```json
{
  "email": "admin@arca.dev",
  "password": "admin123",
  "app": "arca",
  "redirect_url": "https://your-app.vercel.app",
  "app_secret": "your_arca_app_secret"
}
```

**Response:**
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": "f99e7101-461e-47bc-a5d5-ba5d38046ecd",
    "email": "admin@arca.dev",
    "role": "admin"
  },
  "expires_in": 1800
}
```

### Health Check

#### `GET /api/health`

Returns system status and configuration.

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2025-08-06T12:00:00.000Z",
  "version": "1.3.0",
  "message": "Porta Gateway (React + Vite)",
  "environment": {
    "hasSupabaseUrl": true,
    "hasSupabaseKey": true,
    "hasJwtSecret": true,
    "hasArcaSecret": true
  },
  "services": {
    "database": { "status": "healthy" },
    "authentication": { "status": "healthy", "provider": "Supabase" }
  }
}
```

## Connecting Other Apps

### Integration Pattern

1. **App Registration**: Each connecting app needs a unique `app_secret`
2. **Authentication Flow**: Apps POST to `/api/auth/login` with credentials + app_secret
3. **Token Validation**: Returned JWT tokens contain user info and permissions
4. **Error Handling**: Comprehensive error responses for debugging

### Example Integration (React)

```typescript
// In your ARCA app
const authenticateWithPorta = async (email: string, password: string) => {
  const response = await fetch('https://porta-gateway.vercel.app/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email,
      password,
      app: 'arca',
      redirect_url: window.location.origin,
      app_secret: process.env.VITE_ARCA_APP_SECRET
    })
  });
  
  const result = await response.json();
  if (result.success) {
    // Store JWT token
    localStorage.setItem('auth_token', result.token);
    // Update app state with user info
    setCurrentUser(result.user);
  }
};
```

### Security Requirements

- **HTTPS Only**: All authentication requests must use HTTPS
- **App Secrets**: Each app must have a unique secret for validation
- **Token Expiry**: JWT tokens expire after 30 minutes (1800 seconds)
- **CORS Configuration**: Properly configured for cross-origin requests

## Test Users

The system includes 4 test users for development:

| Email | Password | Role | Purpose |
|-------|----------|------|---------|
| admin@arca.dev | admin123 | admin | Full system access |
| editor@arca.dev | editor123 | editor | Content editing |
| reviewer@arca.dev | reviewer123 | reviewer | Content review |
| viewer@arca.dev | viewer123 | viewer | Read-only access |

## Development Commands

```bash
# Development
npm run dev              # Start dev server (localhost:5180)
npm run build            # Production build
npm run preview          # Preview production build

# Deployment  
vercel --prod           # Deploy to production
git tag v1.x.x          # Create version tag
git push --tags         # Push tags to trigger deployment

# Testing
# Use the built-in test interface at localhost:5180
# Test buttons available for all major functions
```

## Project Structure

```
porta-gateway/
├── api/                 # Vercel serverless functions
│   ├── auth/
│   │   └── login.ts    # Authentication endpoint
│   └── health.ts       # Health check endpoint
├── src/
│   ├── components/     # React components
│   ├── services/       # Business logic services
│   ├── lib/           # Utility libraries
│   ├── types/         # TypeScript type definitions
│   └── constants/     # App constants and configuration
├── public/            # Static assets
└── vercel.json        # Vercel deployment configuration
```

## Technologies

- **Frontend**: React 18, TypeScript 5, Vite 7
- **Backend**: Vercel Functions (Node.js)
- **Database**: Supabase (PostgreSQL)
- **Deployment**: Vercel
- **Authentication**: Custom JWT + Supabase Auth

## Version History

- **v1.5.0**: Added user creation and comprehensive messaging system with SendGrid integration
- **v1.4.0**: Complete roles & ACL management system with app assignments
- **v1.3.0**: Fixed Supabase authentication, resolved cache issues, production ready
- **v1.2.0**: Added version management and UI improvements  
- **v1.0.0**: Initial release with basic authentication framework

## Support

For issues or questions, please check:
1. Browser console for detailed error messages
2. Vercel function logs for backend issues
3. Supabase project logs for database connectivity
4. Environment variables configuration in Vercel dashboard

## Contributing

This project follows the ARCA ecosystem patterns and conventions. Please ensure:
- TypeScript compilation passes (`npm run build`)
- All test functions work locally before deployment
- Environment variables are properly configured
- Version numbers are updated consistently across all files