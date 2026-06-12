Perform a complete Supabase Storage dependency audit.

The Cloudinary migration has been completed.

However, Supabase Cached Egress is still increasing.

Search the entire codebase for any remaining references to:

* supabase.storage
* storage/v1
* storage.googleapis
* getPublicUrl
* createSignedUrl
* createSignedUrls
* download(
* upload(
* bucket names:

  * videos
  * thumbnails
  * avatars

Also inspect:

* comments
* search
* profile
* feed
* notifications
* user records
* cached queries
* React Query caches
* AsyncStorage
* persisted state

Goal:

Identify every possible path that could still cause a client device to request media from Supabase Storage.

Generate a report only.

Do NOT modify code.

For every finding provide:

* file
* line number
* media type
* whether it can generate Storage egress
* confidence level

If no code references remain, identify other possible non-code causes of Storage egress.
