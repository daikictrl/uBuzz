STRICT EXECUTION RULES — NON-NEGOTIABLE
========================================
Build ONLY what is described here.

STEP 1: Implement ONLY this issue
STEP 2: Ask me to test with:
        npx expo start --clear
STEP 3: STOP and wait for confirmation
STEP 4: Do NOT modify anything else

IF YOU TOUCH UNRELATED LOGIC
→ YOU HAVE FAILED THE TASK
→ STOP IMMEDIATELY AND REVERT

========================================

U-BUZZ — FEED CAPTION EXPANSION
========================================

PROBLEM
=======
Long captions in the Home feed are currently truncated like:

  "This was one of the craziest moments..."

But users cannot expand the caption to read the full text.

This creates a dead-end UX and hurts engagement.

Implement inline caption expansion similar to TikTok/Instagram.

========================================

FILES ALLOWED TO MODIFY
========================
- frontend/src/components/VideoCard.tsx

Do NOT modify:
- useFeed.ts
- HomeScreen.tsx
- CommentsSheet.tsx
- navigation
- database logic
- realtime logic
- upload logic

UI-only enhancement.

========================================

IMPLEMENTATION REQUIREMENTS
============================

Inside VideoCard.tsx:

If caption length exceeds a reasonable threshold
(example: 80–120 characters),
truncate it visually.

Example collapsed state:

  "This was one of the craziest moments during..."
   more

The "more" text:
- inline with caption OR directly below
- accent color (#8B5CF6)
- tappable

----------------------------------------

When user taps "more":

Expand the full caption inline.

Expanded example:

  "This was one of the craziest moments during
   yesterday's engineering practical session..."

  less

"less" should collapse back to truncated state.

========================================

IMPORTANT STATE RULES
======================

Caption expansion state MUST be per-video.

DO NOT use one global boolean like:

  isExpanded

That will break FlatList virtualization.

Instead:
- key state by stable video id
OR
- keep local component state safely scoped
  to each VideoCard instance

IMPORTANT:
Expanded captions must NOT leak between
recycled FlatList cells.

Do NOT key expansion state by array index.

========================================

UX REQUIREMENTS
================

- Short captions:
  Do NOT show "more" or "less"

- Expanded captions:
  Must push content naturally
  without breaking layout

- Tapping "more":
  Must NOT trigger play/pause

- Tapping "more/less":
  Must NOT interfere with double tap like logic

- Do NOT break:
  video autoplay
  single tap pause/play
  double tap like
  comments button
  profile navigation
  existing caption styling

========================================

OPTIONAL IMPLEMENTATION DETAIL
===============================

You may use:
- numberOfLines
OR
- manual substring truncation

Pick whichever is more stable with the
existing VideoCard layout.

But:
- expansion/collapse must feel instant
- no layout flickering
- no unnecessary re-renders

========================================

VERIFICATION PLAN
==================

1. Long caption:
   Confirm truncated caption appears with "more"

2. Tap "more":
   Confirm full caption expands inline

3. Tap "less":
   Confirm caption collapses properly

4. Short caption:
   Confirm no "more/less" appears

5. Scroll feed aggressively:
   Confirm expanded captions do NOT appear
   on unrelated recycled videos

6. Verify:
   - autoplay still works
   - single tap pause/play still works
   - double tap like still works
   - no gesture conflicts introduced

========================================

AFTER IMPLEMENTATION
====================

Run:
  npx expo start --clear

Then STOP and wait for my confirmation.