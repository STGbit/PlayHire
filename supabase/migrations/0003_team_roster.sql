create table public.team_roster_entries (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  player_id uuid references public.profiles(id) on delete set null,
  display_name text not null check (length(trim(display_name)) between 1 and 80),
  primary_position text check (primary_position is null or length(primary_position) <= 60),
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

create unique index team_roster_linked_player_idx
  on public.team_roster_entries(team_id, player_id) where player_id is not null;
create index team_roster_entries_team_idx
  on public.team_roster_entries(team_id, created_at);

-- Keep personal contact details separate from the roster visible to teammates.
create table public.team_roster_contacts (
  roster_entry_id uuid primary key references public.team_roster_entries(id) on delete cascade,
  email text check (email is null or length(email) <= 254),
  phone text check (phone is null or length(phone) <= 32),
  added_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  check (email is not null or phone is not null)
);

alter table public.team_roster_entries enable row level security;
alter table public.team_roster_contacts enable row level security;

create policy roster_read_team on public.team_roster_entries
  for select using (public.is_team_member(team_id));
create policy roster_manage_captain on public.team_roster_entries
  for all using (public.is_team_captain(team_id))
  with check (public.is_team_captain(team_id) and created_by = auth.uid());

create policy roster_contacts_read_captain on public.team_roster_contacts
  for select using (
    exists (
      select 1 from public.team_roster_entries entry
      where entry.id = roster_entry_id and public.is_team_captain(entry.team_id)
    )
  );
create policy roster_contacts_manage_captain on public.team_roster_contacts
  for all using (
    exists (
      select 1 from public.team_roster_entries entry
      where entry.id = roster_entry_id and public.is_team_captain(entry.team_id)
    )
  ) with check (
    added_by = auth.uid() and exists (
      select 1 from public.team_roster_entries entry
      where entry.id = roster_entry_id and public.is_team_captain(entry.team_id)
    )
  );

grant select, insert, update, delete on public.team_roster_entries to authenticated;
grant select, insert, update, delete on public.team_roster_contacts to authenticated;
