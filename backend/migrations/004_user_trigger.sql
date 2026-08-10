-- 004_user_trigger.sql
-- Creates a trigger to automatically insert a row into public.users when a user signs up.

CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
DECLARE
  v_username TEXT;
  v_matricule TEXT;
  v_email TEXT;
  v_random_chars TEXT;
  v_retry_count INTEGER := 0;
  v_exists BOOLEAN;
BEGIN
  -- Extract email safely
  v_email := NULLIF(TRIM(new.email), '');
  IF v_email IS NULL THEN
    v_email := 'placeholder_' || substring(new.id::text from 1 for 8) || '@ubuzz.campus';
  END IF;

  -- Extract username safely
  v_username := NULLIF(TRIM(new.raw_user_meta_data->>'username'), '');
  
  -- If username is missing, generate a unique one
  IF v_username IS NULL THEN
    LOOP
      v_random_chars := substring(md5(random()::text) from 1 for 6);
      v_username := 'user_' || v_random_chars;
      
      SELECT EXISTS(SELECT 1 FROM public.users WHERE username = v_username) INTO v_exists;
      IF NOT v_exists THEN
        EXIT;
      END IF;
      
      v_retry_count := v_retry_count + 1;
      IF v_retry_count >= 5 THEN
        -- Fallback: append portion of UUID to guarantee uniqueness
        v_username := 'user_' || v_random_chars || '_' || substring(new.id::text from 1 for 4);
        EXIT;
      END IF;
    END LOOP;
  END IF;

  -- Extract matricule safely
  v_matricule := UPPER(NULLIF(TRIM(new.raw_user_meta_data->>'matricule'), ''));
  
  -- If matricule is missing or invalid format, generate a unique valid one (must match ^IU[0-9]{4,6}$)
  IF v_matricule IS NULL OR NOT (v_matricule ~ '^IU[0-9]{4,6}$') THEN
    v_retry_count := 0;
    LOOP
      v_matricule := 'IU' || floor(random() * 90000 + 10000)::integer::text;
      
      SELECT EXISTS(SELECT 1 FROM public.users WHERE matricule = v_matricule) INTO v_exists;
      IF NOT v_exists THEN
        EXIT;
      END IF;
      
      v_retry_count := v_retry_count + 1;
      IF v_retry_count >= 5 THEN
        -- Fallback: generate a 6-digit random number to satisfy constraint and minimize collision
        v_matricule := 'IU' || floor(random() * 900000 + 100000)::bigint::text;
        EXIT;
      END IF;
    END LOOP;
  END IF;

  -- Idempotent Insertion
  BEGIN
    INSERT INTO public.users (id, email, matricule, username)
    VALUES (new.id, v_email, v_matricule, v_username)
    ON CONFLICT (id) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'handle_new_user failed for %: %', new.id, SQLERRM;
  END;

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
