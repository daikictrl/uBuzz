# SESSION START — READ CONTEXT FILES FIRST

Read all files inside the `context/` folder in this exact order:

1. `project-overview.md`
2. `architecture.md`
3. `code-standards.md`
4. `ui-context.md`
5. `progress-tracker.md`

Confirm reading complete before implementation begins.

---
STRICT EXECUTION RULES — NON-NEGOTIABLE
========================================
YOU MUST follow this process for EVERY section:

STEP 1: Build ONLY the current section
STEP 2: Ask me to test by running this command: npx expo start --clear
STEP 3: STOP and wait for my confirmation
STEP 4: Do NOT proceed until I confirm

IF YOU BUILD MORE THAN ONE SECTION AT A TIME
→ YOU HAVE FAILED THE TASK
→ STOP IMMEDIATELY AND REVERT

ONE SECTION AT A TIME. NO EXCEPTIONS.
WAIT FOR CONFIRMATION BEFORE EVERY NEXT SECTION.
========================================
---

# PHASE 5 MODIFICATION — ACCOUNT MANAGEMENT + SAFE USER HARDENING

IMPORTANT:

This is a HARDENING + ACCOUNT MANAGEMENT update.

Do NOT:

* rewrite unrelated logic
* modify working comment systems
* modify working profile/video systems unnecessarily
* rewrite navigation architecture
* introduce new dependencies unless explicitly required
* break existing auth/session flow

Only implement the account-management and resilience features described below.

---

# SECTION 1 — REMOVE OLD DELETE ACCOUNT TEXT

In `ProfileScreen.tsx`:

Remove this old text completely:

```txt
Want to delete your account? Contact admin.
```

Replace it with real authenticated account-management actions.

These actions must appear ONLY on the authenticated user's own profile.

Do NOT show them on other users' profiles.


--> STOP HERE. Wait for my confirmation before next section.

---

# SECTION 2 — PROFILE ACTIONS UI

Below the existing `Edit Profile` button, add:

1. Logout button
2. Delete Account button

Use the existing UI design language already established in the app.

Preserve spacing consistency.

---

## LOGOUT BUTTON

Text:

```txt
Logout
```

Style:

* outlined button
* subtle grey border
* visually secondary
* safe spacing from Edit Profile button

Behavior:

1. call:

```ts
await supabase.auth.signOut()
```

2. clear any local auth/session state if necessary

3. safely navigate user back to Auth/Login screen

4. prevent stale authenticated UI after logout

5. prevent navigation race conditions

IMPORTANT:

* logout must remain stable even after app refresh
* preserve existing auth architecture
* do NOT rewrite RootNavigator unnecessarily

---

## DELETE ACCOUNT BUTTON

Text:

```txt
Delete Account
```

Style:

* red text
* subtle transparent red background
* visually separated from Logout button
* destructive visual hierarchy

On tap:

Show confirmation Alert.

Title:

```txt
Delete Account?
```

Message:

```txt
This action is permanent. Your profile, videos, comments, follows, and account data will be permanently removed.
```

Buttons:

* Cancel
* Delete

Delete button:

* destructive style

IMPORTANT:
Do NOT directly delete Supabase auth users from the frontend.

Account deletion must use a secure backend flow.


--> STOP HERE. Wait for my confirmation before next section.

---

# SECTION 3 — SAFE ACCOUNT DELETION ARCHITECTURE

Account deletion MUST be handled through a secure Supabase Edge Function.

Do NOT:

* use service role keys in frontend
* attempt admin deletion from client
* manually orchestrate privileged auth deletion in React Native

Frontend responsibility:

* confirmation UI
* loading state
* calling secure Edge Function
* handling success/error UI
* signing out after successful deletion


--> STOP HERE. Wait for my confirmation before next section.

---

# SECTION 4 — CREATE SUPABASE EDGE FUNCTION

Create a secure Supabase Edge Function for account deletion.

Suggested function name:

```txt
delete-account
```

The Edge Function becomes the centralized orchestrator for deletion.

Use authenticated user identity from the request.

Do NOT trust arbitrary client-provided user IDs.


--> STOP HERE. Wait for my confirmation before next section.

---

# SECTION 5 — SAFE ACCOUNT DELETION FLOW

Inside the Edge Function, deletion MUST happen in this order:

1. Delete user's comments

2. Delete user's follow relationships:

