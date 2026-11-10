-- Joining a team should also create the player's visible roster entry.
drop function if exists public.join_team(text);

create function public.join_team(p_join_code text)
returns table(joined_team_id uuid, team_name text, team_sport text)
language plpgsql
security definer
set search_path = public
as $$
declare
  target_team public.teams%rowtype;
  athlete_name text;
  athlete_position text;
begin
  if auth.uid() is null then
    raise exception 'Sign in is required to join a team';
  end if;

  select t.*
    into target_team
  from public.teams as t
  where t.join_code = upper(trim(p_join_code));

  if not found then
    raise exception 'That team code was not found';
  end if;

  select p.display_name, pp.primary_position
    into athlete_name, athlete_position
  from public.profiles as p
  left join public.player_profiles as pp on pp.user_id = p.id
  where p.id = auth.uid();

  insert into public.team_members as membership (team_id, player_id)
  values (target_team.id, auth.uid())
  on conflict (team_id, player_id) do nothing;

  insert into public.team_roster_entries
    (team_id, display_name, primary_position, player_id, created_by)
  values
    (target_team.id, coalesce(nullif(trim(athlete_name), ''), 'Player'), athlete_position, auth.uid(), auth.uid())
  on conflict (team_id, player_id) where player_id is not null do nothing;

  return query
  select target_team.id, target_team.name, target_team.sport;
end;
$$;

revoke all on function public.join_team(text) from public;
grant execute on function public.join_team(text) to authenticated;

-- Backfill players who had already joined before roster syncing was added.
insert into public.team_roster_entries
  (team_id, display_name, primary_position, player_id, created_by)
select
  membership.team_id,
  coalesce(nullif(trim(profile.display_name), ''), 'Player'),
  player_profile.primary_position,
  membership.player_id,
  membership.player_id
from public.team_members as membership
join public.teams as team on team.id = membership.team_id
left join public.profiles as profile on profile.id = membership.player_id
left join public.player_profiles as player_profile on player_profile.user_id = membership.player_id
where membership.player_id <> team.captain_id
on conflict (team_id, player_id) where player_id is not null do nothing;
