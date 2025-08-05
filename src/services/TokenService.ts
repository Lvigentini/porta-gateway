// Simple JWT Token Service for Porta Gateway
// Client-side token generation without complex dependencies

import jwt from 'jsonwebtoken';
import { User, TokenPayload } from '../types/auth';

export class TokenService {
  private static readonly JWT_SECRET = import.meta.env.VITE_JWT_SECRET || 'dev-super-secret-key';
  private static readonly TOKEN_EXPIRY = '30m'; // 30 minutes
  private static readonly REFRESH_EXPIRY = '7d'; // 7 days

  /**
   * Generate simple JWT token for app
   */
  static generateToken(user: User, app: string): string {
    try {
      const payload: Omit<TokenPayload, 'iat' | 'exp'> = {
        sub: user.id,
        email: user.email,
        role: user.role,
        app: app
      };

      return jwt.sign(payload, this.JWT_SECRET, {
        algorithm: 'HS256',
        expiresIn: this.TOKEN_EXPIRY,
        issuer: 'porta-gateway'
      });
    } catch (error) {
      console.error('JWT generation error:', error);
      throw new Error('Failed to generate token');
    }
  }

  /**
   * Generate refresh token
   */
  static generateRefreshToken(user: User): string {
    try {
      const payload = {
        sub: user.id,
        type: 'refresh'
      };

      return jwt.sign(payload, this.JWT_SECRET, {
        algorithm: 'HS256',
        expiresIn: this.REFRESH_EXPIRY,
        issuer: 'porta-gateway'
      });
    } catch (error) {
      console.error('Refresh token generation error:', error);
      throw new Error('Failed to generate refresh token');
    }
  }

  /**
   * Validate token
   */
  static validateToken(token: string): TokenPayload | null {
    try {
      const decoded = jwt.verify(token, this.JWT_SECRET) as TokenPayload;
      return decoded;
    } catch (error) {
      console.error('Token validation error:', error);
      return null;
    }
  }
}