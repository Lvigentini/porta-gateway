import { supabase } from '../lib/supabase';
/**
 * ARCA Authentication Service
 * Integrates Supabase Auth with custom user management
 * Based on proven working ARCA implementation
 */
export class AuthService {
    static currentUser = null;
    static authListeners = [];
    /**
     * Initialize the auth service and check for existing session
     */
    static async initialize() {
        if (!supabase) {
            console.warn('Supabase not configured - authentication required');
            return null; // Force login instead of mock authentication
        }
        try {
            // Get current session
            const { data: { session }, error } = await supabase.auth.getSession();
            if (error) {
                console.warn('Auth session error:', error);
                return null;
            }
            if (session?.user) {
                const user = await this.fetchUserProfile(session.user.id);
                this.setCurrentUser(user);
                return user;
            }
            return null;
        }
        catch (error) {
            console.error('Auth initialization error:', error);
            return null;
        }
    }
    /**
     * Register a new user
     */
    static async register(data) {
        if (!supabase) {
            return {
                user: null,
                error: 'Database not configured - registration not available',
                success: false
            };
        }
        try {
            // Create auth user
            const { data: authData, error: authError } = await supabase.auth.signUp({
                email: data.email,
                password: data.password,
            });
            if (authError) {
                return {
                    user: null,
                    error: authError.message,
                    success: false
                };
            }
            if (!authData.user) {
                return {
                    user: null,
                    error: 'Failed to create user account',
                    success: false
                };
            }
            // Create user profile
            const userProfile = {
                id: authData.user.id,
                email: data.email,
                role: data.requestedRole === 'reviewer' ? 'viewer' : 'viewer', // Start as viewer
                profile: {
                    firstName: data.profile.firstName || '',
                    lastName: data.profile.lastName || '',
                    title: data.profile.title,
                    institution: data.profile.institution,
                    department: data.profile.department,
                    bio: data.profile.bio,
                    website: data.profile.website,
                    orcidId: data.profile.orcidId,
                    expertiseAreas: data.profile.expertiseAreas || []
                },
                qualityScore: 0,
                contributionCount: 0,
                reviewCount: 0,
                isActive: true,
                emailVerified: false,
                roleRequestStatus: data.requestedRole && data.requestedRole !== 'viewer' ? 'pending' : 'none',
                roleRequested: data.requestedRole !== 'viewer' ? data.requestedRole : undefined,
            };
            // Insert user profile
            const { data: dbUser, error: dbError } = await supabase
                .from('users')
                .insert([{
                    id: authData.user.id,
                    email: data.email,
                    role: userProfile.role,
                    first_name: userProfile.profile?.firstName,
                    last_name: userProfile.profile?.lastName,
                    title: userProfile.profile?.title,
                    institution: userProfile.profile?.institution,
                    department: userProfile.profile?.department,
                    bio: userProfile.profile?.bio,
                    website: userProfile.profile?.website,
                    orcid_id: userProfile.profile?.orcidId,
                    expertise_areas: userProfile.profile?.expertiseAreas,
                    role_request_status: userProfile.roleRequestStatus,
                    role_requested: userProfile.roleRequested,
                    role_request_date: userProfile.roleRequested ? new Date().toISOString() : null
                }])
                .select()
                .single();
            if (dbError) {
                console.error('Failed to create user profile:', dbError);
                // Clean up auth user if profile creation failed
                await supabase.auth.signOut();
                return {
                    user: null,
                    error: `Failed to create user profile: ${dbError.message}`,
                    success: false
                };
            }
            // Create default permissions for new user
            await this.createDefaultPermissions(authData.user.id, userProfile.role || 'viewer');
            // Log registration activity
            await this.logActivity(authData.user.id, 'user_registered', 'user', authData.user.id);
            const newUser = this.mapDatabaseUserToARCAUser(dbUser);
            this.setCurrentUser(newUser);
            return {
                user: newUser,
                error: null,
                success: true
            };
        }
        catch (error) {
            console.error('Registration error:', error);
            return {
                user: null,
                error: error instanceof Error ? error.message : 'Registration failed',
                success: false
            };
        }
    }
    /**
     * Login with email and password
     */
    static async login(credentials) {
        if (!supabase) {
            return {
                user: null,
                error: 'Database not configured - login not available',
                success: false
            };
        }
        try {
            const { data, error } = await supabase.auth.signInWithPassword({
                email: credentials.email,
                password: credentials.password,
            });
            if (error) {
                return {
                    user: null,
                    error: error.message,
                    success: false
                };
            }
            if (!data.user) {
                return {
                    user: null,
                    error: 'Login failed',
                    success: false
                };
            }
            // Fetch full user profile
            const user = await this.fetchUserProfile(data.user.id);
            if (!user) {
                return {
                    user: null,
                    error: 'User profile not found',
                    success: false
                };
            }
            // Update last login
            await this.updateLastLogin(user.id);
            // Log login activity
            await this.logActivity(user.id, 'user_login', 'user', user.id);
            this.setCurrentUser(user);
            return {
                user,
                error: null,
                success: true
            };
        }
        catch (error) {
            console.error('Login error:', error);
            return {
                user: null,
                error: error instanceof Error ? error.message : 'Login failed',
                success: false
            };
        }
    }
    /**
     * Logout current user
     */
    static async logout() {
        if (!supabase) {
            this.setCurrentUser(null);
            return { success: true };
        }
        try {
            const currentUser = this.getCurrentUser();
            const { error } = await supabase.auth.signOut();
            if (error) {
                return { success: false, error: error.message };
            }
            // Log logout activity
            if (currentUser) {
                await this.logActivity(currentUser.id, 'user_logout', 'user', currentUser.id);
            }
            this.setCurrentUser(null);
            return { success: true };
        }
        catch (error) {
            console.error('Logout error:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Logout failed'
            };
        }
    }
    /**
     * Get current authenticated user
     */
    static getCurrentUser() {
        return this.currentUser;
    }
    /**
     * Check if user is authenticated
     */
    static isAuthenticated() {
        return this.currentUser !== null;
    }
    /**
     * Check if user has specific role
     */
    static hasRole(role) {
        const user = this.getCurrentUser();
        return user?.role === role;
    }
    /**
     * Check if user has minimum role level
     */
    static hasMinimumRole(minRole) {
        const user = this.getCurrentUser();
        if (!user)
            return false;
        const roleHierarchy = {
            'viewer': 1,
            'reviewer': 2,
            'editor': 3,
            'admin': 4
        };
        return roleHierarchy[user.role] >= roleHierarchy[minRole];
    }
    /**
     * Update user profile
     */
    static async updateProfile(updates) {
        const currentUser = this.getCurrentUser();
        if (!currentUser || !supabase) {
            return {
                user: currentUser,
                error: 'Not authenticated or Supabase not configured',
                success: false
            };
        }
        try {
            const { data, error } = await supabase
                .from('users')
                .update({
                first_name: updates.firstName,
                last_name: updates.lastName,
                title: updates.title,
                institution: updates.institution,
                department: updates.department,
                bio: updates.bio,
                website: updates.website,
                orcid_id: updates.orcidId,
                expertise_areas: updates.expertiseAreas,
                updated_at: new Date().toISOString()
            })
                .eq('id', currentUser.id)
                .select()
                .single();
            if (error) {
                return {
                    user: currentUser,
                    error: error.message,
                    success: false
                };
            }
            const updatedUser = this.mapDatabaseUserToARCAUser(data);
            this.setCurrentUser(updatedUser);
            // Log profile update
            await this.logActivity(currentUser.id, 'profile_updated', 'user', currentUser.id);
            return {
                user: updatedUser,
                error: null,
                success: true
            };
        }
        catch (error) {
            console.error('Profile update error:', error);
            return {
                user: currentUser,
                error: error instanceof Error ? error.message : 'Profile update failed',
                success: false
            };
        }
    }
    /**
     * Request role change
     */
    static async requestRoleChange(requestedRole, reason, supportingEvidence) {
        const currentUser = this.getCurrentUser();
        if (!currentUser || !supabase) {
            return { success: false, error: 'Not authenticated' };
        }
        try {
            // Insert role request
            const { error: requestError } = await supabase
                .from('role_requests')
                .insert([{
                    user_id: currentUser.id,
                    user_current_role: currentUser.role,
                    requested_role: requestedRole,
                    reason,
                    supporting_evidence: supportingEvidence,
                    status: 'pending'
                }]);
            if (requestError) {
                return { success: false, error: requestError.message };
            }
            // Update user record
            const { error: updateError } = await supabase
                .from('users')
                .update({
                role_request_status: 'pending',
                role_requested: requestedRole,
                role_request_date: new Date().toISOString()
            })
                .eq('id', currentUser.id);
            if (updateError) {
                return { success: false, error: updateError.message };
            }
            // Log activity
            await this.logActivity(currentUser.id, 'role_change_requested', 'user', currentUser.id, { requested_role: requestedRole, reason });
            // Update current user state
            const updatedUser = {
                ...currentUser,
                roleRequestStatus: 'pending',
                roleRequested: requestedRole
            };
            this.setCurrentUser(updatedUser);
            return { success: true };
        }
        catch (error) {
            console.error('Role request error:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Role request failed'
            };
        }
    }
    /**
     * Add auth state listener
     */
    static addAuthListener(callback) {
        this.authListeners.push(callback);
        // Return unsubscribe function
        return () => {
            const index = this.authListeners.indexOf(callback);
            if (index > -1) {
                this.authListeners.splice(index, 1);
            }
        };
    }
    // Private helper methods
    static setCurrentUser(user) {
        this.currentUser = user;
        this.authListeners.forEach(listener => listener(user));
    }
    static async fetchUserProfile(userId) {
        if (!supabase)
            return null;
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
            return this.mapDatabaseUserToARCAUser(data);
        }
        catch (error) {
            console.error('Error fetching user profile:', error);
            return null;
        }
    }
    static mapDatabaseUserToARCAUser(dbUser) {
        return {
            id: dbUser.id,
            email: dbUser.email,
            role: dbUser.role,
            profile: {
                firstName: dbUser.first_name || '',
                lastName: dbUser.last_name || '',
                title: dbUser.title,
                institution: dbUser.institution,
                department: dbUser.department,
                bio: dbUser.bio,
                website: dbUser.website,
                orcidId: dbUser.orcid_id,
                expertiseAreas: dbUser.expertise_areas || []
            },
            qualityScore: dbUser.quality_score || 0,
            contributionCount: dbUser.contribution_count || 0,
            reviewCount: dbUser.review_count || 0,
            isActive: dbUser.is_active,
            emailVerified: dbUser.email_verified,
            roleRequestStatus: dbUser.role_request_status || 'none',
            roleRequested: dbUser.role_requested,
            createdAt: dbUser.created_at,
            updatedAt: dbUser.updated_at,
            lastLoginAt: dbUser.last_login_at
        };
    }
    static async createDefaultPermissions(userId, role) {
        if (!supabase)
            return;
        const defaultPermissions = this.getDefaultPermissionsForRole(role);
        try {
            const { error } = await supabase
                .from('user_permissions')
                .insert(defaultPermissions.map(perm => ({
                user_id: userId,
                resource_type: perm.resource,
                actions: perm.actions,
                conditions: perm.conditions || {},
                cost_limits: perm.costLimits || {}
            })));
            if (error) {
                console.error('Failed to create default permissions:', error);
            }
        }
        catch (error) {
            console.error('Error creating default permissions:', error);
        }
    }
    static getDefaultPermissionsForRole(role) {
        const basePermissions = [
            { resource: 'resources', actions: ['read'] },
        ];
        switch (role) {
            case 'reviewer':
                return [
                    ...basePermissions,
                    { resource: 'analytics', actions: ['view_basic'] },
                    { resource: 'llm', actions: ['basic_analysis'], costLimits: { dailyLlmTokens: 1000 } },
                    { resource: 'quality_reviews', actions: ['create', 'read'] }
                ];
            case 'editor':
                return [
                    ...basePermissions,
                    { resource: 'analytics', actions: ['view_basic', 'view_advanced'] },
                    { resource: 'llm', actions: ['basic_analysis', 'advanced_analysis', 'debug'], costLimits: { dailyLlmTokens: 5000 } },
                    { resource: 'quality_reviews', actions: ['create', 'read', 'update'] },
                    { resource: 'resources', actions: ['read', 'create', 'update'], conditions: { owner_only: true } },
                    { resource: 'media', actions: ['upload'], costLimits: { monthlyStorageMb: 1000 } }
                ];
            case 'admin':
                return [
                    { resource: '*', actions: ['*'] }, // Full access
                ];
            default: // viewer
                return basePermissions;
        }
    }
    static async updateLastLogin(userId) {
        if (!supabase)
            return;
        try {
            await supabase.rpc('update_user_last_login', { user_uuid: userId });
        }
        catch (error) {
            console.error('Failed to update last login:', error);
        }
    }
    static async logActivity(userId, action, resourceType, resourceId, metadata) {
        if (!supabase)
            return;
        try {
            await supabase.rpc('log_user_activity', {
                user_uuid: userId,
                action_name: action,
                resource_type_name: resourceType,
                resource_uuid: resourceId,
                metadata_obj: metadata || {}
            });
        }
        catch (error) {
            console.error('Failed to log activity:', error);
        }
    }
    /**
     * Health check
     */
    static async getHealth() {
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
        }
        catch (error) {
            return {
                status: 'unhealthy - connection failed',
                timestamp: new Date().toISOString()
            };
        }
    }
}
// Set up auth state listener
if (supabase) {
    supabase.auth.onAuthStateChange((event, session) => {
        console.log('Supabase auth state change:', event, session);
        if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
            AuthService.initialize(); // Re-initialize to fetch full profile
        }
        else if (event === 'SIGNED_OUT') {
            AuthService.logout(); // Clear current user
        }
    });
}
