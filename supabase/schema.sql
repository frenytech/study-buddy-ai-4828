-- StudyAI — full database schema. Run once in Supabase SQL Editor.
-- Safe to re-run: uses IF NOT EXISTS / OR REPLACE where possible.

create extension if not exists pgcrypto;

-- ============ ROLES ============
do $$ begin create type public.app_role as enum ('admin','student'); exception when duplicate_object then null; end $$;
do $$ begin create type public.exam_type as enum ('jamb','waec'); exception when duplicate_object then null; end $$;

create table if not exists public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role public.app_role not null,
  unique (user_id, role)
);
grant select, insert, delete on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

drop policy if exists "read own roles" on public.user_roles;
create policy "read own roles" on public.user_roles for select to authenticated
  using (user_id = auth.uid() or public.has_role(auth.uid(),'admin'));
drop policy if exists "admins manage roles" on public.user_roles;
create policy "admins manage roles" on public.user_roles for all to authenticated
  using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

-- ============ PROFILES ============
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email text,
  exam_target text,
  created_at timestamptz not null default now()
);
grant select, insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;
drop policy if exists "own profile read" on public.profiles;
create policy "own profile read" on public.profiles for select to authenticated
  using (id = auth.uid() or public.has_role(auth.uid(),'admin'));
drop policy if exists "own profile update" on public.profiles;
create policy "own profile update" on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, email)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'), new.email)
  on conflict (id) do nothing;
  insert into public.user_roles (user_id, role) values (new.id, 'student') on conflict do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============ SUBJECTS & QUESTIONS ============
create table if not exists public.subjects (
  id uuid primary key default gen_random_uuid(),
  exam public.exam_type not null,
  name text not null,
  unique (exam, name)
);
grant select on public.subjects to anon, authenticated;
grant insert, update, delete on public.subjects to authenticated;
grant all on public.subjects to service_role;
alter table public.subjects enable row level security;
drop policy if exists "subjects public" on public.subjects;
create policy "subjects public" on public.subjects for select to anon, authenticated using (true);
drop policy if exists "subjects admin" on public.subjects;
create policy "subjects admin" on public.subjects for all to authenticated
  using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

create table if not exists public.questions (
  id uuid primary key default gen_random_uuid(),
  exam public.exam_type not null,
  subject_id uuid not null references public.subjects(id) on delete cascade,
  year int,
  question text not null,
  options jsonb not null,            -- [{"key":"A","text":"..."}, ...]
  answer text not null,              -- "A" | "B" | "C" | "D" | "E"
  explanation text,
  source text not null default 'past' check (source in ('past','ai_practice')),
  status text not null default 'draft' check (status in ('draft','published')),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);
create index if not exists questions_lookup on public.questions (exam, subject_id, status);
-- Students never read this table directly (answers stay hidden). Admins only.
grant select, insert, update, delete on public.questions to authenticated;
grant all on public.questions to service_role;
alter table public.questions enable row level security;
drop policy if exists "questions admin" on public.questions;
create policy "questions admin" on public.questions for all to authenticated
  using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

-- ============ CBT SESSIONS ============
create table if not exists public.cbt_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  exam public.exam_type not null,
  subject_id uuid not null references public.subjects(id),
  question_ids uuid[] not null,
  answers jsonb not null default '{}'::jsonb,
  duration_seconds int not null,
  started_at timestamptz not null default now(),
  submitted_at timestamptz,
  score int,
  total int not null
);
grant select, update on public.cbt_sessions to authenticated;
grant all on public.cbt_sessions to service_role;
alter table public.cbt_sessions enable row level security;
drop policy if exists "own sessions" on public.cbt_sessions;
create policy "own sessions" on public.cbt_sessions for select to authenticated
  using (user_id = auth.uid() or public.has_role(auth.uid(),'admin'));
drop policy if exists "save answers" on public.cbt_sessions;
create policy "save answers" on public.cbt_sessions for update to authenticated
  using (user_id = auth.uid() and submitted_at is null) with check (user_id = auth.uid() and submitted_at is null);

create or replace function public.start_cbt(_subject_id uuid, _count int, _minutes int)
returns uuid language plpgsql security definer set search_path = public as $$
declare _ids uuid[]; _exam public.exam_type; _sid uuid;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  select exam into _exam from subjects where id = _subject_id;
  select array_agg(id) into _ids from (
    select id from questions where subject_id = _subject_id and status = 'published'
    order by random() limit greatest(1, least(_count, 100))) q;
  if _ids is null then raise exception 'No published questions for this subject yet'; end if;
  insert into cbt_sessions (user_id, exam, subject_id, question_ids, duration_seconds, total)
  values (auth.uid(), _exam, _subject_id, _ids, greatest(1, least(_minutes, 240)) * 60, array_length(_ids,1))
  returning id into _sid;
  return _sid;
end $$;

