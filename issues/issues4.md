========================================================
PHASE 7 — MEDIA OPTIMIZATION
========================================================

Apply Cloudinary optimization best practices.

Images:
- auto format
- auto quality
- compression enabled

Videos:
- optimized delivery
- compressed streaming
- avoid original-quality delivery when unnecessary

Reduce bandwidth aggressively.

========================================================
PHASE 8 — U-BUZZ VIDEO FEED PRIORITY REQUIREMENTS
=======================================

This application is a TikTok-style campus short-video platform.

Video delivery performance is the highest priority area of the migration.

The migration MUST prioritize:

* optimized video streaming
* reduced repeated video fetching
* minimized CDN bandwidth waste
* smooth infinite scrolling
* memory-efficient video rendering
* stable autoplay behavior
* preventing unnecessary video reloads during navigation/rerenders

Critical requirements:

* avoid re-fetching videos repeatedly when users scroll back
* preserve video playback performance
* avoid memory leaks in feed rendering
* ensure FlatList/FlashList optimization remains intact
* prevent excessive network requests from autoplay logic
* ensure cached video playback behavior where appropriate
* avoid loading original-quality videos unnecessarily

The migration must NOT introduce:

* feed lag
* stuttering
* excessive buffering
* scroll freezes
* unstable autoplay
* repeated rendering loops
* excessive memory consumption

Video feed stability is more important than introducing new features.
============================================================================

DO NOT implement code changes yet.

First perform a deep audit of the current video feed architecture and generate a detailed optimization plan.

Analyze:

1. Video playback architecture
2. Feed rendering architecture
3. FlatList / FlashList configuration
4. Autoplay behavior
5. Video caching behavior
6. Re-render frequency
7. Memory usage risks
8. Network request patterns
9. Video preloading strategy
10. Cloudinary delivery URL optimization opportunities
11. Bandwidth consumption risks
12. Scroll performance bottlenecks

Identify:

* unnecessary re-renders
* repeated video fetching
* memory leaks
* autoplay inefficiencies
* unnecessary network requests
* bandwidth waste
* excessive video buffering
* Cloudinary delivery optimization opportunities

For every recommendation provide:

* affected files
* expected benefit
* implementation complexity
* regression risk (LOW / MEDIUM / HIGH)

IMPORTANT:

Do NOT modify any code.

Do NOT implement optimizations.

Do NOT rewrite feed architecture.

Generate only a detailed optimization plan and risk assessment for review.

Presentation stability remains the highest priority.
