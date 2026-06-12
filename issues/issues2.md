
ALL CONNECTION DETAILS FOR SUPABASE AND CLOUDINARY ARE BOTH FOUND IN THE .env file

========================================================
PHASE 1 — CREATE CLOUDINARY SERVICE LAYER
========================================================

Create a dedicated isolated Cloudinary service.

Preferred structure:

src/
  services/
    cloudinary/
      uploadMedia.ts
      uploadImage.ts
      uploadVideo.ts
      cloudinary.types.ts

Requirements:
- strongly typed
- reusable
- isolated from UI logic
- proper error handling
- upload progress support if possible
- timeout protection
- network failure handling

========================================================
PHASE 2 — IMPLEMENT CLOUDINARY UPLOADS
========================================================

Implement direct unsigned uploads to Cloudinary using fetch + FormData.

Requirements:
- support both image and video uploads
- use resource-type aware endpoints
- image endpoint:
  https://api.cloudinary.com/v1_1/<cloud_name>/image/upload
- video endpoint:
  https://api.cloudinary.com/v1_1/<cloud_name>/video/upload

Use:
- EXPO_PUBLIC_CLOUD_NAME
- EXPO_PUBLIC_PRESET_NAME

DO NOT use API_SECRET on frontend.

========================================================
UPLOAD RESPONSE REQUIREMENTS
========================================================

Extract and return:
- secure_url
- public_id
- format
- resource_type
- bytes
- duration (for videos)
- width
- height


================================================
IMPORTANT
================================================
Additional constraints:

1. DO NOT migrate existing database URLs yet.
2. DO NOT rewrite old Supabase media references.
3. DO NOT remove Supabase Storage support yet.
4. DO NOT use Cloudinary fetch/proxy mode.
5. Existing Supabase-hosted media must continue working unchanged.
6. Only NEW uploads should use Cloudinary.
7. Preserve upload progress tracking behavior.
8. Preserve existing feed rendering behavior.
9. Do NOT modify authentication, realtime, comments, likes, or feed logic.
10. Remove usage of EXPO_PUBLIC_API_SECRET and EXPO_PUBLIC_API_KEY from client-side code because unsigned uploads do not require them.

Focus ONLY on:

* creating the isolated Cloudinary service layer
* implementing Cloudinary upload utilities
* replacing new upload pipelines safely
* ensuring backward compatibility remains intact

This is a presentation-stability-first migration.
