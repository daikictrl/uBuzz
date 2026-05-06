-- Create buckets (videos, thumbnails, avatars) - all public
INSERT INTO storage.buckets (id, name, public) 
VALUES 
  ('videos', 'videos', true),
  ('thumbnails', 'thumbnails', true),
  ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;


-- Select policies for public read access
CREATE POLICY "Public Access videos" ON storage.objects
  FOR SELECT USING (bucket_id = 'videos');

CREATE POLICY "Public Access thumbnails" ON storage.objects
  FOR SELECT USING (bucket_id = 'thumbnails');

CREATE POLICY "Public Access avatars" ON storage.objects
  FOR SELECT USING (bucket_id = 'avatars');

-- Insert policies: users can upload to their own folder only
CREATE POLICY "Authenticated users can upload to their own folder in videos" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (
    bucket_id = 'videos' AND 
    (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Authenticated users can upload to their own folder in thumbnails" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (
    bucket_id = 'thumbnails' AND 
    (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Authenticated users can upload to their own folder in avatars" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (
    bucket_id = 'avatars' AND 
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- Delete policies: users can delete from their own folder only
CREATE POLICY "Authenticated users can delete their own files in videos" ON storage.objects
  FOR DELETE TO authenticated USING (
    bucket_id = 'videos' AND 
    (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Authenticated users can delete their own files in thumbnails" ON storage.objects
  FOR DELETE TO authenticated USING (
    bucket_id = 'thumbnails' AND 
    (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Authenticated users can delete their own files in avatars" ON storage.objects
  FOR DELETE TO authenticated USING (
    bucket_id = 'avatars' AND 
    (storage.foldername(name))[1] = auth.uid()::text
  );
