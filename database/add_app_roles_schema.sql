-- Migration: Add app roles and permissions schema
-- Run this after the initial registered_apps table creation

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

-- Create updated_at trigger for app_roles
CREATE TRIGGER update_app_roles_updated_at
    BEFORE UPDATE ON app_roles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security
ALTER TABLE app_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_app_roles ENABLE ROW LEVEL SECURITY;

-- Policies for app_roles
CREATE POLICY "Allow reading app roles" ON app_roles
    FOR SELECT USING (true); -- Allow reading all roles for now

CREATE POLICY "Allow admin operations on app roles" ON app_roles
    FOR ALL USING (true); -- Restrict to admins in application logic

-- Policies for user_app_roles
CREATE POLICY "Allow reading user app roles" ON user_app_roles
    FOR SELECT USING (true); -- Allow reading for now, restrict in app logic

CREATE POLICY "Allow admin operations on user app roles" ON user_app_roles
    FOR ALL USING (true); -- Restrict to admins in application logic

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON app_roles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON app_roles TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON user_app_roles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON user_app_roles TO anon;

-- Add comments
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

-- Insert default role definitions for system-wide use
-- These are the three standard roles mentioned: Admin, Edit, View

-- Note: Apps can have their own role names, but these are the standard labels
INSERT INTO app_roles (app_name, role_name, role_label, permissions) VALUES
-- Default roles that can be used by any app
('_system', 'admin', 'Admin', '{"manage_users": true, "manage_apps": true, "manage_roles": true, "full_access": true}'),
('_system', 'edit', 'Edit', '{"create": true, "read": true, "update": true, "delete": true}'),
('_system', 'view', 'View', '{"read": true}')
ON CONFLICT (app_name, role_name) DO NOTHING;

-- Example: Create CDToolkit app with administrator and editor roles
-- Uncomment and modify as needed for your CDToolkit setup

/*
-- First register the CDToolkit app (replace with actual values)
INSERT INTO registered_apps (
  app_name,
  app_display_name,
  app_secret,
  allowed_origins,
  redirect_urls,
  status,
  permissions,
  metadata,
  secret_expires_at
) VALUES (
  'cdtoolkit',
  'CD Toolkit',
  'GENERATED_SECRET_REPLACE_WITH_ACTUAL_SECRET_FROM_ADMIN_UI', -- Use admin UI to generate
  ARRAY['https://cdtoolkit.example.com', 'https://cdtoolkit-dev.example.com'],
  ARRAY['https://cdtoolkit.example.com', 'https://cdtoolkit-dev.example.com'],
  'active',
  '{}',
  '{"created_via": "migration", "example": true}',
  NOW() + INTERVAL '90 days'
) ON CONFLICT (app_name) DO NOTHING;

-- Then create CDToolkit-specific roles
INSERT INTO app_roles (app_name, role_name, role_label, permissions) VALUES
('cdtoolkit', 'administrator', 'Administrator', '{"manage_users": true, "manage_content": true, "manage_settings": true, "full_access": true}'),
('cdtoolkit', 'editor', 'Editor', '{"create_content": true, "edit_content": true, "delete_content": true, "view_analytics": true}'),
('cdtoolkit', 'viewer', 'Viewer', '{"view_content": true, "view_basic_analytics": true}')
ON CONFLICT (app_name, role_name) DO NOTHING;
*/

-- Show the created schema
SELECT 
  table_name,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name IN ('app_roles', 'user_app_roles')
ORDER BY table_name, ordinal_position;