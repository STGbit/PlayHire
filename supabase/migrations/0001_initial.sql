create extension if not exists pgcrypto;
create type public.app_role as enum ('captain','player');
create type public.player_availability as enum ('available','unavailable','unknown');
create type public.invitation_status as enum ('pending','accepted','declined','expired');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  role public.app_role not null default 'player',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.teams (
  id uuid primary key default gen_random_uuid(), name text not null,
  sport text not null default 'Football', league text,
  captain_id uuid not null references public.profiles(id), created_at timestamptz not null default now()
);
create table public.team_members (
  team_id uuid not null references public.teams(id) on delete cascade,
  player_id uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(), primary key(team_id, player_id)
);
create table public.player_profiles (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  primary_position text not null, skill_level smallint not null check(skill_level between 1 and 5),
  requested_fee numeric(10,2) check(requested_fee >= 0), home_lat double precision, home_lng double precision,
  reliability_score numeric(5,2) check(reliability_score between 0 and 100), updated_at timestamptz not null default now()
);
create table public.matches (
  id uuid primary key default gen_random_uuid(), team_id uuid not null references public.teams(id) on delete cascade,
  opponent text not null, starts_at timestamptz not null, venue text, latitude double precision, longitude double precision,
  max_budget numeric(10,2) not null check(max_budget >= 0), tournament_eligibility_required boolean not null default false,
  created_by uuid not null references public.profiles(id), created_at timestamptz not null default now()
);
create table public.match_requirements (
  id uuid primary key default gen_random_uuid(), match_id uuid not null references public.matches(id) on delete cascade,
  sport text not null default 'Football', position text not null, minimum_skill smallint not null check(minimum_skill between 1 and 5),
  max_distance_km numeric(7,2) not null default 25 check(max_distance_km >= 0), weight_position numeric(5,4) not null default .30,
  weight_skill numeric(5,4) not null default .25, weight_reliability numeric(5,4) not null default .20,
  weight_distance numeric(5,4) not null default .15, weight_budget numeric(5,4) not null default .10,
  check(abs(weight_position + weight_skill + weight_reliability + weight_distance + weight_budget - 1) < .001)
);
create table public.availability (
  id uuid primary key default gen_random_uuid(), player_id uuid not null references public.profiles(id) on delete cascade,
  match_id uuid not null references public.matches(id) on delete cascade, status public.player_availability not null default 'unknown',
  updated_at timestamptz not null default now(), unique(player_id,match_id)
);
create table public.attendance_records (
  id uuid primary key default gen_random_uuid(), team_id uuid not null references public.teams(id) on delete cascade,
  player_id uuid not null references public.profiles(id) on delete cascade,
  match_id uuid not null references public.matches(id) on delete cascade,
  attended boolean not null, recorded_at timestamptz not null default now(), unique(player_id,match_id)
);
create table public.tournament_eligibility (
  team_id uuid not null references public.teams(id) on delete cascade, player_id uuid not null references public.profiles(id) on delete cascade,
  eligible boolean not null, verified_at timestamptz, primary key(team_id,player_id)
);
create table public.invitations (
  id uuid primary key default gen_random_uuid(), match_id uuid not null references public.matches(id) on delete cascade,
  player_id uuid not null references public.profiles(id) on delete cascade,
  invited_by uuid not null references public.profiles(id), status public.invitation_status not null default 'pending',
  created_at timestamptz not null default now(), responded_at timestamptz, unique(match_id,player_id)
);

create function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles(id, display_name, role)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email,'@',1)),
    case when new.raw_user_meta_data->>'role' = 'captain' then 'captain'::public.app_role else 'player'::public.app_role end);
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();

create index matches_team_starts_idx on public.matches(team_id, starts_at);
create index availability_match_status_idx on public.availability(match_id,status);
create index attendance_player_idx on public.attendance_records(player_id,recorded_at desc);
create index invitations_player_status_idx on public.invitations(player_id,status);

