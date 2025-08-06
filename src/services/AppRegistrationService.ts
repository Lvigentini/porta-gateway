// App Registration Service - Types and utilities for centralized app management
// Note: Main functionality is implemented inline in API endpoints to avoid Vercel import issues

export interface RegisteredApp {
  id: string;
  app_name: string;
  app_display_name: string;
  app_secret: string;
  allowed_origins: string[];
  redirect_urls: string[];
  status: 'active' | 'disabled' | 'pending';
  created_at: string;
  updated_at: string;
  created_by?: string;
  secret_expires_at?: string;
  permissions: Record<string, any>;
  metadata: Record<string, any>;
}

export interface AppRegistrationRequest {
  app_name: string;
  app_display_name: string;
  allowed_origins: string[];
  redirect_urls: string[];
  permissions?: Record<string, any>;
  metadata?: Record<string, any>;
}

export interface AppValidationResult {
  isValid: boolean;
  app?: RegisteredApp;
  error?: string;
  source?: 'database' | 'environment' | 'emergency';
}

/**
 * Utility functions for app management
 * These are designed to be copied into API endpoints to avoid import issues
 */
export class AppRegistrationUtils {
  
  /**
   * Generate a secure app secret
   */
  static generateAppSecret(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < 64; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  /**
   * Get default secret expiry date (90 days from now)
   */
  static getSecretExpiryDate(): string {
    const date = new Date();
    date.setDate(date.getDate() + 90); // 90 days
    return date.toISOString();
  }

  /**
   * Validate app name format
   */
  static isValidAppName(appName: string): boolean {
    return /^[a-z0-9_-]+$/.test(appName);
  }

  /**
   * Check if secret is near expiry (within 7 days)
   */
  static isSecretNearExpiry(expiryDate?: string): boolean {
    if (!expiryDate) return false;
    
    const expiry = new Date(expiryDate);
    const now = new Date();
    const daysUntilExpiry = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    
    return daysUntilExpiry <= 7;
  }

  /**
   * Check if secret has expired
   */
  static isSecretExpired(expiryDate?: string): boolean {
    if (!expiryDate) return false;
    
    const expiry = new Date(expiryDate);
    const now = new Date();
    
    return expiry < now;
  }
}

// Export utility functions as standalone functions as well for easier inline usage
export const generateAppSecret = AppRegistrationUtils.generateAppSecret;
export const getSecretExpiryDate = AppRegistrationUtils.getSecretExpiryDate;
export const isValidAppName = AppRegistrationUtils.isValidAppName;