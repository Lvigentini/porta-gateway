/**
 * Emergency Authentication Service
 * Provides backup authentication when primary systems fail
 */

export interface EmergencyAuthResult {
  success: boolean;
  user?: {
    id: string;
    email: string;
    role: string;
    isEmergencyAccess: true;
  };
  error?: string;
  expiresAt?: string;
}

export interface EmergencyCredentials {
  email: string;
  token: string;
}

export class EmergencyAuthService {
  private static readonly EMERGENCY_TOKEN_EXPIRY_HOURS = 24;
  
  /**
   * Validate emergency admin credentials
   */
  static validateEmergencyCredentials(credentials: EmergencyCredentials): EmergencyAuthResult {
    try {
      console.log('[Emergency] Validating emergency credentials for:', credentials.email);
      
      // Get emergency admin configuration from environment
      const emergencyEmail = process.env.EMERGENCY_ADMIN_EMAIL;
      const emergencyToken = process.env.EMERGENCY_ADMIN_TOKEN;
      const emergencyTokenDate = process.env.EMERGENCY_ADMIN_TOKEN_DATE;
      
      if (!emergencyEmail || !emergencyToken) {
        console.warn('[Emergency] Emergency admin credentials not configured');
        return {
          success: false,
          error: 'Emergency admin not configured'
        };
      }
      
      // Validate email match
      if (credentials.email !== emergencyEmail) {
        console.warn('[Emergency] Emergency email mismatch:', { provided: credentials.email, expected: emergencyEmail });
        return {
          success: false,
          error: 'Invalid emergency credentials'
        };
      }
      
      // Validate token
      if (credentials.token !== emergencyToken) {
        console.warn('[Emergency] Emergency token mismatch');
        return {
          success: false,
          error: 'Invalid emergency credentials'
        };
      }
      
      // Check token expiry (if date is provided)
      if (emergencyTokenDate) {
        const tokenDate = new Date(emergencyTokenDate);
        const now = new Date();
        const hoursOld = (now.getTime() - tokenDate.getTime()) / (1000 * 60 * 60);
        
        if (hoursOld > this.EMERGENCY_TOKEN_EXPIRY_HOURS) {
          console.warn('[Emergency] Emergency token expired:', { hoursOld, maxHours: this.EMERGENCY_TOKEN_EXPIRY_HOURS });
          return {
            success: false,
            error: 'Emergency token expired'
          };
        }
      }
      
      // Calculate expiry time
      const baseDate = emergencyTokenDate ? new Date(emergencyTokenDate) : new Date();
      const expiresAt = new Date(baseDate.getTime() + (this.EMERGENCY_TOKEN_EXPIRY_HOURS * 60 * 60 * 1000));
      
      console.log('[Emergency] Emergency authentication successful');
      
      return {
        success: true,
        user: {
          id: 'emergency-admin-001',
          email: emergencyEmail,
          role: 'admin',
          isEmergencyAccess: true
        },
        expiresAt: expiresAt.toISOString()
      };
      
    } catch (error) {
      console.error('[Emergency] Error validating emergency credentials:', error);
      return {
        success: false,
        error: 'Emergency authentication failed'
      };
    }
  }
  
  /**
   * Generate emergency admin token for configuration
   */
  static generateEmergencyToken(): string {
    // Generate a secure random token
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let token = '';
    for (let i = 0; i < 64; i++) {
      token += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return token;
  }
  
  /**
   * Check if emergency mode should be enabled based on system health
   */
  static shouldEnableEmergencyMode(healthMetrics: {
    supabaseConnectivity: number; // 0-1 (success rate)
    authSuccessRate: number; // 0-1 (success rate)
    averageResponseTime: number; // milliseconds
    consecutiveFailures: number;
  }): boolean {
    // Enable emergency mode if:
    // - Supabase connectivity < 50% over recent period
    // - Auth success rate < 80% 
    // - Average response time > 10 seconds
    // - More than 5 consecutive failures
    
    return (
      healthMetrics.supabaseConnectivity < 0.5 ||
      healthMetrics.authSuccessRate < 0.8 ||
      healthMetrics.averageResponseTime > 10000 ||
      healthMetrics.consecutiveFailures > 5
    );
  }
  
  /**
   * Log emergency access for audit purposes
   */
  static async logEmergencyAccess(
    email: string, 
    action: string, 
    success: boolean, 
    userAgent?: string,
    ipAddress?: string
  ): Promise<void> {
    const logEntry = {
      timestamp: new Date().toISOString(),
      email,
      action,
      success,
      userAgent,
      ipAddress,
      type: 'emergency_access'
    };
    
    // Log to console (in production, this should go to a monitoring service)
    console.log('[Emergency] Emergency access log:', logEntry);
    
    // TODO: In production, send to monitoring service (DataDog, etc.)
    // await sendToMonitoring('emergency_access', logEntry);
  }
  
  /**
   * Get emergency configuration status
   */
  static getEmergencyStatus(): {
    configured: boolean;
    tokenExpiry?: string;
    hoursUntilExpiry?: number;
  } {
    const emergencyEmail = process.env.EMERGENCY_ADMIN_EMAIL;
    const emergencyToken = process.env.EMERGENCY_ADMIN_TOKEN;
    const emergencyTokenDate = process.env.EMERGENCY_ADMIN_TOKEN_DATE;
    
    const configured = !!(emergencyEmail && emergencyToken);
    
    if (!configured) {
      return { configured: false };
    }
    
    if (emergencyTokenDate) {
      const tokenDate = new Date(emergencyTokenDate);
      const expiryDate = new Date(tokenDate.getTime() + (this.EMERGENCY_TOKEN_EXPIRY_HOURS * 60 * 60 * 1000));
      const now = new Date();
      const hoursUntilExpiry = Math.max(0, (expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60));
      
      return {
        configured: true,
        tokenExpiry: expiryDate.toISOString(),
        hoursUntilExpiry
      };
    }
    
    return { configured: true };
  }
  
  /**
   * Create emergency admin JWT token for API access
   */
  static createEmergencyToken(user: { id: string; email: string; role: string }): string {
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      isEmergencyAccess: true,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + (2 * 60 * 60), // 2 hour expiry for emergency tokens
      iss: 'porta-gateway-emergency'
    };
    
    // Create simple base64 token (consistent with existing format)
    return Buffer.from(JSON.stringify(payload)).toString('base64');
  }
}