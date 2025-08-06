// Porta Gateway Authentication Service
// Simple client-side authentication using proven ARCA patterns

import { supabase } from '../lib/supabase';
import type { LoginCredentials, AuthResult, User } from '../types/auth';

export class AuthService {
  
  /**
   * Authenticate user via Supabase (same pattern as ARCA)
   */
  static async authenticate(credentials: LoginCredentials): Promise<AuthResult> {
    console.log('🔑 AuthService.authenticate: Starting...');
    console.log('🔑 AuthService.authenticate: Supabase available:', !!supabase);
    
    if (!supabase) {
      console.log('🔑 AuthService.authenticate: Supabase not configured');
      return {
        success: false,
        error: 'Supabase not configured - authentication not available'
      };
    }

    try {
      console.log('🔑 AuthService.authenticate: Calling supabase.auth.signInWithPassword...');
      // Use the same authentication pattern that works in ARCA
      const { data, error } = await supabase.auth.signInWithPassword({
        email: credentials.email,
        password: credentials.password,
      });

      console.log('🔑 AuthService.authenticate: Supabase auth result:', { 
        hasData: !!data, 
        hasUser: !!data?.user, 
        hasError: !!error,
        errorMessage: error?.message 
      });

      if (error) {
        console.log('🔑 AuthService.authenticate: Supabase auth error:', error.message);
        return {
          success: false,
          error: error.message
        };
      }

      if (!data.user) {
        console.log('🔑 AuthService.authenticate: No user in response');
        return {
          success: false,
          error: 'Authentication failed'
        };
      }

      console.log('🔑 AuthService.authenticate: Fetching user profile for ID:', data.user.id);
      // Fetch full user profile from our users table (same as ARCA)
      const user = await this.fetchUserProfile(data.user.id);
      
      if (!user) {
        console.log('🔑 AuthService.authenticate: User profile not found');
        return {
          success: false,
          error: 'User profile not found'
        };
      }

      console.log('🔑 AuthService.authenticate: Success! User:', { id: user.id, email: user.email });
      
      // Check if we're running locally (for testing) or in production
      const isLocal = import.meta.env.DEV;
      console.log('🔑 AuthService.authenticate: Running locally:', isLocal);
      
      if (isLocal) {
        // LOCAL: Generate JWT token for testing
        console.log('🔑 AuthService.authenticate: Generating local JWT token...');
        
        const payload = {
          sub: user.id,
          email: user.email,
          role: user.role,
          app: credentials.app || 'unknown',
          iat: Math.floor(Date.now() / 1000),
          exp: Math.floor(Date.now() / 1000) + (30 * 60), // 30 minutes
          iss: 'porta-gateway'
        };
        
        // Simple base64 encoded token for local testing
        const token = btoa(JSON.stringify(payload));
        const refresh_token = btoa(JSON.stringify({...payload, type: 'refresh', exp: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60)}));
        
        console.log('🔑 AuthService.authenticate: Generated local token:', token.substring(0, 20) + '...');
        
        return {
          success: true,
          user,
          token,
          refresh_token,
          redirect_url: credentials.app === 'arca' ? 'https://arca-alpha.vercel.app' : undefined
        };
      } else {
        // PRODUCTION: Only return user info, token generation happens in Vercel functions
        console.log('🔑 AuthService.authenticate: Production mode - returning user only');
        return {
          success: true,
          user
        };
      }

    } catch (error) {
      console.error('🔑 AuthService.authenticate: Critical error:', error);
      console.error('🔑 AuthService.authenticate: Error stack:', error instanceof Error ? error.stack : 'No stack');
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