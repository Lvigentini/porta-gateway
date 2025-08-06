/**
 * System Health Monitor
 * Tracks system health metrics and determines when emergency mode should be enabled
 */

export interface HealthMetrics {
  supabaseConnectivity: number; // 0-1 success rate
  authSuccessRate: number; // 0-1 success rate  
  averageResponseTime: number; // milliseconds
  consecutiveFailures: number;
  lastSuccessfulAuth: string; // ISO timestamp
  totalRequests: number;
  errorCounts: Record<string, number>;
}

export interface HealthCheckResult {
  timestamp: string;
  component: string;
  success: boolean;
  responseTime: number;
  error?: string;
}

export class SystemHealthMonitor {
  private static readonly METRICS_WINDOW_MS = 5 * 60 * 1000; // 5 minutes
  private static readonly MAX_STORED_CHECKS = 100;
  
  // In-memory storage (in production, use Redis or similar)
  private static healthChecks: HealthCheckResult[] = [];
  private static metrics: HealthMetrics = {
    supabaseConnectivity: 1.0,
    authSuccessRate: 1.0,
    averageResponseTime: 0,
    consecutiveFailures: 0,
    lastSuccessfulAuth: new Date().toISOString(),
    totalRequests: 0,
    errorCounts: {}
  };

  /**
   * Record a health check result
   */
  static recordHealthCheck(result: HealthCheckResult): void {
    // Add to history
    this.healthChecks.push(result);
    
    // Keep only recent checks
    if (this.healthChecks.length > this.MAX_STORED_CHECKS) {
      this.healthChecks = this.healthChecks.slice(-this.MAX_STORED_CHECKS);
    }
    
    // Update metrics
    this.updateMetrics();
  }

