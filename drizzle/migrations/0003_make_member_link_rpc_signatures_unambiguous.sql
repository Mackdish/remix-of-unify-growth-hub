-- Recreate the member-link function without default arguments so the four- and
-- five-argument RPC signatures resolve unambiguously in PostgREST.
drop function public.admin_link_member_account(uuid, uuid, public.app_role, boolean);
drop function public.admin_link_member_account(uuid, uuid, public.app_role, boolean, boolean);

create function public.admin_link_member_account(
  p_member_id uuid,
  p_user_id uuid,
  p_role public.app_role,
  p_confirm_email boolean,
  p_overwrite_email boolean
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

-- Older app builds call the four-argument form; keep it as a secure wrapper.
create function public.admin_link_member_account(
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