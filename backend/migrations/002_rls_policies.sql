-- Enable RLS on all tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

-- USERS POLICIES
CREATE POLICY users_select_authenticated ON public.users
  FOR SELECT TO authenticated USING (true);

CREATE POLICY users_insert_own ON public.users
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

CREATE POLICY users_update_own ON public.users
  FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- VIDEOS POLICIES
CREATE POLICY videos_select_authenticated ON public.videos
  FOR SELECT TO authenticated USING (true);

CREATE POLICY videos_insert_own ON public.videos
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY videos_delete_own ON public.videos
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- LIKES POLICIES
CREATE POLICY likes_select_authenticated ON public.likes
  FOR SELECT TO authenticated USING (true);

CREATE POLICY likes_insert_own ON public.likes
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY likes_delete_own ON public.likes
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- COMMENTS POLICIES
CREATE POLICY comments_select_authenticated ON public.comments
  FOR SELECT TO authenticated USING (true);

CREATE POLICY comments_insert_own ON public.comments
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY comments_delete_own ON public.comments
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- FOLLOWS POLICIES
CREATE POLICY follows_select_authenticated ON public.follows
  FOR SELECT TO authenticated USING (true);

CREATE POLICY follows_insert_own ON public.follows
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = follower_id);

CREATE POLICY follows_delete_own ON public.follows
  FOR DELETE TO authenticated USING (auth.uid() = follower_id);

-- REPORTS POLICIES
-- No SELECT policy for reports -> defaults to deny for clients, meaning admin only
CREATE POLICY reports_insert_own ON public.reports
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = reporter_id);
