========================================================
PHASE 4 — DATABASE INTEGRATION
========================================================

DO NOT redesign database architecture.

ONLY add safe optional compatibility fields if needed.

Preferred additions:

media_provider
cloudinary_public_id

Default existing posts from:
media_provider = 'supabase'

New uploads:
media_provider = 'cloudinary'

DO NOT break existing queries.

========================================================
PHASE 5 — PRESERVE BACKWARD COMPATIBILITY
========================================================

The app MUST continue rendering:
- old Supabase media URLs
- new Cloudinary media URLs

WITHOUT requiring migration of old posts.

Rendering components should remain source-agnostic.

Example:
- Image component should render any valid URL
- Video player should render any valid URL

NO hardcoded provider assumptions.

========================================================
PHASE 6 — REPLACE ONLY NEW UPLOAD FLOW
========================================================

Modify ONLY the upload pipeline.

Current behavior:
User upload → Supabase Storage

New behavior:
User upload → Cloudinary
Metadata → Supabase database

DO NOT change:
- feed logic
- likes
- comments
- profile system
- notifications
- realtime
- auth flow


Current status:

* Cloudinary upload service is implemented.
* New video uploads successfully reach Cloudinary.
* New thumbnail uploads successfully reach Cloudinary.
* New avatar uploads successfully reach Cloudinary.
* Cloudinary URLs are being stored successfully.
* Existing Supabase-hosted media continues working.

Requirements:

1. Verify that all database writes now use Cloudinary URLs for new uploads.

2. Add optional compatibility metadata only if truly necessary:

   * media_provider
   * cloudinary_public_id

3. Existing records must remain untouched.

4. Existing Supabase URLs must continue rendering normally.

5. New Cloudinary URLs must continue rendering normally.

6. Rendering components must remain source-agnostic and work with either provider.

7. Remove any remaining upload-path dependencies that assume Supabase Storage is the destination for new uploads.

8. Do NOT migrate existing database URLs.

9. Do NOT perform bulk URL rewrites.

10. Do NOT remove Supabase Storage support yet.

11. Do NOT modify:

    * authentication
    * realtime
    * comments
    * likes
    * feed logic
    * notification system

12. Generate a report showing:

    * files modified
    * database changes
    * compatibility strategy
    * remaining Supabase Storage dependencies

Presentation stability remains the highest priority.
