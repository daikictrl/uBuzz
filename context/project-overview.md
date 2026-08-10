# U-Buzz — Project Overview

## What It Is

U-Buzz is a campus-only short video social platform built exclusively for students of IUGET (Institut Universitaire des Grandes Ecoles des Tropiques), Douala, Cameroon.

Students upload short videos, scroll a vertical feed, search for peers, follow other creators, and interact with each other through likes and realtime comments. It is modeled after TikTok/Reels but scoped entirely to the local IUGET campus community.

## One-Sentence Description

A TikTok-style short video feed app exclusively for IUGET students to share, discover, and interact with campus content.

## App Identity & Platforms

- **Name**: U-Buzz
- **Bundle ID**: `com.ubuzz.campus`
- **Tagline**: IUGET's Campus Network
- **Language**: English only
- **Platform**: iOS + Android via Expo (React Native)

---

## Core Tech Stack

- **Frontend**: [React Native](https://reactnative.dev/) with [Expo](https://expo.dev/)
- **Database & Backend**: [Supabase](https://supabase.com/) (PostgreSQL, Auth, Realtime Postgres Changes)
- **Media Hosting & Optimization**: [Cloudinary](https://cloudinary.com/) (on-the-fly streaming optimizations, image thumbnail and avatar generation, and CDN delivery)
- **Local Storage**: `AsyncStorage` (used for persistent mute preferences, upload rate-limit history, and session flags)

---

## Core Features & Screen Breakdown

### 1. Home Feed (Double Tab Feed)
- **For You Tab**: A chronological public feed of all videos uploaded by any student.
- **Following Tab**: A filtered feed displaying videos only from creators that the logged-in student follows.
- **Video Player UX**:
  - Vertical scrollable feed utilizing optimized list rendering to prevent memory leaks.
  - Smart autoplay: Autoplays the active video in view (requires 80% visibility threshold).
  - Lifecycle awareness: Auto-pauses videos when the app goes into the background, when navigating away from the Home Screen, or when modals (such as the comments sheet) are opened.
  - Persisted Mute: Global mute/unmute preference shared synchronously across all cards and persisted in local storage.

### 2. Video Upload Screen
- **Media Picking & Thumbnail Gen**: Integrates `expo-image-picker` to select short videos and `expo-video-thumbnails` to extract thumbnails instantly on device.
- **Safety Constraints**:
  - Max duration: 60 seconds (validated on frontend).
  - Max file size: 30 MB (preventing large payloads).
  - Input Sanitization: Removes HTML tags and restricts captions to 200 characters.
  - Upload Rate Limiting: Restricts users to a maximum of 5 uploads per hour (persisted via `AsyncStorage`).
- **Cloudinary API Pipeline**: Directly uploads selected media (videos and thumbnails) to Cloudinary via multipart requests and stores Cloudinary `secure_url` and `public_id` in the database.

### 3. Realtime Comments & Likes
- **Interactive Likes**: Instantly toggle like state with backend synchronization.
- **Comments Bottom Sheet**:
  - Scrollable view of comments with options to add or delete comments.
  - **Realtime Sync**: Subscribes to Supabase `postgres_changes` channels for the comments table. Comment counts are updated instantly across all devices without requiring manual pull-to-refresh.
  - Optimistic updates used on addition/deletion to ensure instantaneous UX feedback.

### 4. Search Screen
- **Student Directory**: Search for fellow IUGET students by username or full name.
- **Privacy Protections**: Search results display usernames and biographies but mask sensitive matricule numbers (e.g. `IU****45` instead of the raw matricule).
- **Navigation**: Directly tap on search results to open their campus profiles.

### 5. Profile Screen & Editing
- **Content Grid**: Displays a 3-column video grid of the user's uploaded videos (or any other creator's videos).
- **Campus Statistics**: Displays follow metrics (Followers and Following counts) and total video uploads.
- **Edit Profile Sheet**:
  - Interactive modal enabling students to update their profile picture, bio (max 150 characters), and display name.
  - Updates avatars directly to Cloudinary and updates the user profile record in Supabase.

---

## Media & Performance Optimization

To prevent excessive bandwidth consumption and guarantee smooth scrolling on Android/iOS devices, U-Buzz applies runtime Cloudinary transformations:

- **Video Optimization**: Appends `f_auto,q_auto,br_1m,w_720` parameters to cap bitrates to 1 Mbps, constrain video resolution to 720p, and transcode formats dynamically based on device compatibility.
- **Grid Thumbnails**: Appends `f_auto,q_auto,w_400,c_fill` to deliver cropped, lightweight images for video grid layouts.
- **User Avatars**: Appends `f_auto,q_auto,w_100,c_fill,g_face` to deliver highly optimized user avatar pictures with smart face detection cropping.

---

## Campus Verification Model

Verification is honor-system based because there is no direct database link to the university registration system:
- **Format Validation**: Matricule format is strictly validated on signup both on the client and in the database using the regex constraint: `^IU[0-9]{4,6}$` (e.g. `IU2024`, `IU10045`).
- **Uniqueness Constraint**: A unique database constraint prevents duplicate matricules from signing up, ensuring a one-matricule-per-account policy.
- **Abuse Handling**: Fake profiles can be reported (stored in the `reports` table) and are managed by system administrators via Supabase database access.

---

## Database & Security (RLS) Model

Supabase handles backend security through Row Level Security (RLS) and automated triggers:
- **`users`**: Read access is allowed to all authenticated students. Insert and update permissions are restricted to the owner (`auth.uid() = id`).
- **`videos`, `likes`, `comments`, `follows`**: Read access is permitted to all logged-in students. Insert and delete permissions are constrained by ownership rules (`auth.uid() = user_id`).
- **`reports`**: Insert access allowed to authenticated reporters. Select access is denied to clients, keeping reports admin-only.
- **User Trigger**: An automated database trigger (`handle_new_user`) executes on `auth.users` creation, generating a public user profile, assigning a unique random username or matricule fallback if missing, and handling conflict resolution.

---

## Out of Scope (MVP constraints)

- **Direct Messages (DMs)**: No messaging system.
- **Push Notifications**: Only local/in-app badge indicator.
- **In-App Account Deletion**: Users contact administrator for account removal.
- **Engagement-Based Feed Algorithm**: Scoped strictly to chronological order (all posts on For You, followed posts on Following).
- **Web App Support**: Built exclusively for mobile devices.