  /**
   * Test Supabase connectivity
   */
  static async testSupabaseHealth(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    
    try {
      const supabaseUrl = process.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;
      
      if (!supabaseUrl || !supabaseAnonKey) {
        return {
          timestamp: new Date().toISOString(),
          component: 'supabase',
          success: false,
          responseTime: Date.now() - startTime,
          error: 'Supabase configuration missing'
        };
      }

      // Simple health check query
      const response = await fetch(`${supabaseUrl}/rest/v1/users?select=count&limit=1`, {
        method: 'GET',
        headers: {
          'apikey': supabaseAnonKey,
          'Range': '0-0'
        },
        signal: AbortSignal.timeout(10000) // 10 second timeout
      });

      const responseTime = Date.now() - startTime;
      
      if (response.ok) {
        return {
          timestamp: new Date().toISOString(),
          component: 'supabase',
          success: true,
          responseTime
        };
      } else {
        return {
          timestamp: new Date().toISOString(),
          component: 'supabase',
          success: false,
          responseTime,
          error: `HTTP ${response.status}: ${response.statusText}`
        };
      }
    } catch (error) {
      return {
        timestamp: new Date().toISOString(),
        component: 'supabase',
        success: false,
        responseTime: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Record authentication attempt
   */
  static recordAuthAttempt(success: boolean, responseTime: number, error?: string): void {
    this.recordHealthCheck({
      timestamp: new Date().toISOString(),
      component: 'authentication',
      success,
      responseTime,
      error
    });

    // Update consecutive failures
    if (success) {
      this.metrics.consecutiveFailures = 0;
      this.metrics.lastSuccessfulAuth = new Date().toISOString();
    } else {
      this.metrics.consecutiveFailures++;
      
      // Track error types
      if (error) {
        this.metrics.errorCounts[error] = (this.metrics.errorCounts[error] || 0) + 1;
      }
    }

    this.metrics.totalRequests++;
  }

  /**
   * Update health metrics based on recent checks
   */
  private static updateMetrics(): void {
    const now = Date.now();
    const windowStart = now - this.METRICS_WINDOW_MS;
    
    // Filter to recent checks only
    const recentChecks = this.healthChecks.filter(
      check => new Date(check.timestamp).getTime() >= windowStart
    );
    
    if (recentChecks.length === 0) return;
    
    // Calculate Supabase connectivity
    const supabaseChecks = recentChecks.filter(check => check.component === 'supabase');
    if (supabaseChecks.length > 0) {
      const successfulSupabase = supabaseChecks.filter(check => check.success).length;
      this.metrics.supabaseConnectivity = successfulSupabase / supabaseChecks.length;
    }
    
    // Calculate auth success rate
    const authChecks = recentChecks.filter(check => check.component === 'authentication');
    if (authChecks.length > 0) {
      const successfulAuth = authChecks.filter(check => check.success).length;
      this.metrics.authSuccessRate = successfulAuth / authChecks.length;
    }
    
    // Calculate average response time
    const responseTimes = recentChecks.map(check => check.responseTime);
    if (responseTimes.length > 0) {
      this.metrics.averageResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
    }
  }

  /**
   * Get current health metrics
   */
  static getHealthMetrics(): HealthMetrics {
    this.updateMetrics();
    return { ...this.metrics };
  }

  /**
   * Get recent health check history
   */
  static getHealthHistory(limit: number = 50): HealthCheckResult[] {
    return this.healthChecks.slice(-limit);
  }

  /**
   * Check if system should enter emergency mode
   */
  static shouldEnterEmergencyMode(): boolean {
    const metrics = this.getHealthMetrics();
    
    // Use EmergencyAuthService logic
    return (
      metrics.supabaseConnectivity < 0.5 ||
      metrics.authSuccessRate < 0.8 ||
      metrics.averageResponseTime > 10000 ||
      metrics.consecutiveFailures > 5
    );
  }

  /**
   * Get comprehensive system status
   */
  static getSystemStatus(): {
    status: 'healthy' | 'degraded' | 'emergency';
    emergencyModeRecommended: boolean;
    metrics: HealthMetrics;
    recentIssues: string[];
    recommendations: string[];
  } {
    const metrics = this.getHealthMetrics();
    const emergencyModeRecommended = this.shouldEnterEmergencyMode();
    
    let status: 'healthy' | 'degraded' | 'emergency' = 'healthy';
    const recentIssues: string[] = [];
    const recommendations: string[] = [];
    
    // Determine status
    if (emergencyModeRecommended) {
      status = 'emergency';
    } else if (
      metrics.supabaseConnectivity < 0.9 || 
      metrics.authSuccessRate < 0.95 ||
      metrics.averageResponseTime > 2000
    ) {
      status = 'degraded';
    }
    
    // Identify issues
    if (metrics.supabaseConnectivity < 0.9) {
      recentIssues.push(`Supabase connectivity: ${(metrics.supabaseConnectivity * 100).toFixed(1)}%`);
      recommendations.push('Check Supabase service status and network connectivity');
    }
    
    if (metrics.authSuccessRate < 0.95) {
      recentIssues.push(`Authentication success rate: ${(metrics.authSuccessRate * 100).toFixed(1)}%`);
      recommendations.push('Review authentication error logs and user credential issues');
    }
    
    if (metrics.averageResponseTime > 2000) {
      recentIssues.push(`High response times: ${metrics.averageResponseTime.toFixed(0)}ms average`);
      recommendations.push('Investigate database performance and network latency');
    }
    
    if (metrics.consecutiveFailures > 3) {
      recentIssues.push(`${metrics.consecutiveFailures} consecutive failures`);
      recommendations.push('Check system logs and consider emergency access');
    }
    
    // Add error details
    Object.entries(metrics.errorCounts).forEach(([error, count]) => {
      if (count > 2) {
        recentIssues.push(`Frequent error: "${error}" (${count} times)`);
      }
    });
    
    return {
      status,
      emergencyModeRecommended,
      metrics,
      recentIssues,
      recommendations
    };
  }

  /**
   * Start automated health monitoring
   */
  static startHealthMonitoring(intervalMs: number = 30000): void {
    console.log('[Health] Starting automated health monitoring');
    
    const performHealthCheck = async () => {
      const supabaseHealth = await this.testSupabaseHealth();
      this.recordHealthCheck(supabaseHealth);
      
      const status = this.getSystemStatus();
      if (status.emergencyModeRecommended) {
        console.warn('[Health] Emergency mode recommended:', status.recentIssues);
      } else if (status.status === 'degraded') {
        console.warn('[Health] System performance degraded:', status.recentIssues);
      }
    };
    
    // Initial check
    performHealthCheck();
    
    // Schedule regular checks
    setInterval(performHealthCheck, intervalMs);
  }

  /**
   * Clear metrics and history (for testing)
   */
  static reset(): void {
    this.healthChecks = [];
    this.metrics = {
      supabaseConnectivity: 1.0,
      authSuccessRate: 1.0,
      averageResponseTime: 0,
      consecutiveFailures: 0,
      lastSuccessfulAuth: new Date().toISOString(),
      totalRequests: 0,
      errorCounts: {}
    };
  }
}