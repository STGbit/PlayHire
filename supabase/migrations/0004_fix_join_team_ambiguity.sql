create or replace function public.join_team(p_join_code text)
returns table(team_id uuid, team_name text, team_sport text)
language plpgsql
security definer
set search_path = public
as $$
declare
  target public.teams%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Sign in is required to join a team';
  end if;

  select t.* into target
  from public.teams as t
  where t.join_code = upper(trim(p_join_code));

  if not found then
    raise exception 'That team code was not found';
  end if;

  insert into public.team_members as membership (team_id, player_id)
  values (target.id, auth.uid())
  on conflict do nothing;

  return query select target.id, target.name, target.sport;
end;
$$;

revoke all on function public.join_team(text) from public;
grant execute on function public.join_team(text) to authenticated;
