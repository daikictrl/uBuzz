-- Migration: add_media_provider_columns
-- Applied via Supabase MCP on 2026-06-12
-- Purpose: Add optional compatibility columns for Cloudinary migration
-- Existing records default to 'supabase'; new uploads explicitly set 'cloudinary'
-- cloudinary_public_id stores the exact public_id returned by Cloudinary API

-- Videos table: track where video/thumbnail media is hosted
ALTER TABLE public.videos
  ADD COLUMN IF NOT EXISTS media_provider TEXT DEFAULT 'supabase',
  ADD COLUMN IF NOT EXISTS cloudinary_public_id TEXT;

-- Users table: track where avatar is hosted
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS media_provider TEXT DEFAULT 'supabase',
  ADD COLUMN IF NOT EXISTS cloudinary_public_id TEXT;

-- Add comments for documentation
COMMENT ON COLUMN public.videos.media_provider IS 'Media hosting provider: supabase or cloudinary';
COMMENT ON COLUMN public.videos.cloudinary_public_id IS 'Exact public_id returned by Cloudinary API for asset management';
COMMENT ON COLUMN public.users.media_provider IS 'Avatar hosting provider: supabase or cloudinary';
COMMENT ON COLUMN public.users.cloudinary_public_id IS 'Exact public_id returned by Cloudinary API for avatar asset management';
