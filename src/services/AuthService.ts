// Porta Gateway Authentication Service
// Simple client-side authentication using proven ARCA patterns

import { supabase } from '../lib/supabase';
import type { LoginCredentials, AuthResult, User } from '../types/auth';

export class AuthService {
  
  /**
   * Authenticate user via Supabase (same pattern as ARCA)
   */
  static async authenticate(credentials: LoginCredentials): Promise<AuthResult> {
    if (!supabase) {
      return {
        success: false,
        error: 'Supabase not configured - authentication not available'
      };
    }

    try {
      // Use the same authentication pattern that works in ARCA
      const { data, error } = await supabase.auth.signInWithPassword({
        email: credentials.email,
        password: credentials.password,
      });

      if (error) {
        return {
          success: false,
          error: error.message
        };
      }

      if (!data.user) {
        return {
          success: false,
          error: 'Authentication failed'
        };
      }

      // Fetch full user profile from our users table (same as ARCA)
      const user = await this.fetchUserProfile(data.user.id);
      
      if (!user) {
        return {
          success: false,
          error: 'User profile not found'
        };
      }

      // For client-side auth service, we just return user info
      // Token generation happens in Vercel functions
      return {
        success: true,
        user
      };

    } catch (error) {
      console.error('Authentication error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Authentication failed'
      };
    }
  }

  /**
   * Fetch user profile (same pattern as ARCA)
   */
  private static async fetchUserProfile(userId: string): Promise<User | null> {
    if (!supabase) return null;

    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

      if (error || !data) {
        console.error('Failed to fetch user profile:', error);
        return null;
      }

      return {
        id: data.id,
        email: data.email,
        name: data.first_name && data.last_name 
          ? `${data.first_name} ${data.last_name}` 
          : data.email,
        role: data.role || 'user',
        emailVerified: data.email_verified || false,
        createdAt: data.created_at,
        lastLoginAt: data.last_login_at
      };
    } catch (error) {
      console.error('Error fetching user profile:', error);
      return null;
    }
  }

  /**
   * Health check
   */
  static async getHealth(): Promise<{ status: string; timestamp: string }> {
    try {
      if (!supabase) {
        return {
          status: 'unhealthy - supabase not configured',
          timestamp: new Date().toISOString()
        };
      }

      // Test database connection
      const { error } = await supabase
        .from('users')
        .select('count', { count: 'exact' })
        .limit(1);

      return {
        status: error ? 'unhealthy - database error' : 'healthy',
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        status: 'unhealthy - connection failed',
        timestamp: new Date().toISOString()
      };
    }
  }
}