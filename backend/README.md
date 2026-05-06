# U-Buzz Backend

This folder contains the database schema definitions and setup scripts for the U-Buzz project, powered by Supabase.

## Migrations

The `migrations` directory contains SQL scripts that must be executed in order to set up the database.

*   **`001_create_tables.sql`**: Creates the 6 core tables (`users`, `videos`, `likes`, `comments`, `follows`, `reports`) with appropriate foreign keys and constraints (including the matricule format check).
*   **`002_rls_policies.sql`**: Enables Row Level Security (RLS) on all tables and creates the security policies ensuring users can only read appropriate data and modify their own records.
*   **`003_storage_buckets.sql`**: Sets up the 3 public storage buckets (`videos`, `thumbnails`, `avatars`) and their RLS policies to ensure authenticated users can only upload and delete files within folders matching their own User ID.

## Execution Order

If setting up a new Supabase environment or resetting the database, the migrations must be executed in the strict order defined by their numbering:

1.  `001_create_tables.sql`
2.  `002_rls_policies.sql`
3.  `003_storage_buckets.sql`

You can run these scripts via the Supabase SQL Editor in the dashboard, or through the Supabase CLI (`supabase db push` if configured as a standard Supabase project).
