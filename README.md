# U-Buzz 🐝

U-Buzz is a campus-only short video social platform designed for students. It offers a TikTok-inspired experience featuring a vertical video scroll, social interactions (likes, comments, follows), and profile management, all powered by React Native (Expo) and Supabase.

## 🚀 Features

- **Authentication System**: Secure sign-up and login using Supabase Auth.
- **Home Feed**: Vertical video scrolling with "For You" and "Following" tabs.
- **Video Uploading**: Upload short videos from your device directly into the app.
- **Interactions**: Like videos, add comments, and engage with other students.
- **Profiles**: View and edit user profiles, track uploaded videos, and manage followers.
- **Social Graph**: Follow and unfollow other users on the campus platform.

## 🛠 Tech Stack

- **Frontend**: [React Native](https://reactnative.dev/) with [Expo](https://expo.dev/)
- **Backend & Database**: [Supabase](https://supabase.com/) (PostgreSQL, Storage, Auth)
- **Styling**: React Native styling with a vibrant purple accent (#8B5CF6).

## 📂 Project Structure

- `/frontend` - The React Native (Expo) application.
- `/backend` - Supabase SQL migrations, RLS policies, and configurations.
- `/context` - Project context and architecture documentation.

## ⚙️ Setup and Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/daikictrl/uBuzz.git
   cd uBuzz
   ```

2. **Install dependencies:**
   ```bash
   cd frontend
   npm install
   ```

3. **Configure Environment Variables:**
   Create a `.env` file in the `/frontend` directory and add your Supabase credentials:
   ```env
   EXPO_PUBLIC_SUPABASE_URL=your-supabase-url
   EXPO_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
   ```

4. **Run the App:**
   ```bash
   npx expo start
   ```

## 📈 Development Progress

Currently, the app is in **Phase 3** of development.
- ✅ Phase 1: Project Scaffold + Supabase Setup + Auth Screen
- ✅ Phase 2: Home Feed (Vertical Video Scroll)
- 🚧 Phase 3: Upload Screen (In Progress)
- ⏳ Phase 4: Comments Bottom Sheet
- ⏳ Phase 5: Profile Screen
- ⏳ Phase 6: Follows System + Feed Filter
- ⏳ Phase 7: Polish + Production Hardening

## 📝 License
This project is for educational and campus use.
