create or replace function public.leave_team(p_team_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Sign in is required to leave a team';
  end if;

  delete from public.team_roster_entries as roster_entry
  where roster_entry.team_id = p_team_id
    and roster_entry.player_id = auth.uid();

  delete from public.team_members as membership
  where membership.team_id = p_team_id
    and membership.player_id = auth.uid();

  if not found then
    raise exception 'You are not a member of this team';
  end if;
end;
$$;

revoke all on function public.leave_team(uuid) from public;
grant execute on function public.leave_team(uuid) to authenticated;
notify pgrst, 'reload schema';
