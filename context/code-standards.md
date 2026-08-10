# U-Buzz — Code Standards

## Language & Types

- TypeScript strictly throughout — no `any` types allowed
- All props must be typed with explicit interfaces or types
- All Supabase responses must be typed — use the generated
  Supabase types or define explicit return types
- All async functions must handle errors explicitly

## File Naming

| Thing          | Convention         | Example                  |
|----------------|--------------------|--------------------------|
| Screens        | PascalCase         | HomeScreen.tsx           |
| Components     | PascalCase         | VideoCard.tsx            |
| Hooks          | camelCase + use    | useFeed.ts               |
| Lib utilities  | camelCase          | validation.ts            |
| SQL migrations | 00N_description    | 001_create_tables.sql    |
| Context files  | kebab-case         | project-overview.md      |

## Component Rules

- Every component gets its own file — no combining components
- Props interface defined at the top of each component file
- No inline styles — use NativeWind classes only
- Google Stitch generates the visual layout — logic is layered on top
- Never mix data fetching logic inside a component —
  always use a custom hook

## Hook Rules

- One hook per concern (useFeed, useLike, useFollow, useProfile)
- Hooks expose minimal surface area — only what the component needs
- All Supabase calls live inside hooks, never in components directly
- Optimistic updates must always have a revert on error

## Error Handling Rules

- Every Supabase call must be wrapped in try/catch
- Network errors → show user-facing toast or inline message
- Auth errors (401) → clear session, redirect to AuthScreen
- Unique constraint violations → map to specific user messages:
    - Matricule taken: "This matricule is already registered."
    - Username taken: "This username is already taken."
    - Email taken: "An account with this email already exists."
- Never show raw Supabase error messages to the user
- Always disable submit buttons while async calls are in progress
- Always show loading indicators during async operations

## Supabase Rules

- Never call supabase directly from a component — always via hooks
- Always check for session before making authenticated calls
- Use supabase.auth.getSession() on app load (not getUser())
- Subscribe to onAuthStateChange() in App.tsx only
- Realtime subscriptions must be unsubscribed on component unmount
- Use unique channel names for all realtime subscriptions
  Format: "channel-{purpose}-{id}" e.g. "channel-comments-abc123"

## Validation Rules

All validation uses functions from src/lib/validation.ts:
- isValidMatricule(value) — must match /^IU[0-9]{4,6}$/i
- isValidEmail(value) — standard email format
- isValidUsername(value) — 3-20 chars, letters/numbers/underscores

Matricule must always be normalized to uppercase before storing.
Validate on blur (when user leaves a field), not on every keystroke.
Show inline errors below each field, not in alerts.

## Input Sanitization

Before any INSERT or UPDATE to Supabase, strip HTML tags
from all text inputs. Enforce these max lengths:
- username → 20 characters
- bio → 100 characters
- caption → 200 characters
- comment body → 500 characters
- report note → 500 characters

## AsyncStorage Keys

Use only these defined keys — never create new ones ad hoc:
- "ubuzz_mute_preference" → boolean (video mute state)
- "ubuzz_upload_history" → JSON array of timestamps

## Navigation Rules

- ProfileScreen accepts optional userId param
  No param = own profile (auth.uid())
  userId param = that user's profile
- Upload tab opens UploadScreen as full screen modal only
  No dedicated tab screen for Upload
- All cross-profile navigation passes userId as param

## Matricule Masking (Display Only)

Format: show first 2 chars + asterisks for middle + last 2 chars
Logic: "IU" + "*".repeat(matricule.length - 4) + matricule.slice(-2)
Examples:
  IU2024  → IU**24
  IU10045 → IU***45
Never store masked value — always store and use the real matricule
internally, mask only at the display layer.

## What Must Never Happen

- Never expose raw Supabase errors to the user
- Never store sensitive data in plain AsyncStorage (use SecureStore
  for auth tokens — Supabase client handles this automatically)
- Never allow uploads without checking the 5-per-hour rate limit first
- Never skip unsubscribing from realtime channels on unmount
- Never allow a user to follow themselves (enforced at DB level
  and should also be prevented in UI)
- Never show the reports table data to any client
- Never let account deletion happen in-app (no UI for it)