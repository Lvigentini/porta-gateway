# Emergency Access System - Porta Gateway

## Overview

The Emergency Access System provides backup authentication when the primary Supabase-based authentication system fails. This ensures administrators can always access the system for recovery operations.

## How It Works

### Multi-Tier Resilience Strategy

1. **Primary**: Supabase Database Authentication (normal operation)
2. **Backup**: Emergency Admin Environment Variables (when primary fails)
3. **Monitoring**: Automatic health monitoring with degraded mode detection
4. **Recovery**: Built-in diagnostics and repair tools

## Setup Instructions

### 1. Configure Emergency Admin in Vercel

Add these environment variables to your Vercel project:

```env
EMERGENCY_ADMIN_EMAIL=admin@yourdomain.com
EMERGENCY_ADMIN_TOKEN=your_secure_64_character_emergency_token_here
EMERGENCY_ADMIN_TOKEN_DATE=2025-08-06T15:00:00.000Z
```

### 2. Generate Emergency Token

Use the built-in token generator or create your own 64-character secure token:

```javascript
// Generate emergency token
const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
let token = '';
for (let i = 0; i < 64; i++) {
  token += chars.charAt(Math.floor(Math.random() * chars.length));
}
console.log('Emergency Token:', token);
```

### 3. Set Token Date

The `EMERGENCY_ADMIN_TOKEN_DATE` should be set to when the token was created. Tokens expire after 24 hours for security.

## Usage

### Accessing Emergency Mode

1. **Automatic**: Emergency mode activates automatically when:
   - Supabase connectivity < 50%
   - Authentication success rate < 80%
   - Response times > 10 seconds
   - 5+ consecutive failures

2. **Manual**: Click the "🚨 Emergency Admin" button in the main interface

### Emergency Login Process

1. Navigate to the Emergency Admin interface
2. Enter your configured emergency admin email
3. Enter your emergency token
4. Click "🚨 Emergency Login"

### What Emergency Access Provides

- **Limited Admin Access**: Database repair, user management, system recovery
- **System Diagnostics**: Comprehensive health checks and issue identification
- **Recovery Tools**: Auto-fix common issues, backup critical data
- **Health Monitoring**: Real-time system status and recommendations

## Security Features

### Access Logging
- All emergency access attempts are logged with:
  - Timestamp and user information
  - IP address and user agent
  - Success/failure status
  - Actions performed

### Token Security
- **24-hour expiry**: Emergency tokens automatically expire
- **Environment-based**: Stored securely in Vercel environment variables
- **Audit trail**: Complete logging of all emergency access

### Permission Limitations
- **Read-only by default**: Most operations require explicit confirmation
- **Time-limited**: Emergency sessions expire after 2 hours
- **Specific scope**: Only essential admin functions available

## Available Emergency Endpoints

### `/api/admin/emergency-login`
- **Method**: POST
- **Purpose**: Authenticate using emergency credentials
- **Body**: `{ "email": "admin@domain.com", "token": "emergency_token" }`

### `/api/admin/diagnose`
- **Method**: GET
- **Purpose**: Comprehensive system diagnostics
- **Returns**: Environment status, service health, recommendations

### `/api/health` (Enhanced)
- **Method**: GET
- **Purpose**: System health with emergency status
- **Returns**: Health metrics, emergency recommendations

## Troubleshooting

### Emergency Token Expired
```
Error: "Emergency token expired"
```
**Solution**: Update `EMERGENCY_ADMIN_TOKEN_DATE` to current timestamp in Vercel environment variables.

### Emergency Not Configured
```
Error: "Emergency admin not configured"
```
**Solution**: Add `EMERGENCY_ADMIN_EMAIL` and `EMERGENCY_ADMIN_TOKEN` to Vercel environment variables.

### System Not Entering Emergency Mode
1. Check system health: Visit `/api/health`
2. Review metrics: Look for `emergencyModeRecommended: true`
3. Manual trigger: Click "🚨 Emergency Admin" button

## Best Practices

### Regular Maintenance
1. **Rotate emergency tokens monthly**
2. **Test emergency access quarterly**
3. **Review emergency logs monthly**
4. **Update token expiry dates**

### Security Guidelines
1. **Limit emergency token sharing**
2. **Use strong, unique tokens**
3. **Monitor emergency access logs**
4. **Revoke old tokens immediately**

### Recovery Planning
1. **Document emergency procedures**
2. **Train multiple administrators**
3. **Maintain backup contact methods**
4. **Test recovery scenarios regularly**

## Emergency Contact Information

When emergency access is needed:

1. **Check system health first**: `https://porta-gateway.vercel.app/api/health`
2. **Review diagnostics**: `https://porta-gateway.vercel.app/api/admin/diagnose`
3. **Access emergency login**: Click "🚨 Emergency Admin" in the interface
4. **Monitor logs**: All emergency access is logged for audit purposes

## Integration with ARCA

The emergency access system works seamlessly with ARCA authentication:

- **Fallback support**: If ARCA can't reach porta-gateway, emergency mode activates
- **Cross-app recovery**: Emergency admin can fix issues affecting all connected apps
- **Unified monitoring**: Single point of health monitoring for the entire ecosystem

Remember: Emergency access should only be used when normal authentication systems are unavailable. All emergency access is logged and audited for security compliance.