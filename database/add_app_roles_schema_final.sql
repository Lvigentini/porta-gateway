-- Migration: Add app roles and permissions schema (FINAL VERSION)
-- Run this AFTER the initial registered_apps table creation
-- This version fixes the foreign key constraint issue

-- Create app_roles table for defining available roles per app
CREATE TABLE IF NOT EXISTS app_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  app_name VARCHAR(50) NOT NULL REFERENCES registered_apps(app_name) ON DELETE CASCADE,
  role_name VARCHAR(50) NOT NULL,
  role_label VARCHAR(100) NOT NULL, -- Human-readable label like "Administrator", "Editor", "Viewer"
  permissions JSONB DEFAULT '{}',   -- Role-specific permissions
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Unique constraint per app
  UNIQUE(app_name, role_name),
  UNIQUE(app_name, role_label)
);

-- Create user_app_roles table for assigning roles to users per app
CREATE TABLE IF NOT EXISTS user_app_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  app_name VARCHAR(50) NOT NULL REFERENCES registered_apps(app_name) ON DELETE CASCADE,
  role_name VARCHAR(50) NOT NULL,
  granted_by UUID REFERENCES users(id),
  granted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE, -- Optional role expiry
  is_active BOOLEAN DEFAULT true,
  
  -- Foreign key to app_roles
  FOREIGN KEY (app_name, role_name) REFERENCES app_roles(app_name, role_name) ON DELETE CASCADE,
  
  -- One role per user per app (can be changed by updating, not adding multiple)
  UNIQUE(user_id, app_name)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_app_roles_app_name ON app_roles(app_name);
CREATE INDEX IF NOT EXISTS idx_app_roles_role_name ON app_roles(role_name);
CREATE INDEX IF NOT EXISTS idx_user_app_roles_user_id ON user_app_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_app_roles_app_name ON user_app_roles(app_name);
CREATE INDEX IF NOT EXISTS idx_user_app_roles_active ON user_app_roles(is_active) WHERE is_active = true;

-- Create updated_at trigger for app_roles (reuse existing trigger function)
DROP TRIGGER IF EXISTS update_app_roles_updated_at ON app_roles;
CREATE TRIGGER update_app_roles_updated_at
    BEFORE UPDATE ON app_roles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security for new tables only
ALTER TABLE app_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_app_roles ENABLE ROW LEVEL SECURITY;

-- Create policies for app_roles (new table, no conflicts)
CREATE POLICY "Allow reading app roles" ON app_roles
    FOR SELECT USING (true);

CREATE POLICY "Allow admin operations on app roles" ON app_roles
    FOR ALL USING (true);

-- Create policies for user_app_roles (new table, no conflicts)  
CREATE POLICY "Allow reading user app roles" ON user_app_roles
    FOR SELECT USING (true);

CREATE POLICY "Allow admin operations on user app roles" ON user_app_roles
    FOR ALL USING (true);

-- Grant permissions for new tables
GRANT SELECT, INSERT, UPDATE, DELETE ON app_roles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON app_roles TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON user_app_roles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON user_app_roles TO anon;

-- Add documentation comments
COMMENT ON TABLE app_roles IS 'Defines available roles for each registered application';
COMMENT ON TABLE user_app_roles IS 'Assigns roles to users for specific applications';

COMMENT ON COLUMN app_roles.app_name IS 'Reference to registered app';
COMMENT ON COLUMN app_roles.role_name IS 'Technical role name (e.g., "admin", "editor", "viewer")';
COMMENT ON COLUMN app_roles.role_label IS 'Human-readable role name (e.g., "Administrator", "Editor", "Viewer")';
COMMENT ON COLUMN app_roles.permissions IS 'JSON object defining what this role can do';

COMMENT ON COLUMN user_app_roles.user_id IS 'Reference to user who has the role';
COMMENT ON COLUMN user_app_roles.app_name IS 'App where user has this role';
COMMENT ON COLUMN user_app_roles.role_name IS 'Role assigned to user';
COMMENT ON COLUMN user_app_roles.expires_at IS 'When this role assignment expires (optional)';

-- Show the created schema
SELECT 
  table_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns 
WHERE table_name IN ('app_roles', 'user_app_roles')
ORDER BY table_name, ordinal_position;

-- Show existing registered apps for reference
SELECT app_name, app_display_name, status, created_at 
FROM registered_apps 
ORDER BY created_at;