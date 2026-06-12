# OBJECTIVE

Implement ONLY the approved low-risk optimizations identified during the Phase 7 and Phase 8 audit.

This is a presentation-stability-first optimization pass.

The Cloudinary migration has already been completed successfully:

* new video uploads use Cloudinary
* new thumbnail uploads use Cloudinary
* new avatar uploads use Cloudinary
* Cloudinary URLs are stored in the database
* media_provider metadata exists
* cloudinary_public_id metadata exists
* existing rendering remains source-agnostic

The goal is to improve efficiency, bandwidth usage, feed smoothness, and media delivery WITHOUT introducing architectural changes, feed regressions, autoplay bugs, rendering instability, or risky rewrites.

========================================================
APPROVED IMPLEMENTATION SCOPE
=============================

Implement ONLY the following optimizations.

---

1. Cloudinary Delivery URL Optimization

---

Optimize delivery URLs for Cloudinary-hosted media.

Requirements:

* apply Cloudinary delivery transformations
* use automatic quality selection
* use automatic format selection
* reduce bandwidth consumption
* reduce video delivery size
* preserve visual quality appropriate for a TikTok-style feed
* preserve thumbnail quality
* preserve video playback compatibility

Requirements:

* transformations must only apply to Cloudinary URLs
* do not rewrite database records
* generate optimized delivery URLs at runtime
* preserve existing URL storage format in the database
* preserve cloudinary_public_id values

Expected outcome:

* lower bandwidth usage
* faster video startup
* faster thumbnail loading
* reduced mobile data consumption

---

2. FlatList getItemLayout Optimization

---

Implement getItemLayout optimization if the current feed architecture supports it safely.

Requirements:

* maintain current scrolling behavior
* maintain autoplay behavior
* maintain feed UX
* no visual layout changes
* no feed architecture changes

Expected outcome:

* reduced layout calculations
* improved virtualization efficiency
* smoother scrolling

---

3. AppState Feed Lifecycle Handling

---

Implement safe AppState handling for feed video playback.

Requirements:

When application enters:

* background
* inactive state

Pause active playback safely.

When application returns:

* active state

Restore playback behavior safely.

Requirements:

* no autoplay regressions
* no memory leaks
* no duplicate playback
* no duplicate player instances
* no navigation regressions
* no feed state redesign

Expected outcome:

* reduced battery consumption
* reduced background resource usage
* improved playback stability

========================================================
EXPLICITLY EXCLUDED
===================

DO NOT IMPLEMENT:

* FlashList migration
* Video preloading systems
* Video caching architecture changes
* Player lifecycle redesign
* Feed architecture rewrites
* Feed state management rewrites
* React Context redesigns
* Global state refactors
* Re-render architecture changes
* Active video detection redesign
* Network layer redesign
* Database schema changes
* Additional migrations
* Cloudinary fetch/proxy mode
* Upload pipeline modifications
* Cloudinary upload service changes
* Cloudinary service layer rewrites
* Any optimization marked HIGH risk in the audit

========================================================
SAFETY REQUIREMENTS
===================

Do not modify:

* authentication
* realtime features
* comments
* likes
* follows
* notifications
* upload pipeline
* profile system
* navigation architecture

Preserve:

* existing feed functionality
* existing autoplay behavior
* existing scrolling behavior
* existing Cloudinary upload functionality
* existing Cloudinary metadata handling
* existing backward compatibility logic

========================================================
IMPLEMENTATION PROCESS
======================

Before modifying code:

1. List every file that will be modified.
2. Explain why each modification is required.
3. Explain expected performance benefit.
4. Explain regression risk.

Then implement ONLY the approved scope.

========================================================
FINAL VERIFICATION REQUIREMENTS
===============================

After implementation provide:

* modified file list
* exact optimizations applied
* expected bandwidth reduction
* expected scrolling improvement
* regression risk assessment

Verify:

* Cloudinary videos still play correctly
* Cloudinary thumbnails still render correctly
* Cloudinary avatars still render correctly
* uploads still work
* autoplay still works
* feed scrolling still works
* profile images still work
* media_provider metadata remains correct
* cloudinary_public_id metadata remains correct
* no TypeScript errors
* no new warnings
* no new runtime errors

Presentation stability remains the highest priority.
