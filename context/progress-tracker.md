# U-Buzz — Progress Tracker

## Current Status

**Active Phase:** Phase 3 — Upload Screen (bug fix in progress)
**Last Updated:** Phase 3 built, media picker bug reported

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
- Feed is empty (expected — no videos uploaded yet)
- Following tab empty (expected — no follows yet)
- Comment button wired but CommentsSheet not built until Phase 4
- Report option wired but ReportSheet not built until Phase 7

---

### [IN PROGRESS] Phase 3 — Upload Screen

Completed items:
- [DONE] src/screens/UploadScreen.tsx created
- [DONE] Caption input with character counter
- [DONE] Post button and upload flow structure

Known Bug:
- [FIXED] Media picker fails with error:
  "Could not open the media picker. Please try again."
  Root cause: expo-image-picker permissions not configured
  correctly for the device/platform.
  Fix applied: Added proper permissions configuration for
  expo-image-picker in app.json and requested permissions
  at runtime before calling launchImageLibraryAsync().

Still needed after bug fix:
- [ ] Verify video preview renders after pick
- [ ] Verify duration badge shows on preview
- [ ] Verify thumbnail generation works (expo-video-thumbnails)
- [ ] Verify upload progress bar works
- [ ] Verify video row appears in Supabase videos table after post
- [ ] Verify redirect to Home feed after successful post
- [ ] Verify upload rate limiting works (max 5/hour)
- [ ] Test file size validation (reject over 50MB)

---

### [ ] Phase 4 — Comments Bottom Sheet

Not started.

Scope:
- src/components/CommentsSheet.tsx
- Fetch comments per videoId
- Realtime INSERT subscription per videoId
- Add comment with optimistic update
- Wire to VideoCard comment button

---

### [ ] Phase 5 — Profile Screen

Not started.

Scope:
- src/hooks/useProfile.ts
- src/screens/ProfileScreen.tsx (full implementation)
- src/components/EditProfileSheet.tsx
- Avatar upload, username edit, bio edit
- Video grid with thumbnail cells
- Follow/Unfollow button for other profiles
- Navigation wiring from VideoCard and CommentsSheet

---

### [ ] Phase 6 — Follows System + Feed Filter

Not started.

Scope:
- src/hooks/useFollow.ts
- Wire follow/unfollow to ProfileScreen
- Update useFeed.ts for "following" feedType query
- Wire Following tab in HomeScreen to filtered feed

---

### [ ] Phase 7 — Polish + Production Hardening

Not started.

Scope:
- src/components/SkeletonCard.tsx
- src/components/SkeletonGrid.tsx
- src/components/ReportSheet.tsx
- src/screens/SearchScreen.tsx (full implementation)
- Double-tap to like with heart animation
- Mute/unmute with AsyncStorage persistence
- Buffering indicator on video player
- In-app notification badge on Profile tab
- Security hardening (sanitization, 401 handler, RLS audit)
- Final navigation audit

---

## Known Issues Log

| Issue | Phase | Status | Notes |
|-------|-------|--------|-------|
| Media picker fails to open | 3 | FIXED | Permissions configured |

---

## Session Notes

- Bilingual UI (English/French) was removed
  All remaining phases use English only.
- Purple accent color (#8B5CF6) established by Stitch in Phase 1-2.
  Keep consistent across all screens.
- Context files added after Phase 3 started using the
  JavaScript Mastery Six-File Context System to prevent
  AI context drift across sessions.
- Every new session must start by reading all context/ files
  before writing any code.