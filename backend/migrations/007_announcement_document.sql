-- 007_announcement_document.sql
-- Add document support for announcements

ALTER TABLE public.announcements 
ADD COLUMN IF NOT EXISTS document_url TEXT,
ADD COLUMN IF NOT EXISTS document_name TEXT;
