# U-Buzz — Progress Tracker

## Current Status

**Active Phase:** Phase 7 — Polish + Production Hardening [DONE]
**Last Updated:** 2026-05-21
**MVP Status:** READY FOR PRODUCTION ✓

---

## Phase Completion Status

### [DONE] Phase 1 — Project Scaffold + Supabase Setup + Auth Screen

Completed items:
- [DONE] Supabase tables created (all 6: users, videos, likes,
         comments, follows, reports)
- [DONE] RLS policies applied to all tables
- [DONE] Storage buckets created (videos, thumbnails, avatars)
- [DONE] SQL migration files generated (001, 002, 003)
- [DONE] backend/README.md created
- [DONE] Expo project initialized inside frontend/
- [DONE] Dependencies installed
- [DONE] supabase/client.ts created
- [DONE] src/lib/validation.ts created
- [DONE] src/navigation/RootNavigator.tsx created
- [DONE] src/screens/AuthScreen.tsx created (Sign Up + Login)
- [DONE] Placeholder screens created (Home, Upload, Search, Profile)
- [DONE] Session persistence working (App.tsx)
- [DONE] App launches and shows feed after login ✓

---

### [DONE] Phase 2 — Home Feed (Vertical Video Scroll)

Completed items:
- [DONE] src/hooks/useFeed.ts created
- [DONE] src/hooks/useLike.ts created
- [DONE] src/components/VideoCard.tsx created
- [DONE] src/screens/HomeScreen.tsx created
- [DONE] For You / Following tabs rendering ✓
- [DONE] Empty state showing correctly ✓
- [DONE] Bottom tab bar with 4 tabs rendering ✓
- [DONE] Upload + button visible and raised ✓
- [DONE] App color: purple accent (#8B5CF6) established ✓

Notes:
- Feed is not empty (it has 3 videos)
- Following tab empty (expected — no follows yet)
- Comment button wired but CommentsSheet not built until Phase 4
- Report option wired but ReportSheet not built until Phase 7

---

### [DONE] Phase 3 — Upload Screen

Completed items:
- [DONE] src/screens/UploadScreen.tsx created
- [DONE] Caption input with character counter
- [DONE] Post button and upload flow structure
- [DONE] Media picker permissions fixed (expo-image-picker)
- [DONE] Upload via expo-file-system/legacy createUploadTask
- [DONE] Supabase handle_new_user trigger repaired (FK constraint fix)
- [DONE] Video row inserts correctly into Supabase videos table
- [DONE] Pre-upload profile verification safety checks & auto-recovery (blocks constraints, prevents data wasting)
- [DONE] Translated raw DB constraints to user-friendly alert messages

Notes:
- Upload uses legacy FileSystem API; migrate when scope allows
- Rate limiting (5/hr) and 50MB file size check are validated server-side
- Added pre-upload validation to check user profile status before initiating file transfers

---

### [DONE] Phase 4 — Comments Bottom Sheet

Completed items:
- [DONE] src/components/CommentsSheet.tsx (Rebuilt from scratch)
- [DONE] Modal-based sheet with animated slide-up/down
- [DONE] Flicker-free keyboard handling (keyboardDidShow/Hide listeners,
         dual translateY transforms — NO KeyboardAvoidingView)
- [DONE] Platform-aware keyboard offset (iOS only, Android uses adjustResize)
- [DONE] Sheet height stays fixed at 65% of visible space when keyboard opens
- [DONE] Fetch all comments per videoId on open
- [DONE] Realtime INSERT subscription per videoId (live comment stream)
- [DONE] Realtime DELETE subscription per videoId (live delete sync)
- [DONE] Add comment → keyboard dismisses → comment appears via Realtime
- [DONE] Long press own comment → confirmation dialog → optimistic delete
- [DONE] Long press other user's comment → no action
- [DONE] Optimistic delete: removes comment instantly, decrements counter
- [DONE] Delete rollback: restores comment + count on Supabase failure
- [DONE] Tap avatar/username → navigates to Profile screen
- [DONE] Wire to VideoCard comment button in HomeScreen

#### Comment Count Synchronization Architecture

- [DONE] Global realtime INSERT listener inside useFeed.ts
  → Increments feed comment_count for any new comment, regardless
     of whether CommentsSheet is open
- [DONE] CommentsSheet filtered DELETE listener handles count decrement
  → Supabase Realtime only sends primary key in payload.old for
     DELETE events on unfiltered subscriptions (confirmed via logging),
     so the global handler cannot get video_id. CommentsSheet already
     receives filtered DELETE events with videoId in scope.
- [DONE] useFeed exposes deduplication API (not raw Set):
  - markCommentAsLocallyDeleted(commentId)
  - clearAllLocallyDeletedComments()
  - consumeLocallyDeletedComment(commentId) → boolean  ← NEW
    Atomically checks + removes from set; returns true if local,
    false if external. Used by CommentsSheet DELETE handler.
  - optimisticDeleteCommentCount(videoId)
  - optimisticRestoreCommentCount(videoId)
- [DONE] Double-decrement prevention:
  CommentsSheet marks ID before delete → DELETE handler calls
  consumeLocallyDeletedComment → returns true (local) → skips
  optimisticDeleteCommentCount (already done optimistically)
- [DONE] External delete (dashboard / another device):
  DELETE handler → consumeLocallyDeletedComment returns false
  → calls optimisticDeleteCommentCount(videoId) instantly
- [DONE] Stale ID cleanup: clearAllLocallyDeletedComments() fires
  in the sheet close animation callback (not on button press)
- [DONE] Count never goes below 0 (Math.max(0, count - 1))

---

### [DONE] Phase 5 — Profile Screen

Completed items:
- [DONE] src/hooks/useProfile.ts
- [DONE] src/screens/ProfileScreen.tsx (full implementation)
- [DONE] src/components/EditProfileSheet.tsx
- [DONE] Avatar upload, username edit, bio edit
- [DONE] Video grid with thumbnail cells
- [DONE] Tapping video grid item → opens video with live like/comment counts
- [DONE] Follow/Unfollow button for other profiles
- [DONE] Navigation wiring from VideoCard → ProfileScreen
- [DONE] Navigation wiring from CommentsSheet → ProfileScreen
- [DONE] Forgot Password (OTP) flow implemented
- [DONE] RootNavigator.tsx — AuthChangeEvent TOKEN_REFRESH_FAILED cast fixed
- [DONE] Hardened useProfile profile-check: disabled automatic logout on missing profile
- [DONE] Added client-side activeRecoveries map to deduplicate concurrent profile creations
- [DONE] Created premium fallback UI inside ProfileScreen with Force Logout and Retry options

---

### [DONE] Phase 6 — Follows System + Feed Filter

Completed items:
- [DONE] Custom follow state hook `src/hooks/useFollow.ts`
- [DONE] Wired follow/unfollow logic to ProfileScreen
- [DONE] Integrated Following Feed Query and RLS rules
- [DONE] Added request-awareness request sequence to `useFeed.ts` to fix race conditions
- [DONE] Added synchronous state reset on FeedType changes to avoid UI flicker
- [DONE] Wired HomeScreen tabs and multi-state ListEmptyComponent
- [DONE] Implemented Explore For You redirection button on empty following feed

---

### [DONE] Phase 7 — Polish + Production Hardening

Completed items:
- [DONE] Video duration limit removed and size raised to 70MB (Section 1)
- [DONE] 3-column skeleton grid matching profile cells & skeleton card layout (Section 2)
- [DONE] Double-tap to like with heart animation & spam safeguards (Section 3)
- [DONE] Mute/unmute state lifted to parent level for instant AsyncStorage sync, and conditional active video display (Section 4)
- [DONE] In-app notification badge on Profile tab for real-time likes/comments (Section 5)
- [DONE] Fully functional Search Screen with request-ID race safety and result navigation (Section 6)
- [DONE] Security Hardening including inputs sanitization, RLS audit, rates checking (Section 7)
- [DONE] Final navigation audit, upload throttle lock, on-success redirection to AppTabs (Section 8)

---

## Known Issues Log

| Issue | Phase | Status | Notes |
|-------|-------|--------|-------|
| Media picker fails to open | 3 | FIXED | Permissions configured |
| Video open from profile grid crashed app | 5 | FIXED | Navigation stack corrected |
| Like/comment counts stale when opening video from profile | 5 | FIXED | Aggressive re-fetch on open |
| EditProfileSheet — avatar upload error | 5 | FIXED | Storage path + RLS corrected |
| RootNavigator TOKEN_REFRESH_FAILED TS error | 5 | FIXED | Cast to string |
| CommentsSheet blank on open (no input area) | 4 | FIXED | flex:1 + Modal wrapper |
| Keyboard pushed tab bar up (Android double-push) | 4 | FIXED | Platform.OS guard on translateY |
| Comment sheet covered full screen on keyboard open | 4 | FIXED | height: '65%' (dynamic) |
| Comment count not incrementing without refresh | 4 | FIXED | Global realtime listener in useFeed |
| HomeScreen.tsx transient syntax error | 4 | FIXED | Duplicate JSX tag removed |
| Dashboard delete not syncing to app | 4 | FIXED | Realtime DELETE listener added |
| Double-decrement on optimistic + realtime delete | 4 | FIXED | locallyDeletedCommentIds dedup set |
| Realtime DELETE from dashboard doesn't decrement global count | 4 | FIXED | Supabase Realtime unfiltered DELETE only sends PK — moved decrement to CommentsSheet DELETE handler via consumeLocallyDeletedComment |
| Profile row missing triggers auto-signout / crash | 5 | FIXED | Removed automatic sign-out on missing profile; implemented lightweight recovery |
| Parallel useProfile mounts trigger concurrent inserts | 5 | FIXED | Implemented activeRecoveries promise cache map to deduplicate parallel queries |
| Redbox developer overlays on expected network/profile errors | 5 | FIXED | Swapped console.error to console.warn inside catch blocks of useProfile and UploadScreen |
| Technical DB constraint error shown during upload failure | 3 | FIXED | Added friendly UI translation for videos_user_id_fkey constraint messages |
---

## Session Notes

- Video duration cap (60s) to be removed in Phase 7
- File size limit raised to 70MB in Phase 7
- Storage migration to Cloudinary deferred to post-MVP

---

## Architecture Notes

- **Keyboard handling:** Never use KeyboardAvoidingView in any bottom sheet.
  Use keyboardDidShow/Hide listeners + dual translateY transforms only.
  Android: platform guard sets keyboard offset to 0 (adjustResize handles it).
  iOS: apply -keyboardHeight as second translateY.

- **Comment counts:** Derived via COUNT() query only. No comment_count column
  exists in the database schema. Do not add one.

- **useFeed deduplication API:** CommentsSheet calls helper methods exposed
  by useFeed — never owns global deduplication state directly.

- **Realtime subscriptions:**
  - Global: useFeed listens for INSERT only on `comments` table (all videos).
    DELETE is intentionally excluded — Supabase Realtime unfiltered DELETE
    events only include the primary key in payload.old, never video_id.
  - Local: CommentsSheet listens for INSERT + DELETE on `comments` filtered
    by `video_id=eq.${videoId}` (current open video only).
    The DELETE handler owns count decrement for external deletes via
    consumeLocallyDeletedComment dedup check + optimisticDeleteCommentCount.

- **Bilingual UI removed:** All remaining phases use English only.

- **Purple accent color:** #8B5CF6. Keep consistent across all screens.

- **Upload API:** Uses expo-file-system/legacy createUploadTask.
  Migrate to new FileSystem classes when scope allows.

- **Context files:** Every new session must read all context/ files
  before writing any code (JavaScript Mastery Six-File Context System).