IMPORTANT — INITIAL CAPTION POSITION + EXPANSION BEHAVIOR REFINEMENT

The current implementation still does NOT match the intended UX.

I’ve uploaded a reference image showing the exact desired initial position.

Required behavior:

INITIAL (collapsed) STATE:

The entire profile/caption block MUST stay anchored near the bottom of the screen exactly like TikTok.
The initial collapsed position should NOT move upward just because the caption is long.
Long captions must NOT push the whole metadata container upward by default.
The username/avatar/caption section should visually remain low on the screen as shown in the reference image.

COLLAPSED CAPTION RULES:

In collapsed state:
Show only a limited number of caption lines.
Truncate overflow cleanly.
Show inline "more" button at the end.
The metadata container height in collapsed mode should remain compact and stable.

EXPANDED STATE:

ONLY when the user taps "more":
The caption section may expand upward dynamically.
Expansion height must depend on the actual caption content size.
DO NOT instantly jump to 50% height if the caption is short.
Small captions → small expansion.
Medium captions → medium expansion.
Very long captions → grow upward progressively.

MAXIMUM EXPANSION LIMIT:

Expanded caption area must NEVER exceed 50% of screen height.
If content exceeds that limit:
Make ONLY the caption text internally scrollable.
The overall metadata container stays capped at 50%.

LAYOUT DIRECTION:

Expansion must happen upward only.
Bottom anchor position must remain visually stable.
The metadata block should feel “attached” to the bottom of the screen.

IMPORTANT — STATE RESET ON SCROLL:
When a VideoCard scrolls out of view and back into view (FlatList recycling):

Reset expansion state to collapsed.
Do NOT persist expanded state across FlatList reuse cycles.
Every video should re-enter collapsed by default.

IMPORTANT:

Do NOT break:
play/pause
double tap like
comments
mute button
action buttons
safe area spacing
feed virtualization performance
Avoid unnecessary re-renders during expansion.
Use lightweight state only inside VideoCard.