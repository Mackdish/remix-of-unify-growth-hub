-- Remove the need for a Supabase service/secret key during member activation.
-- These functions are intentionally narrow SECURITY DEFINER RPCs because the
-- authenticated user must be able to claim an invite and link their member
-- record without receiving broad access to other rows.
--
-- Apply this migration to the Supabase project before deploying the code.

create or replace function public.get_member_invite(p_token text)
returns table (
  full_name text,
  email text,
  expires_at timestamptz,
  accepted_at timestamptz
)
language sql
security definer
set search_path = ''
stable
as $$
  select
    mi.full_name,
    mi.email,
    mi.expires_at,
    mi.accepted_at
  from public.member_invites mi
  where mi.token = p_token
  limit 1;
$$;

revoke execute on function public.get_member_invite(text) from public;
grant execute on function public.get_member_invite(text) to anon, authenticated;

create or replace function public.claim_member_invite(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  v_invite public.member_invites%rowtype;
  v_linked_member_id uuid;
begin
  if v_user_id is null then
    return jsonb_build_object('ok', false, 'error', 'Authentication is required');
  end if;

  if v_email = '' then
    return jsonb_build_object('ok', false, 'error', 'Your authenticated account has no email address');
  end if;

  select *
    into v_invite
  from public.member_invites
  where token = p_token
    and accepted_at is null
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'This invitation is invalid or has already been used');
  end if;

  if v_invite.expires_at < now() then
    return jsonb_build_object('ok', false, 'error', 'This invitation has expired');
  end if;

  if lower(coalesce(v_invite.email, '')) <> v_email then
    return jsonb_build_object('ok', false, 'error', 'This invitation belongs to a different email address');
  end if;

  if v_invite.member_id is null then
    return jsonb_build_object('ok', false, 'error', 'This invitation is not linked to a member record');
  end if;

  update public.members
     set user_id = v_user_id,
         email = v_email,
         status = 'active'
   where id = v_invite.member_id
     and user_id is null
  returning id into v_linked_member_id;

  if v_linked_member_id is null then
    -- Idempotent case: the member may already be linked to this same user.
    if exists (
      select 1
      from public.members
      where id = v_invite.member_id
        and user_id = v_user_id
    ) then
      v_linked_member_id := v_invite.member_id;
    else
      return jsonb_build_object('ok', false, 'error', 'This member account is already linked');
    end if;
  end if;

  insert into public.user_roles (user_id, role)
  values (v_user_id, v_invite.role)
  on conflict (user_id, role) do nothing;

  update public.member_invites
     set accepted_at = now(),
         email = v_email
   where id = v_invite.id
     and accepted_at is null;

  return jsonb_build_object(
    'ok', true,
    'member_id', v_linked_member_id,
    'role', v_invite.role
  );
end;
$$;

revoke execute on function public.claim_member_invite(text) from public;
grant execute on function public.claim_member_invite(text) to authenticated;