create function public.is_team_member(target_team uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.team_members tm where tm.team_id=target_team and tm.player_id=auth.uid())
    or exists(select 1 from public.teams t where t.id=target_team and t.captain_id=auth.uid());
$$;
create function public.is_team_captain(target_team uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.teams where id=target_team and captain_id=auth.uid());
$$;

alter table public.profiles enable row level security;
alter table public.teams enable row level security;
alter table public.team_members enable row level security;
alter table public.player_profiles enable row level security;
alter table public.matches enable row level security;
alter table public.match_requirements enable row level security;
alter table public.availability enable row level security;
alter table public.attendance_records enable row level security;
alter table public.tournament_eligibility enable row level security;
alter table public.invitations enable row level security;

create policy profiles_read_self_or_teammate on public.profiles for select using(id=auth.uid() or exists(select 1 from public.team_members tm where tm.player_id=id and public.is_team_member(tm.team_id)));
create policy profiles_insert_self on public.profiles for insert with check(id=auth.uid());
create policy profiles_update_self on public.profiles for update using(id=auth.uid()) with check(id=auth.uid());
create policy teams_read_member on public.teams for select using(public.is_team_member(id));
create policy teams_create_captain on public.teams for insert with check(captain_id=auth.uid());
create policy teams_update_captain on public.teams for update using(captain_id=auth.uid()) with check(captain_id=auth.uid());
create policy members_read_team on public.team_members for select using(public.is_team_member(team_id));
create policy members_manage_captain on public.team_members for all using(public.is_team_captain(team_id)) with check(public.is_team_captain(team_id));
create policy player_profile_read_self_or_teammate on public.player_profiles for select using(user_id=auth.uid() or exists(select 1 from public.team_members tm where tm.player_id=user_id and public.is_team_member(tm.team_id)));
create policy player_profile_insert_self on public.player_profiles for insert with check(user_id=auth.uid());
create policy player_profile_update_self on public.player_profiles for update using(user_id=auth.uid()) with check(user_id=auth.uid());
create policy matches_read_member on public.matches for select using(public.is_team_member(team_id));
create policy matches_manage_captain on public.matches for all using(public.is_team_captain(team_id)) with check(public.is_team_captain(team_id));
create policy requirements_read_member on public.match_requirements for select using(exists(select 1 from public.matches m where m.id=match_id and public.is_team_member(m.team_id)));
create policy requirements_manage_captain on public.match_requirements for all using(exists(select 1 from public.matches m where m.id=match_id and public.is_team_captain(m.team_id))) with check(exists(select 1 from public.matches m where m.id=match_id and public.is_team_captain(m.team_id)));
create policy availability_read_team_or_self on public.availability for select using(player_id=auth.uid() or exists(select 1 from public.matches m where m.id=match_id and public.is_team_member(m.team_id)));
create policy availability_set_self on public.availability for all using(player_id=auth.uid()) with check(player_id=auth.uid());
create policy attendance_read_member on public.attendance_records for select using(public.is_team_member(team_id));
create policy attendance_manage_captain on public.attendance_records for all using(public.is_team_captain(team_id)) with check(public.is_team_captain(team_id));
create policy eligibility_read_member on public.tournament_eligibility for select using(public.is_team_member(team_id));
create policy eligibility_manage_captain on public.tournament_eligibility for all using(public.is_team_captain(team_id)) with check(public.is_team_captain(team_id));
create policy invitations_read_player_or_captain on public.invitations for select using(player_id=auth.uid() or exists(select 1 from public.matches m where m.id=match_id and public.is_team_captain(m.team_id)));
create policy invitations_create_captain on public.invitations for insert with check(invited_by=auth.uid() and exists(select 1 from public.matches m where m.id=match_id and public.is_team_captain(m.team_id)));
create policy invitations_respond_player on public.invitations for update using(player_id=auth.uid()) with check(player_id=auth.uid());