```sql
WHERE follower_id = userId
OR following_id = userId
```

3. Delete user's videos

4. Delete related storage files:

* uploaded videos
* thumbnails
* avatars

5. Delete user's row from `public.users`

6. Delete Supabase auth user

7. Return success response

8. Frontend signs user out locally afterward


--> STOP HERE. Wait for my confirmation before next section.

---

# SECTION 6 — STORAGE CLEANUP

IMPORTANT:
Deleting database rows is NOT enough.

The deletion flow must also clean up:

* video files
* thumbnail files
* avatar files

Prevent orphaned Supabase Storage files.

Do NOT leave abandoned storage assets.

Use existing bucket structure.

If storage file removal fails:

* log warning
* continue carefully
* do NOT crash entire deletion flow unnecessarily


--> STOP HERE. Wait for my confirmation before next section.

---

# SECTION 7 — FAILURE SAFETY

The deletion flow must be centrally orchestrated.

Prevent:

* orphaned rows
* foreign key violations
* partial deletion states
* stale sessions
* broken navigation state

If deletion fails:

Show Alert:

```txt
Failed to delete account. Please try again.
```

Do NOT partially sign the user out.

Do NOT leave frontend in inconsistent auth state.


--> STOP HERE. Wait for my confirmation before next section.

---

# SECTION 8 — PROFILE SYNCHRONIZATION HARDENING

Problem:

Accounts created outside the app (example: directly inside Supabase dashboard)
may not contain required fields like:

* username
* matricule

This causes:

* missing `public.users` rows
* broken `useProfile()` calls
* foreign key failures during upload
* profile crashes

The system must now become resilient to incomplete auth users.


--> STOP HERE. Wait for my confirmation before next section.

---

# SECTION 9 — HARDEN handle_new_user TRIGGER

Update the existing `handle_new_user` trigger logic.

Requirements:

When a new auth user is created:

If username is missing:

Generate:

```txt
user_<random6chars>
```

Examples:

```txt
user_36d5e6
```

If matricule is missing:

Generate:

```txt
IU<random numbers>
```

Examples:

```txt
IU48291
```

IMPORTANT:

The trigger MUST ALWAYS create a valid `public.users` row.

Prevent:

* null constraint failures
* silent trigger failures
* missing profiles
* foreign key upload crashes later

The trigger should NEVER fail simply because metadata is incomplete.


--> STOP HERE. Wait for my confirmation before next section.

---

# SECTION 10 — PROFILE FALLBACK SAFETY

Update `useProfile()` and related profile-loading logic.

Requirements:

If a `public.users` row is somehow missing:

Do NOT:

* crash the app
* throw uncaught errors
* break profile screen rendering

Instead:

* show safe fallback UI
* log warning for debugging
* optionally attempt lightweight profile recovery

Optional recovery behavior:

If authenticated user exists but profile row missing:

* safely auto-create placeholder profile row
* generate safe fallback username/matricule
* avoid duplicate usernames


--> STOP HERE. Wait for my confirmation before next section.

---

# SECTION 11 — VIDEO UPLOAD SAFETY

Before uploading videos:

Verify:

* authenticated user exists
* matching `public.users` row exists

If missing:

* attempt lightweight recovery
  OR
* show friendly error message

Do NOT allow raw foreign key crashes to surface to users.

Prevent upload failures caused by missing profile rows.


--> STOP HERE. Wait for my confirmation before next section.

---

# SECTION 12 — IMPORTANT ARCHITECTURAL RULES

* Do NOT break existing auth flow
* Do NOT rewrite navigation architecture
* Do NOT break working realtime systems
* Do NOT modify working CommentsSheet logic unnecessarily
* Preserve current profile schema
* Preserve existing validations
* Preserve existing feed behavior
* Do NOT introduce duplicate auth state systems
* Do NOT leak service role credentials into frontend

This update is HARDENING existing architecture.
It is NOT a full authentication rewrite.

---

# EXPECTED RESULT

After implementation:

* users can logout safely
* users can delete their own accounts safely
* no orphaned database rows remain
* no orphaned storage files remain
* dashboard-created users no longer break the app
* `public.users` row always exists
* `useProfile()` never crashes from missing rows
* uploads no longer fail from missing profile records
* auth/session state remains stable
* app remains resilient even with incomplete auth metadata
* no stale authenticated UI after logout
* no foreign key crashes during uploads
