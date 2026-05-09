-- Add profile photos for professionals.
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS photo_url TEXT;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'employee-photos',
  'employee-photos',
  TRUE,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']::TEXT[]
)
ON CONFLICT (id) DO UPDATE
SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "employee_photos_select" ON storage.objects;
DROP POLICY IF EXISTS "employee_photos_insert" ON storage.objects;
DROP POLICY IF EXISTS "employee_photos_update" ON storage.objects;
DROP POLICY IF EXISTS "employee_photos_delete" ON storage.objects;

CREATE POLICY "employee_photos_select"
ON storage.objects FOR SELECT
USING (bucket_id = 'employee-photos');

CREATE POLICY "employee_photos_insert"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'employee-photos' AND auth.role() = 'authenticated');

CREATE POLICY "employee_photos_update"
ON storage.objects FOR UPDATE
USING (bucket_id = 'employee-photos' AND auth.role() = 'authenticated')
WITH CHECK (bucket_id = 'employee-photos' AND auth.role() = 'authenticated');

CREATE POLICY "employee_photos_delete"
ON storage.objects FOR DELETE
USING (bucket_id = 'employee-photos' AND auth.role() = 'authenticated');
