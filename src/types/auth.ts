// Authentication types based on proven ARCA implementation

// Enhanced user types for ARCA
export type UserRole = 'viewer' | 'reviewer' | 'editor' | 'admin';

export interface UserProfile {
  firstName?: string;
  lastName?: string;
  title?: string;
  institution?: string;
  department?: string;
  bio?: string;
  website?: string;
  orcidId?: string;
  avatarUrl?: string;
  expertiseAreas: string[];
}

export interface ARCAUser {
  id: string;
  email: string;
  role: UserRole;
  profile: UserProfile;
  
  // Academic metrics
  qualityScore: number;
  contributionCount: number;
  reviewCount: number;
  
  // Status fields
  isActive: boolean;
  emailVerified: boolean;
  roleRequestStatus: 'none' | 'pending' | 'approved' | 'rejected';
  roleRequested?: UserRole;
  
  // Timestamps
  createdAt: string;
  updatedAt: string;
  lastLoginAt?: string;
}

export interface Permission {
  resource: string;
  actions: string[];
  conditions?: Record<string, any>;
  costLimits?: {
    dailyLlmTokens?: number;
    monthlyStorageMb?: number;
  };
}

export interface AuthResult {
  user: ARCAUser | null;
  error: string | null;
  success: boolean;
}

export interface LoginCredentials {
  email: string;
  password: string;
  app?: string;
  redirect_url?: string;
}

export interface RegisterData {
  email: string;
  password: string;
  profile: Partial<UserProfile>;
  requestedRole?: UserRole;
}

export interface TokenPayload {
  sub: string;
  email: string;
  role: string;
  app: string;
  iat: number;
  exp: number;
}