-- Privileged admin operations WITHOUT a Supabase service/secret key.
--
-- Each function below is SECURITY DEFINER and verifies the caller's role from
-- auth.uid() (the signed-in user's JWT) before doing anything. The app calls
-- them with the signed-in user's own session, so no server-side secret is
-- needed and nothing privileged is reachable by users without the right role.
--
-- Apply this migration to the Supabase / Lovable Cloud project BEFORE deploying
-- the code that calls these functions.

-- ---------------------------------------------------------------------------
-- Site settings: super admin only
-- ---------------------------------------------------------------------------
create or replace function public.admin_update_site_settings(
  p_id uuid,
  p_group_name text,
  p_tagline text,
  p_phone text,
  p_email text,
  p_location text,
  p_about_intro text,
  p_vision text,
  p_mission text,
  p_marquee_enabled boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rows integer;
begin
  if auth.uid() is null
     or not public.has_any_role(auth.uid(), array['super_admin']::public.app_role[]) then
    raise exception 'Only a super admin can change site settings' using errcode = '42501';
  end if;

  update public.site_settings
     set group_name = p_group_name,
         tagline = p_tagline,
         phone = p_phone,
         email = p_email,
         location = p_location,
         about_intro = p_about_intro,
         vision = p_vision,
         mission = p_mission,
         marquee_enabled = p_marquee_enabled,
         updated_by = auth.uid(),
         updated_at = now()
   where id = p_id;

  get diagnostics v_rows = row_count;
  if v_rows = 0 then
    raise exception 'Site settings record not found';
  end if;

  return jsonb_build_object('ok', true);
end;
$$;

revoke execute on function public.admin_update_site_settings(uuid, text, text, text, text, text, text, text, text, boolean) from public, anon;
grant execute on function public.admin_update_site_settings(uuid, text, text, text, text, text, text, text, text, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- Delete a member and their login: super admin only
-- ---------------------------------------------------------------------------
create or replace function public.admin_delete_member(p_member_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_member public.members%rowtype;
  v_txn_count bigint;
  v_loan_count bigint;
begin
  if auth.uid() is null
     or not public.has_any_role(auth.uid(), array['super_admin']::public.app_role[]) then
    raise exception 'Only a super admin can delete members' using errcode = '42501';
  end if;

  select * into v_member from public.members where id = p_member_id for update;
  if not found then
    raise exception 'Member not found';
  end if;

  if v_member.user_id is not null and v_member.user_id = auth.uid() then
    raise exception 'You cannot delete your own member account';
  end if;

  select count(*) into v_txn_count from public.transactions where member_id = p_member_id;
  if v_txn_count > 0 then
    raise exception 'This member has financial transactions and cannot be deleted. Remove or archive the financial records first.';
  end if;

  select count(*) into v_loan_count from public.loan_requests where member_id = p_member_id;
  if v_loan_count > 0 then
    raise exception 'This member has loan requests and cannot be deleted. Remove or archive the loan records first.';
  end if;

  delete from public.member_invites where member_id = p_member_id;

  if v_member.user_id is not null then
    delete from public.user_roles where user_id = v_member.user_id;
  end if;

  delete from public.members where id = p_member_id;

  -- Remove the login last, inside the same transaction, so a failure above
  -- never leaves a member record without its login.
  if v_member.user_id is not null then
    delete from auth.users where id = v_member.user_id;
  end if;

  return jsonb_build_object(
    'ok', true,
    'member_id', p_member_id,
    'full_name', v_member.full_name
  );
end;
$$;

revoke execute on function public.admin_delete_member(uuid) from public, anon;
grant execute on function public.admin_delete_member(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Link an existing auth user to a member: super admin or secretary
-- Optionally assigns a role and confirms the email of a just-created login.
-- ---------------------------------------------------------------------------
create or replace function public.admin_link_member_account(
  p_member_id uuid,
  p_user_id uuid,
  p_role public.app_role default null,
  p_confirm_email boolean default false,
  p_overwrite_email boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_member public.members%rowtype;
  v_user_email text;
  v_other_code text;
  v_other_name text;
begin
  if auth.uid() is null
     or not public.has_any_role(auth.uid(), array['super_admin','secretary']::public.app_role[]) then
    raise exception 'Forbidden' using errcode = '42501';
  end if;

  if p_role is not null
     and p_role <> 'member'::public.app_role
     and not public.has_any_role(auth.uid(), array['super_admin']::public.app_role[]) then
    raise exception 'Only a super admin can assign an administrative role.' using errcode = '42501';
  end if;

  select u.email into v_user_email from auth.users u where u.id = p_user_id;
  if not found then
    raise exception 'Selected user account was not found';
  end if;

  select * into v_member from public.members where id = p_member_id for update;
  if not found then
    raise exception 'Member not found';
  end if;
  if v_member.user_id is not null then
    raise exception 'This member is already linked to an account';
  end if;

  select m.member_code, m.full_name
    into v_other_code, v_other_name
  from public.members m
  where m.user_id = p_user_id
  limit 1;
  if found then
    raise exception 'That login is already linked to member % - %', v_other_code, v_other_name;
  end if;

  update public.members
     set user_id = p_user_id,
         status = 'active',
         email = case
                   when p_overwrite_email then lower(v_user_email)
                   else coalesce(v_member.email, lower(v_user_email))
                 end
   where id = p_member_id;

  -- The admin vouches for the email of a login they just created for the member.
  -- Limited to accounts created in the last 15 minutes so it cannot be used to
  -- confirm arbitrary older accounts.
  if p_confirm_email then
    update auth.users
       set email_confirmed_at = now()
     where id = p_user_id
       and email_confirmed_at is null
       and created_at > now() - interval '15 minutes';
  end if;

  if p_role is not null then
    insert into public.user_roles (user_id, role)
    values (p_user_id, p_role)
    on conflict (user_id, role) do nothing;
  end if;

  return jsonb_build_object(
    'ok', true,
    'member_id', p_member_id,
    'user_id', p_user_id
  );
end;
$$;

revoke execute on function public.admin_link_member_account(uuid, uuid, public.app_role, boolean, boolean) from public, anon;
grant execute on function public.admin_link_member_account(uuid, uuid, public.app_role, boolean, boolean) to authenticated;
