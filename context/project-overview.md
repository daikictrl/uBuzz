# U-Buzz — Project Overview

## What It Is

U-Buzz is a campus-only short video social platform built
exclusively for students of IUGET (Institut Universitaire des
Grandes Ecoles des Tropiques), Douala, Cameroon.

Students upload short videos, scroll a vertical feed, and
interact with each other through likes, comments, and follows.
It is modeled after Facebook/Instagram Reels but scoped entirely
to one campus community.

## One-Sentence Description

A TikTok-style short video feed app exclusively for IUGET students
to share, discover, and interact with campus content.

## Primary User

IUGET students in Douala, Cameroon. They are mobile-first users
on Android devices. They are familiar with Reels/TikTok UX patterns.

## Core User Flow (Start to Core Value)

1. Student opens app
2. Student signs up with email + valid matricule (starts with "IU")
3. Student confirms email via Supabase auth email
4. Student lands on the Home Feed (For You tab)
5. Student scrolls videos, likes, comments, follows others
6. Student taps + tab to upload their own short video
7. Student's video appears in other students' feeds

## The Three Most Important Features

1. Vertical video feed with autoplay (Home Screen)
2. Video upload with compression and thumbnail generation
3. Like + Comment interactions

## What Is Explicitly Out of Scope (MVP)

- Direct messages (DMs) — no messaging feature
- Push notifications — in-app badge only
- Account deletion in-app — contact admin to delete
- Engagement-based feed algorithm — chronological only for MVP
- External sharing links — share text only via native share sheet
- Web version — mobile app only
- Any campus other than IUGET for launch

## Campus Verification Model

IUGET has not granted database access for student verification.
Verification is honor-system based:
- Matricule must match format: ^IU[0-9]{4,}$ (e.g. IU2024, IU10045)
- Matricule is unique per account — one account per matricule
- Users who fake matricules violate ToS and can be reported
- Admin handles abuse manually via the reports table

## App Identity

- Name: U-Buzz
- Bundle ID: com.ubuzz.campus
- Tagline: IUGET's Campus Network
- Language: English only
- Platform: iOS + Android via Expo