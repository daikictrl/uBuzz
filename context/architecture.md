# U-Buzz — Architecture

## Technology Stack

| Layer       | Technology              | Reason                                      |
|-------------|-------------------------|---------------------------------------------|
| Frontend    | React Native + Expo SDK 51+ | Cross-platform iOS + Android, fast setup |
| UI Design   | Google Stitch (via MCP) | Handles all visual design generation        |
| Backend     | Supabase                | Auth, database, storage, realtime           |
| Navigation  | React Navigation        | Stack + bottom tabs                         |
| Styling     | NativeWind v4           | Tailwind CSS for React Native               |
| Animation   | react-native-reanimated | Smooth interactions (double-tap, shimmer)   |

## Folder Structure

```
ubuzz/
├── context/                      ← AI context files (this folder)
│   ├── project-overview.md
│   ├── architecture.md
│   ├── code-standards.md
│   ├── ai-workflow-rules.md
│   ├── ui-context.md
│   └── progress-tracker.md
│
├── frontend/                     ← Expo React Native app
│   ├── App.tsx                   ← Entry point, session logic
│   ├── app.json                  ← Expo config
│   ├── supabase/
│   │   └── client.ts             ← Supabase client (expo-secure-store)
│   └── src/
│       ├── navigation/
│       │   └── RootNavigator.tsx ← Auth vs App stack switcher
│       ├── screens/
│       │   ├── AuthScreen.tsx
│       │   ├── HomeScreen.tsx
│       │   ├── UploadScreen.tsx
│       │   ├── SearchScreen.tsx
│       │   └── ProfileScreen.tsx
│       ├── components/
│       │   ├── VideoCard.tsx
│       │   ├── CommentsSheet.tsx
│       │   ├── EditProfileSheet.tsx
│       │   ├── ReportSheet.tsx
│       │   ├── SkeletonCard.tsx
│       │   └── SkeletonGrid.tsx
│       ├── hooks/
│       │   ├── useFeed.ts
│       │   ├── useLike.ts
│       │   ├── useFollow.ts
│       │   └── useProfile.ts
│       └── lib/
│           └── validation.ts
│
└── backend/                      ← Supabase config as code
    ├── migrations/
    │   ├── 001_create_tables.sql
    │   ├── 002_rls_policies.sql
    │   └── 003_storage_buckets.sql
    └── README.md
```

## Database Schema (Supabase PostgreSQL)

### users
| Column     | Type        | Constraints                        |
|------------|-------------|-------------------------------------|
| id         | UUID        | PK, DEFAULT uuid_generate_v4()     |
| email      | TEXT        | NOT NULL, UNIQUE                   |
| matricule  | TEXT        | NOT NULL, UNIQUE, CHECK ^IU[0-9]{4,}$ |
| username   | TEXT        | NOT NULL, UNIQUE                   |
| avatar_url | TEXT        |                                    |
| bio        | TEXT        |                                    |
| created_at | TIMESTAMPTZ | DEFAULT NOW()                      |

### videos
| Column        | Type        | Constraints                         |
|---------------|-------------|--------------------------------------|
| id            | UUID        | PK, DEFAULT uuid_generate_v4()      |
| user_id       | UUID        | NOT NULL, FK → users(id) CASCADE    |
| video_url     | TEXT        | NOT NULL                            |
| thumbnail_url | TEXT        |                                     |
| caption       | TEXT        |                                     |
| created_at    | TIMESTAMPTZ | DEFAULT NOW()                       |

### likes
| Column     | Type        | Constraints                          |
|------------|-------------|---------------------------------------|
| id         | UUID        | PK, DEFAULT uuid_generate_v4()       |
| user_id    | UUID        | NOT NULL, FK → users(id) CASCADE     |
| video_id   | UUID        | NOT NULL, FK → videos(id) CASCADE    |
| created_at | TIMESTAMPTZ | DEFAULT NOW()                        |
| —          | —           | UNIQUE (user_id, video_id)           |

### comments
| Column     | Type        | Constraints                          |
|------------|-------------|---------------------------------------|
| id         | UUID        | PK, DEFAULT uuid_generate_v4()       |
| user_id    | UUID        | NOT NULL, FK → users(id) CASCADE     |
| video_id   | UUID        | NOT NULL, FK → videos(id) CASCADE    |
| body       | TEXT        | NOT NULL                             |
| created_at | TIMESTAMPTZ | DEFAULT NOW()                        |

### follows
| Column       | Type        | Constraints                          |
|--------------|-------------|---------------------------------------|
| id           | UUID        | PK, DEFAULT uuid_generate_v4()       |
| follower_id  | UUID        | NOT NULL, FK → users(id) CASCADE     |
| following_id | UUID        | NOT NULL, FK → users(id) CASCADE     |
| created_at   | TIMESTAMPTZ | DEFAULT NOW()                        |
| —            | —           | UNIQUE (follower_id, following_id)   |
| —            | —           | CHECK follower_id != following_id    |

### reports
| Column      | Type        | Constraints                          |
|-------------|-------------|---------------------------------------|
| id          | UUID        | PK, DEFAULT uuid_generate_v4()       |
| reporter_id | UUID        | NOT NULL, FK → users(id) CASCADE     |
| video_id    | UUID        | NOT NULL, FK → videos(id) CASCADE    |
| reason      | TEXT        | NOT NULL                             |
| note        | TEXT        |                                      |
| created_at  | TIMESTAMPTZ | DEFAULT NOW()                        |

## RLS Policy Summary

| Table    | SELECT           | INSERT                  | UPDATE        | DELETE              |
|----------|------------------|-------------------------|---------------|---------------------|
| users    | authenticated    | own row only            | own row only  | not allowed         |
| videos   | authenticated    | own (user_id=auth.uid)  | —             | own videos only     |
| likes    | authenticated    | own (user_id=auth.uid)  | —             | own likes only      |
| comments | authenticated    | own (user_id=auth.uid)  | —             | own comments only   |
| follows  | authenticated    | own (follower_id=uid)   | —             | own follows only    |
| reports  | no policy        | own (reporter_id=uid)   | —             | —                   |

## Storage Buckets

| Bucket     | Visibility | Upload Path Pattern             |
|------------|------------|---------------------------------|
| videos     | public     | videos/{auth.uid()}/{uuid}.mp4  |
| thumbnails | public     | thumbnails/{auth.uid()}/{uuid}.jpg |
| avatars    | public     | avatars/{auth.uid()}.jpg        |

Storage RLS: users can only upload/delete within their own
auth.uid() prefixed folder.

## Key Architectural Decisions

1. No custom backend server — Supabase handles everything
2. Client-side video compression (quality: 0.5, max 60s, max 50MB)
3. Thumbnail generated client-side at upload time (first frame)
4. Feed is chronological only — no algorithm for MVP
5. Optimistic UI updates for likes and follows (revert on error)
6. Realtime subscriptions for comments (per video) and
   notification badges (per user)
7. Mute preference persisted in AsyncStorage key: "ubuzz_mute_preference"
8. Upload rate limit: max 5 uploads per hour tracked in AsyncStorage
   key: "ubuzz_upload_history"
9. Session expiry: global 401 handler clears session and redirects
   to AuthScreen