# Security Cleanup and Hardening Plan

## Overview

This document outlines the security improvements and console cleanup needed for porta-gateway production deployment.

## Phase 1: Debug Console Cleanup

### Current Debug Messages to Remove/Minimize

1. **Environment Variable Logging**
   ```typescript
   // REMOVE - Exposes configuration
   console.log('🔧 Environment check:', {
     hasSupabaseUrl: !!import.meta.env.VITE_SUPABASE_URL,
     supabaseUrl: import.meta.env.VITE_SUPABASE_URL, // SECURITY RISK
   });
   ```

2. **Authentication Flow Logging**
   ```typescript
   // REMOVE - Exposes credentials and tokens
   console.log('📤 Sending credentials with app_secret:', credentials);
   console.log('🔐 VITE_ARCA_APP_SECRET value:', import.meta.env.VITE_ARCA_APP_SECRET);
   console.log('📦 Full response body:', result); // Contains JWT tokens
   ```

3. **Debug UI Elements**
   ```typescript
   // REMOVE - Test interface should not be in production
   console.log('🚨🚨🚨 THIS IS THE NEW VERSION WITH DEBUG CODE 🚨🚨🚨');
   ```

### Recommended Logging Strategy

```typescript
// Create environment-aware logging utility
const logger = {
  debug: (message: string, data?: any) => {
    if (import.meta.env.DEV) {
      console.log(`[DEBUG] ${message}`, data);
    }
  },
  info: (message: string) => {
    console.log(`[INFO] ${message}`);
  },
  error: (message: string, error?: any) => {
    console.error(`[ERROR] ${message}`, error);
  },
  warn: (message: string) => {
    console.warn(`[WARN] ${message}`);
  }
};
```

## Phase 2: Security Hardening

### 1. Environment Variable Protection

**Current Risk:**
- App secrets logged to console
- Supabase URLs exposed in logs
- JWT tokens visible in browser console

**Solution:**
```typescript
// src/utils/logger.ts
export const secureLog = (message: string, data?: any) => {
  if (import.meta.env.DEV) {
    // Sanitize sensitive data
    const sanitizedData = data ? sanitizeLogData(data) : undefined;
    console.log(message, sanitizedData);
  }
};

const sanitizeLogData = (data: any): any => {
  const sensitiveKeys = ['app_secret', 'token', 'password', 'key'];
  const sanitized = { ...data };
  
  for (const key of sensitiveKeys) {
    if (sanitized[key]) {
      sanitized[key] = '[REDACTED]';
    }
  }
  
  return sanitized;
};
```

### 2. Production UI Cleanup

**Remove Test Interface:**
- All test buttons and debug panels should be hidden in production
- Use environment-based conditional rendering

```typescript
// Only show test interface in development
{import.meta.env.DEV && (
  <div className="debug-panel">
    {/* Test buttons and debug info */}
  </div>
)}
```

### 3. API Security Improvements

**Request Validation:**
```typescript
// api/auth/login.ts - Add request validation
const validateRequest = (body: any): boolean => {
  const requiredFields = ['email', 'password', 'app', 'app_secret'];
  return requiredFields.every(field => body[field]);
};

// Add rate limiting
const rateLimiter = new Map();
const checkRateLimit = (ip: string): boolean => {
  const attempts = rateLimiter.get(ip) || 0;
  if (attempts > 5) return false;
  
  rateLimiter.set(ip, attempts + 1);
  setTimeout(() => rateLimiter.delete(ip), 15 * 60 * 1000); // 15 min
  return true;
};
```

**Response Security:**
```typescript
// Remove sensitive data from error responses
const sanitizeError = (error: string): string => {
  // Don't expose internal system details
  if (error.includes('Supabase') || error.includes('database')) {
    return 'Authentication service temporarily unavailable';
  }
  return error;
};
```

### 4. CORS and Header Security

