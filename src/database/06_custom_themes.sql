-- Add theme customization fields to organizations table
ALTER TABLE organizations
ADD COLUMN IF NOT EXISTS primary_color TEXT DEFAULT '#3b82f6',
ADD COLUMN IF NOT EXISTS secondary_color TEXT DEFAULT '#8b5cf6',
ADD COLUMN IF NOT EXISTS accent_color TEXT DEFAULT '#10b981',
ADD COLUMN IF NOT EXISTS logo_url TEXT;

-- Add comment
COMMENT ON COLUMN organizations.primary_color IS 'Primary brand color (hex format)';
COMMENT ON COLUMN organizations.secondary_color IS 'Secondary brand color (hex format)';
COMMENT ON COLUMN organizations.accent_color IS 'Accent color for highlights (hex format)';
COMMENT ON COLUMN organizations.logo_url IS 'URL to organization logo';
