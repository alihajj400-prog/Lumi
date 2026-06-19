-- Run after creating a user in Supabase Auth dashboard.
-- Replace YOUR_AUTH_USER_UUID with the UUID from auth.users.

INSERT INTO users (id, organization_id, branch_id, full_name, role)
VALUES (
  '4d009be0-dd89-4e5f-845c-327d93628e85',
  'aaaaaaaa-0000-0000-0000-000000000001',
  'bbbbbbbb-0000-0000-0000-000000000001',
  'Admin User',
  'admin'
) ON CONFLICT DO NOTHING;

-- The JWT org_id claim is read from users.organization_id.
-- Add this custom claim so RLS policies work.
-- In Supabase: go to Authentication > Hooks and add a custom access token hook,
-- OR use the approach below in the Supabase SQL editor:

-- Create a hook function that injects org_id into the JWT:
CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  claims  jsonb;
  org_id  uuid;
BEGIN
  SELECT organization_id INTO org_id
  FROM public.users
  WHERE id = (event->>'user_id')::uuid;

  claims := event->'claims';

  IF org_id IS NOT NULL THEN
    claims := jsonb_set(claims, '{org_id}', to_jsonb(org_id::text));
  END IF;

  RETURN jsonb_set(event, '{claims}', claims);
END;
$$;

GRANT EXECUTE ON FUNCTION public.custom_access_token_hook TO supabase_auth_admin;
REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook FROM authenticated, anon, public;
