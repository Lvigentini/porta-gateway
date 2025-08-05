// Authentication types for Porta Gateway

export interface User {
  id: string;
  email: string;
  name?: string;
  role: string;
  emailVerified: boolean;
  createdAt: string;
  lastLoginAt?: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
  app?: string;
  redirect_url?: string;
}

export interface AuthResult {
  success: boolean;
  user?: User;
  token?: string;
  refresh_token?: string;
  error?: string;
  redirect_url?: string;
}

export interface TokenPayload {
  sub: string;
  email: string;
  role: string;
  app: string;
  iat: number;
  exp: number;
}