-- Questions for a running session, without answers
create or replace function public.get_cbt_questions(_session_id uuid)
returns table (id uuid, question text, options jsonb, year int, source text)
language sql stable security definer set search_path = public as $$
  select q.id, q.question, q.options, q.year, q.source
  from cbt_sessions s join lateral unnest(s.question_ids) with ordinality as u(qid, ord) on true
  join questions q on q.id = u.qid
  where s.id = _session_id and s.user_id = auth.uid()
  order by u.ord
$$;

create or replace function public.submit_cbt(_session_id uuid, _answers jsonb)
returns int language plpgsql security definer set search_path = public as $$
declare _score int; _s cbt_sessions;
begin
  select * into _s from cbt_sessions where id = _session_id and user_id = auth.uid();
  if not found then raise exception 'Session not found'; end if;
  if _s.submitted_at is not null then return _s.score; end if;
  select count(*) into _score from questions q
   where q.id = any(_s.question_ids) and upper(_answers->>q.id::text) = upper(q.answer);
  update cbt_sessions set answers = _answers, score = _score, submitted_at = now() where id = _session_id;
  return _score;
end $$;

-- Review with answers, only after submission
create or replace function public.get_cbt_review(_session_id uuid)
returns table (id uuid, question text, options jsonb, answer text, explanation text, source text, year int)
language sql stable security definer set search_path = public as $$
  select q.id, q.question, q.options, q.answer, q.explanation, q.source, q.year
  from cbt_sessions s join lateral unnest(s.question_ids) with ordinality as u(qid, ord) on true
  join questions q on q.id = u.qid
  where s.id = _session_id and s.user_id = auth.uid() and s.submitted_at is not null
  order by u.ord
$$;

create or replace function public.question_counts()
returns table (subject_id uuid, total bigint) language sql stable security definer set search_path = public as $$
  select subject_id, count(*) from questions where status = 'published' group by subject_id
$$;

-- ============ AI TUTOR ============
create table if not exists public.tutor_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'New chat',
  created_at timestamptz not null default now()
);
create table if not exists public.tutor_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.tutor_conversations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('user','assistant')),
  content text not null,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.tutor_conversations, public.tutor_messages to authenticated;
grant all on public.tutor_conversations, public.tutor_messages to service_role;
alter table public.tutor_conversations enable row level security;
alter table public.tutor_messages enable row level security;
drop policy if exists "own convos" on public.tutor_conversations;
create policy "own convos" on public.tutor_conversations for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "own msgs" on public.tutor_messages;
create policy "own msgs" on public.tutor_messages for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ============ SUBSCRIPTIONS & PAYMENTS ============
create table if not exists public.subscriptions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  plan text not null check (plan in ('free','pro','premium')),
  status text not null default 'active',
  current_period_end timestamptz,
  updated_at timestamptz not null default now()
);
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  reference text unique not null,
  plan text not null,
  amount_kobo int not null,
  status text not null default 'pending',
  created_at timestamptz not null default now()
);
grant select on public.subscriptions, public.payments to authenticated;
grant all on public.subscriptions, public.payments to service_role;
alter table public.subscriptions enable row level security;
alter table public.payments enable row level security;
drop policy if exists "own sub" on public.subscriptions;
create policy "own sub" on public.subscriptions for select to authenticated
  using (user_id = auth.uid() or public.has_role(auth.uid(),'admin'));
drop policy if exists "own payments" on public.payments;
create policy "own payments" on public.payments for select to authenticated
  using (user_id = auth.uid() or public.has_role(auth.uid(),'admin'));

create or replace function public.current_plan(_user_id uuid) returns text
language sql stable security definer set search_path = public as $$
  select coalesce((select plan from subscriptions where user_id = _user_id and status = 'active'
     and (current_period_end is null or current_period_end > now())), 'free')
$$;

-- ============ AI USAGE ============
create table if not exists public.ai_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null default current_date,
  count int not null default 0,
  primary key (user_id, day)
);
grant select on public.ai_usage to authenticated;
grant all on public.ai_usage to service_role;
alter table public.ai_usage enable row level security;
drop policy if exists "own usage" on public.ai_usage;
create policy "own usage" on public.ai_usage for select to authenticated
  using (user_id = auth.uid() or public.has_role(auth.uid(),'admin'));

-- Returns true and counts one use if under the daily limit for the plan.
create or replace function public.consume_ai_credit() returns boolean
language plpgsql security definer set search_path = public as $$
declare _plan text; _limit int; _used int;
begin
  if auth.uid() is null then return false; end if;
  _plan := current_plan(auth.uid());
  _limit := case _plan when 'premium' then 500 when 'pro' then 100 else 10 end;
  insert into ai_usage (user_id, day, count) values (auth.uid(), current_date, 0) on conflict do nothing;
  select count into _used from ai_usage where user_id = auth.uid() and day = current_date for update;
  if _used >= _limit then return false; end if;
  update ai_usage set count = count + 1 where user_id = auth.uid() and day = current_date;
  return true;
end $$;

-- ============ STUDY PLANNER ============
create table if not exists public.study_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  due_date date,
  done boolean not null default false,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.study_tasks to authenticated;