**Enhanced Security Headers:**
```typescript
// api/auth/login.ts
res.setHeader('X-Content-Type-Options', 'nosniff');
res.setHeader('X-Frame-Options', 'DENY');
res.setHeader('X-XSS-Protection', '1; mode=block');
res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
```

**Stricter CORS:**
```typescript
// Instead of '*', use specific origins
const allowedOrigins = [
  'https://arca-alpha.vercel.app',
  'https://your-production-domain.com'
];

const origin = req.headers.origin;
if (allowedOrigins.includes(origin)) {
  res.setHeader('Access-Control-Allow-Origin', origin);
}
```

### 5. JWT Token Security

**Token Improvements:**
```typescript
// Add more secure JWT claims
const tokenPayload = {
  sub: user.id,
  email: user.email,
  role: user.role,
  iss: 'porta-gateway',
  aud: body.app, // App-specific tokens
  exp: Math.floor(Date.now() / 1000) + 1800, // 30 min
  iat: Math.floor(Date.now() / 1000),
  jti: generateUniqueId(), // JWT ID for revocation
  scope: getUserPermissions(user.role) // Granular permissions
};
```

**Token Validation:**
```typescript
// Add token revocation list
const revokedTokens = new Set();

const validateToken = (token: string): boolean => {
  const decoded = jwt.decode(token);
  if (revokedTokens.has(decoded.jti)) {
    return false;
  }
  return jwt.verify(token, JWT_SECRET);
};
```

## Phase 3: Error Handling Improvements

### 1. User-Friendly Error Messages

**Current Issues:**
- Technical error messages exposed to users
- Stack traces in production responses
- Inconsistent error formats

**Solution:**
```typescript
// src/utils/errorHandler.ts
export const handleAuthError = (error: any): string => {
  const errorMap = {
    'Invalid login credentials': 'Email or password is incorrect',
    'Invalid app credentials': 'Application authentication failed',
    'Supabase not configured': 'Service temporarily unavailable',
    'Network error': 'Connection failed. Please try again.',
  };
  
  return errorMap[error.message] || 'Authentication failed. Please try again.';
};
```

### 2. Monitoring and Alerting

**Add Error Tracking:**
```typescript
// src/utils/monitoring.ts
export const trackError = (error: Error, context: string) => {
  if (!import.meta.env.DEV) {
    // Send to monitoring service (Sentry, etc.)
    console.error(`[${context}] Production Error:`, {
      message: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });
  }
};
```

## Phase 4: Implementation Timeline

### Week 1: Logging Cleanup
1. Replace console.log statements with logger utility
2. Remove sensitive data from logs
3. Add environment-based debug controls

### Week 2: UI Security
1. Hide test interface in production
2. Add production health dashboard
3. Remove debug UI elements

### Week 3: API Security
1. Implement request validation
2. Add rate limiting
3. Enhance CORS configuration
4. Improve JWT token security

### Week 4: Testing and Monitoring
1. Security testing
2. Error handling validation
3. Monitoring setup
4. Performance optimization

## Implementation Priority

**High Priority (Critical Security):**
1. Remove credential logging
2. Hide test interface in production
3. Sanitize error messages
4. Add rate limiting

**Medium Priority (Best Practices):**
1. Structured logging
2. Enhanced CORS
3. JWT improvements
4. Error tracking

**Low Priority (Optimization):**
1. Performance monitoring
2. Advanced analytics
3. UI polish
4. Documentation updates

## Testing Checklist

### Security Testing
- [ ] Credentials not logged in production
- [ ] Test interface hidden in production  
- [ ] Error messages don't expose system details
- [ ] Rate limiting prevents brute force
- [ ] CORS properly restricts origins
- [ ] JWT tokens include proper claims

### Functionality Testing
- [ ] Authentication still works after cleanup
- [ ] Error handling provides useful feedback
- [ ] Production monitoring captures issues
- [ ] Performance acceptable after changes

### Integration Testing
- [ ] ARCA integration unaffected
- [ ] All test users still work
- [ ] Token refresh still functional
- [ ] Logout properly cleans up