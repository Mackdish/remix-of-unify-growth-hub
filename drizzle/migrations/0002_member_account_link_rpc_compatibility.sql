-- Keep the original four-argument member-link call working for older app builds.
-- The wrapper delegates to the role-checked five-argument SECURITY DEFINER function.
create or replace function public.admin_link_member_account(
  p_member_id uuid,
  p_user_id uuid,
  p_role public.app_role,
  p_confirm_email boolean
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select public.admin_link_member_account(
    p_member_id,
    p_user_id,
    p_role,
    p_confirm_email,
    false
  );
$$;

revoke execute on function public.admin_link_member_account(uuid, uuid, public.app_role, boolean) from public, anon;
grant execute on function public.admin_link_member_account(uuid, uuid, public.app_role, boolean) to authenticated;