grant all on public.study_tasks to service_role;
alter table public.study_tasks enable row level security;
drop policy if exists "own tasks" on public.study_tasks;
create policy "own tasks" on public.study_tasks for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

grant execute on function public.start_cbt, public.get_cbt_questions, public.submit_cbt,
  public.get_cbt_review, public.consume_ai_credit, public.current_plan, public.has_role to authenticated;
grant execute on function public.question_counts to anon, authenticated;

-- ============ SEED SUBJECTS ============
insert into public.subjects (exam, name) values
 ('jamb','Use of English'),('jamb','Mathematics'),('jamb','Physics'),('jamb','Chemistry'),('jamb','Biology'),
 ('jamb','Economics'),('jamb','Government'),('jamb','Literature in English'),('jamb','Commerce'),('jamb','Geography'),
 ('jamb','Accounting'),('jamb','CRS'),('jamb','IRS'),('jamb','Agricultural Science'),
 ('waec','English Language'),('waec','Mathematics'),('waec','Physics'),('waec','Chemistry'),('waec','Biology'),
 ('waec','Economics'),('waec','Government'),('waec','Literature in English'),('waec','Commerce'),('waec','Geography'),
 ('waec','Financial Accounting'),('waec','Civic Education'),('waec','Further Mathematics'),('waec','Agricultural Science')
on conflict do nothing;

-- ============ SAMPLE PRACTICE QUESTIONS (labelled practice, not past questions) ============
insert into public.questions (exam, subject_id, question, options, answer, explanation, source, status)
select 'jamb', s.id, v.q, v.o::jsonb, v.a, v.e, 'ai_practice', 'published'
from public.subjects s, (values
 ('Choose the word nearest in meaning to "candid".','[{"key":"A","text":"Frank"},{"key":"B","text":"Sweet"},{"key":"C","text":"Hidden"},{"key":"D","text":"Careful"}]','A','"Candid" means honest and straightforward, i.e. frank.'),
 ('Choose the option opposite in meaning to "scarce".','[{"key":"A","text":"Rare"},{"key":"B","text":"Plentiful"},{"key":"C","text":"Costly"},{"key":"D","text":"Small"}]','B','Scarce means in short supply; the opposite is plentiful.'),
 ('Neither the teacher nor the students ___ present.','[{"key":"A","text":"was"},{"key":"B","text":"is"},{"key":"C","text":"were"},{"key":"D","text":"has been"}]','C','With "neither...nor", the verb agrees with the nearer subject, "students" (plural).'),
 ('Which word is correctly spelt?','[{"key":"A","text":"Accomodation"},{"key":"B","text":"Acommodation"},{"key":"C","text":"Accommodation"},{"key":"D","text":"Acomodation"}]','C','Accommodation has double "c" and double "m".'),
 ('He was ___ by the loud noise.','[{"key":"A","text":"startled"},{"key":"B","text":"startling"},{"key":"C","text":"start"},{"key":"D","text":"starts"}]','A','The passive past participle "startled" is correct.')
) as v(q,o,a,e)
where s.exam='jamb' and s.name='Use of English'
  and not exists (select 1 from public.questions x where x.subject_id = s.id);

insert into public.questions (exam, subject_id, question, options, answer, explanation, source, status)
select 'jamb', s.id, v.q, v.o::jsonb, v.a, v.e, 'ai_practice', 'published'
from public.subjects s, (values
 ('Solve for x: 2x + 5 = 17','[{"key":"A","text":"5"},{"key":"B","text":"6"},{"key":"C","text":"7"},{"key":"D","text":"8"}]','B','2x = 12, so x = 6.'),
 ('Simplify: 3² × 3³','[{"key":"A","text":"3⁵"},{"key":"B","text":"3⁶"},{"key":"C","text":"9⁵"},{"key":"D","text":"3¹"}]','A','Add the indices: 3^(2+3) = 3⁵.'),
 ('Find the mean of 2, 4, 6, 8, 10.','[{"key":"A","text":"5"},{"key":"B","text":"6"},{"key":"C","text":"7"},{"key":"D","text":"8"}]','B','Sum is 30; 30 ÷ 5 = 6.'),
 ('What is 25% of 240?','[{"key":"A","text":"48"},{"key":"B","text":"60"},{"key":"C","text":"64"},{"key":"D","text":"80"}]','B','240 × 0.25 = 60.'),
 ('The sum of interior angles of a triangle is','[{"key":"A","text":"90°"},{"key":"B","text":"180°"},{"key":"C","text":"270°"},{"key":"D","text":"360°"}]','B','Angles in any triangle add up to 180°.')
) as v(q,o,a,e)
where s.exam='jamb' and s.name='Mathematics'
  and not exists (select 1 from public.questions x where x.subject_id = s.id);

-- ============ MAKE YOURSELF ADMIN (edit email, then run) ============
-- insert into public.user_roles (user_id, role)
-- select id, 'admin' from auth.users where email = 'you@example.com' on conflict do nothing;
