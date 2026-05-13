=========================================
SESSION START — READ CONTEXT FILES FIRST
=========================================
Read all files in context/ folder in this order:
1. project-overview.md
2. architecture.md
3. code-standards.md
4. ui-context.md
5. progress-tracker.md

Confirm reading complete, then proceed.

================================================
# BUG FIX — GLOBAL REALTIME DELETE COUNTER SYNC
================================================

Current behavior:

* Deleting a comment FROM THE APP works correctly
  → comment disappears instantly
  → counter decrements instantly

* Deleting a comment FROM SUPABASE DATABASE works partially
  → comment disappears instantly
  → BUT counter does NOT decrement until refresh

This means:

* realtime DELETE events are reaching CommentsSheet
* BUT global feed count state is NOT synchronizing

IMPORTANT:
Do NOT patch this locally inside CommentsSheet again.

The fix must happen in the GLOBAL realtime synchronization layer
(probably useFeed.ts).

=================================================
ROOT CAUSE
==========

Current architecture appears to be:

LOCAL APP DELETE:

* optimistic decrement updates feed count correctly

EXTERNAL DELETE (Supabase dashboard / other device):

* realtime DELETE removes comment from sheet
* BUT feed/global state never decrements

This means realtime DELETE handling in the global
feed synchronization layer is incomplete.

=================================================
FIX REQUIREMENTS
================

Update the centralized realtime comment synchronization logic.

The global realtime listener must handle BOTH:

* INSERT
* DELETE

=================================================
DELETE EVENT REQUIREMENTS
=========================

On realtime DELETE event:

1. Identify the affected video_id

2. Update the matching video's comment count
   inside global feed state

3. Safely decrement:
   Math.max(0, currentCount - 1)

4. Prevent double decrement if the deletion
   originated locally from optimistic delete flow

=================================================
DEDUPLICATION
=============

Preserve the existing locally deleted tracking logic.

If a realtime DELETE event matches a locally deleted comment:

* ignore duplicate decrement
* clear tracking entry afterward

If deletion originated externally:

* decrement normally

=================================================
IMPORTANT ARCHITECTURE RULES
============================

* Global feed state remains the source of truth
* Do NOT move count ownership back into CommentsSheet
* Do NOT duplicate decrement logic across components
* Preserve existing realtime INSERT behavior
* Preserve existing optimistic delete behavior
* Preserve existing CommentsSheet functionality

=================================================
EXPECTED RESULT
===============

Deleting comment from app:

* instant delete
* instant decrement

Deleting comment from Supabase dashboard:

* instant delete
* instant decrement WITHOUT refresh

Deleting comment from another device:

* instant delete
* instant decrement everywhere

No double decrements.
No negative counts.
