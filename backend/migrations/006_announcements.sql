-- 006_announcements.sql
-- Add is_admin flag to public.users and create the announcements table

-- 1. Add is_admin column to users table
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT false;

-- 2. Create announcements table
CREATE TABLE IF NOT EXISTS public.announcements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  image_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Enable RLS on announcements table
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

-- 4. Create RLS Policies for announcements
-- SELECT policy: Authenticated users can view announcements
CREATE POLICY announcements_select_authenticated ON public.announcements
  FOR SELECT TO authenticated USING (true);

-- INSERT policy: Only authenticated admins can create announcements
CREATE POLICY announcements_insert_admin ON public.announcements
  FOR INSERT TO authenticated 
  WITH CHECK (
    auth.uid() = user_id AND 
    (SELECT is_admin FROM public.users WHERE id = auth.uid()) = true
  );

-- DELETE policy: Only authenticated admins can delete announcements
CREATE POLICY announcements_delete_admin ON public.announcements
  FOR DELETE TO authenticated 
  USING (
    auth.uid() = user_id AND 
    (SELECT is_admin FROM public.users WHERE id = auth.uid()) = true
  );

-- 5. Seed the admin user using pgcrypto extension for password encryption
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Insert into auth.users (if not already exists)
INSERT INTO auth.users (
  id,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  role,
  aud
) VALUES (
  'd8a87b32-6789-4b68-8f51-6d9b3a0f7811',
  'ambomo@iuget.edu.com',
  crypt('11223344', gen_salt('bf', 10)),
  now(),
  '{"provider": "email", "providers": ["email"]}',
  '{"username": "ambomo", "matricule": "IU0000"}',
  'authenticated',
  'authenticated'
) ON CONFLICT (id) DO NOTHING;

-- Explicitly ensure public.users has the admin record and is_admin is true
INSERT INTO public.users (
  id,
  email,
  username,
  matricule,
  is_admin
) VALUES (
  'd8a87b32-6789-4b68-8f51-6d9b3a0f7811',
  'ambomo@iuget.edu.com',
  'ambomo',
  'IU0000',
  true
) ON CONFLICT (id) DO UPDATE SET is_admin = true;
