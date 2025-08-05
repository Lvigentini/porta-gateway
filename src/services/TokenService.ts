// Simple Token Service for Porta Gateway
// Client-side utilities (token generation handled by Vercel functions)

import type { TokenPayload } from '../types/auth';

export class TokenService {
  /**
   * Parse JWT token payload (client-side utility)
   */
  static parseToken(token: string): TokenPayload | null {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) return null;
      
      const payload = JSON.parse(atob(parts[1]));
      return payload as TokenPayload;
    } catch (error) {
      console.error('Token parsing error:', error);
      return null;
    }
  }

  /**
   * Check if token is expired
   */
  static isTokenExpired(token: string): boolean {
    const payload = this.parseToken(token);
    if (!payload || !payload.exp) return true;
    
    return Date.now() >= payload.exp * 1000;
  }

  /**
   * Get token expiry time
   */
  static getTokenExpiry(token: string): Date | null {
    const payload = this.parseToken(token);
    if (!payload || !payload.exp) return null;
    
    return new Date(payload.exp * 1000);
  }
}