Proceed with a limited optimization completion pass.

The Cloudinary URL transformation utility has already been implemented successfully.

Apply the existing transformation helpers to the remaining Cloudinary media rendering locations.

Files identified:

* ProfileScreen.tsx

  * profile header avatar
  * profile video grid thumbnails

* SearchScreen.tsx

  * search result avatars

* CommentsSheet.tsx

  * comment avatars

Requirements:

* Reuse the existing transformation helpers from urlTransform.ts
* Do NOT create new transformation logic
* Do NOT modify database records
* Do NOT modify upload logic
* Do NOT modify feed architecture
* Do NOT modify navigation
* Do NOT modify comments logic
* Do NOT modify search logic
* Do NOT modify profile logic

Only replace raw Cloudinary URLs with the appropriate existing helper:

* optimizeAvatarUrl(...)
* optimizeThumbnailUrl(...)

Safety requirements:

* Non-Cloudinary URLs must continue to pass through unchanged
* Existing Supabase compatibility must remain intact
* Rendering behavior must remain unchanged
* No visual redesigns
* No state management changes

Before implementation:

1. List each exact line to be modified.
2. Specify which helper will be applied.
3. Confirm no additional files will be changed.

After implementation:

* Provide modified file list
* Provide exact code locations changed
* Confirm TypeScript compilation passes
* Confirm no behavioral changes beyond Cloudinary delivery optimization
