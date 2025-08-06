-- Migration: Create registered_apps table for centralized app management
-- Run this in your Supabase SQL editor

-- Create the registered_apps table
CREATE TABLE IF NOT EXISTS registered_apps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  app_name VARCHAR(50) UNIQUE NOT NULL,
  app_display_name VARCHAR(100) NOT NULL,
  app_secret VARCHAR(128) NOT NULL,
  allowed_origins TEXT[] DEFAULT '{}',
  redirect_urls TEXT[] DEFAULT '{}',
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'disabled', 'pending')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES users(id),
  secret_expires_at TIMESTAMP WITH TIME ZONE,
  permissions JSONB DEFAULT '{}',
  metadata JSONB DEFAULT '{}'
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_registered_apps_name ON registered_apps(app_name);
CREATE INDEX IF NOT EXISTS idx_registered_apps_status ON registered_apps(status);
CREATE INDEX IF NOT EXISTS idx_registered_apps_created_at ON registered_apps(created_at DESC);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to auto-update updated_at
DROP TRIGGER IF EXISTS update_registered_apps_updated_at ON registered_apps;
CREATE TRIGGER update_registered_apps_updated_at
    BEFORE UPDATE ON registered_apps
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security
ALTER TABLE registered_apps ENABLE ROW LEVEL SECURITY;

-- Create policy for reading apps (allow authenticated users to read active apps)
CREATE POLICY "Allow reading active apps" ON registered_apps
    FOR SELECT USING (status = 'active');

-- Create policy for admin operations (for now, allow all authenticated users)
-- TODO: Restrict this to actual admin users once role system is in place
CREATE POLICY "Allow admin operations" ON registered_apps
    FOR ALL USING (true);

-- Grant necessary permissions
GRANT SELECT, INSERT, UPDATE ON registered_apps TO authenticated;
GRANT SELECT, INSERT, UPDATE ON registered_apps TO anon;

-- Add comments for documentation
COMMENT ON TABLE registered_apps IS 'Centralized registry for applications that can authenticate with porta-gateway';
COMMENT ON COLUMN registered_apps.app_name IS 'Unique identifier for the app (e.g., "arca", "cdtoolkit")';
COMMENT ON COLUMN registered_apps.app_display_name IS 'Human-readable name for the app';
COMMENT ON COLUMN registered_apps.app_secret IS 'Secret key used for app authentication';
COMMENT ON COLUMN registered_apps.allowed_origins IS 'Array of allowed CORS origins for this app';
COMMENT ON COLUMN registered_apps.redirect_urls IS 'Array of allowed redirect URLs after authentication';
COMMENT ON COLUMN registered_apps.status IS 'App status: active, disabled, or pending';
COMMENT ON COLUMN registered_apps.secret_expires_at IS 'When the current app secret expires (optional)';
COMMENT ON COLUMN registered_apps.permissions IS 'App-specific permissions as JSON object';
COMMENT ON COLUMN registered_apps.metadata IS 'Additional app configuration and metadata';

-- Insert sample data (optional - can be done via API instead)
-- Uncomment to automatically migrate existing ARCA configuration

/*
-- Auto-migrate ARCA if environment variable exists
-- This would normally be done via the migration endpoint
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
  'arca',
  'ARCA Analytics',
  'YOUR_EXISTING_ARCA_SECRET_HERE', -- Replace with actual VITE_ARCA_APP_SECRET value
  ARRAY['https://arca-alpha.vercel.app'],
  ARRAY['https://arca-alpha.vercel.app'],
  'active',
  '{}',
  '{"migrated_from": "environment", "migration_date": "2025-08-06T16:00:00.000Z"}',
  NOW() + INTERVAL '90 days'
) ON CONFLICT (app_name) DO NOTHING;
*/

-- Show created table structure
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'registered_apps' 
ORDER BY ordinal_position;