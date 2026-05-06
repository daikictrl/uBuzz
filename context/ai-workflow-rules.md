# U-Buzz — AI Workflow Rules

## The Prime Directive

Before doing anything in a new session, read all files
in the context/ folder in this order:
1. project-overview.md
2. architecture.md
3. code-standards.md
4. ui-context.md
5. progress-tracker.md

Do not write a single line of code until all five files
have been read and understood. Confirm reading is complete
before proceeding.

## Session Start Protocol

Every new session begins with this sequence:
1. Read all context files (listed above)
2. Check progress-tracker.md to know what is done,
   what is in progress, and what comes next
3. Confirm the current state of the project out loud
   before taking any action
4. Ask for clarification if anything is unclear
   before writing code

## Build Rules

- Build only what the current phase spec describes
- Do not build ahead — no adding features not in the current phase
- Do not refactor code from previous phases unless explicitly asked
- Do not change working code to fix new code
- Complete one section fully before starting the next
- Confirm completion of each section before moving forward

## Google Stitch Integration Rule

For every screen and component that has a visual layer:
1. Use the Stitch MCP server to generate the UI layout first
2. Then layer all logic (data fetching, validation, state,
   error handling) on top of that generated layout
3. Never skip Stitch for any screen or component
4. Never override Stitch design decisions with manual styles
   unless there is a specific functional reason

## Supabase MCP Integration Rule

For all database operations in the backend/ folder:
1. Generate the SQL migration file first
2. Then execute it via the Supabase MCP connection
3. Confirm execution succeeded before moving to the next section
4. Never assume a migration succeeded — verify via MCP

## Error Fixing Protocol

When something is broken, follow this sequence:
1. Identify exactly what is broken (one specific thing)
2. State what the spec says it should do
3. State what it is currently doing
4. Fix only that one thing
5. Do not touch any other files or logic
6. Confirm the fix works before closing

When given an error message by the user:
- Read the error carefully before suggesting a fix
- Ask for the full error message if only partial is shared
- Never guess — if unsure what caused it, ask for more info
- Fix the root cause, not the symptom

## Scope Control Rules

- If a fix requires changing more than 3 files, stop and
  flag it before proceeding — it may be a design issue
- If implementing a feature requires something that doesn't
  exist yet from a previous phase, stop and flag it
- If two sections conflict, flag the conflict before
  choosing a direction
- Never silently make architectural decisions — always
  surface them for approval

## Progress Tracker Update Rule

After completing any phase or section:
1. Update context/progress-tracker.md immediately
2. Mark the completed item with [DONE] and the date
3. Mark the next item as [IN PROGRESS]
4. Never leave the tracker out of sync with the actual
   state of the project

## Correction Prompt Format

If something built does not match the spec, use this format:

"The [specific element] does not match the spec.
Expected: [what the spec says].
Current: [what was built].
Fix only this. Do not change anything else."

## What This Agent Must Never Do

- Never skip reading context files at session start
- Never build beyond the current phase scope
- Never make visual design decisions — defer to Stitch
- Never show raw Supabase errors to the user in the UI
- Never create new AsyncStorage keys not defined in
  code-standards.md
- Never add a DELETE account feature to the UI
- Never add DM or messaging features
- Never implement engagement-based feed ranking
- Never remove or bypass RLS policies
- Never store the reports table data in any client state