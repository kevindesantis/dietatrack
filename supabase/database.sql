-- DietaTrack - schema Supabase completo
-- Incolla tutto in Supabase > SQL Editor > Run.

create extension if not exists pgcrypto;

-- 1) PROFILO UTENTE
create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  name text,
  sex text check (sex in ('maschio','femmina')) default 'maschio',
  birth_date date,
  height_cm numeric,
  activity_level text check (activity_level in ('sedentario','leggero','medio','alto')) default 'sedentario',
  start_weight numeric,
  current_weight numeric,
  target_weight numeric,
  target_date date,
  goal_notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 2) ARCHIVIO ALIMENTI, valori sempre per 100 g/ml
create table if not exists public.foods (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  name text not null,
  brand text,
  barcode text,
  category text,
  kcal_100g numeric not null default 0,
  protein_100g numeric not null default 0,
  carbs_100g numeric not null default 0,
  fat_100g numeric not null default 0,
  fiber_100g numeric default 0,
  sugar_100g numeric default 0,
  salt_100g numeric default 0,
  source text default 'manuale',
  is_public boolean default false,
  created_at timestamptz default now(),
  unique(user_id, barcode)
);

-- 3) OBIETTIVI GIORNALIERI
create table if not exists public.daily_targets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  target_date date not null,
  kcal_target numeric not null default 0,
  protein_target numeric not null default 0,
  carbs_target numeric not null default 0,
  fat_target numeric not null default 0,
  created_at timestamptz default now(),
  unique(user_id, target_date)
);

-- 4) DIARIO ALIMENTARE
create table if not exists public.food_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  food_id uuid references public.foods(id) on delete set null,
  log_date date not null,
  meal_type text not null check (meal_type in ('colazione','pranzo','merenda','cena','extra')),
  food_name text not null,
  grams numeric not null,
  kcal numeric not null default 0,
  protein numeric not null default 0,
  carbs numeric not null default 0,
  fat numeric not null default 0,
  fiber numeric default 0,
  sugar numeric default 0,
  salt numeric default 0,
  notes text,
  created_at timestamptz default now()
);

-- 5) STATO GIORNALIERO
create table if not exists public.daily_status (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  status_date date not null,
  status text not null check (status in ('non_registrata','parziale','completata','sgarro','saltata')) default 'non_registrata',
  notes text,
  created_at timestamptz default now(),
  unique(user_id, status_date)
);

-- 6) PESO E MISURE
create table if not exists public.body_measurements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  measure_date date not null,
  weight numeric,
  waist numeric,
  hips numeric,
  chest numeric,
  abdomen numeric,
  arm numeric,
  thigh numeric,
  neck numeric,
  notes text,
  created_at timestamptz default now(),
  unique(user_id, measure_date)
);

-- 7) DIETA SETTIMANALE: opzioni e alimenti contenuti
create table if not exists public.planned_meal_options (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  weekday int not null check (weekday between 0 and 6), -- 0 domenica, 1 lunedì ... 6 sabato
  meal_type text not null check (meal_type in ('colazione','pranzo','merenda','cena')),
  option_name text not null,
  notes text,
  created_at timestamptz default now()
);

create table if not exists public.planned_meal_foods (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  option_id uuid not null references public.planned_meal_options(id) on delete cascade,
  food_id uuid references public.foods(id) on delete set null,
  food_name text not null,
  grams numeric not null,
  kcal numeric not null default 0,
  protein numeric not null default 0,
  carbs numeric not null default 0,
  fat numeric not null default 0,
  fiber numeric default 0,
  sugar numeric default 0,
  salt numeric default 0,
  created_at timestamptz default now()
);

-- 8) ALLENAMENTO
create table if not exists public.workout_schedule (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  weekday int not null check (weekday between 0 and 6),
  title text not null,
  exercises text,
  notes text,
  created_at timestamptz default now()
);

create table if not exists public.workout_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  log_date date not null,
  status text not null check (status in ('non_registrato','fatto','saltato','modificato')) default 'non_registrato',
  notes text,
  created_at timestamptz default now(),
  unique(user_id, log_date)
);

-- 9) VISTA DI RIEPILOGO GIORNALIERO
create or replace view public.daily_nutrition_totals
with (security_invoker = true) as
select
  user_id,
  log_date,
  sum(kcal) as total_kcal,
  sum(protein) as total_protein,
  sum(carbs) as total_carbs,
  sum(fat) as total_fat,
  sum(fiber) as total_fiber,
  sum(sugar) as total_sugar,
  sum(salt) as total_salt
from public.food_logs
group by user_id, log_date;

-- 10) RLS
alter table public.profiles enable row level security;
alter table public.foods enable row level security;
alter table public.daily_targets enable row level security;
alter table public.food_logs enable row level security;
alter table public.daily_status enable row level security;
alter table public.body_measurements enable row level security;
alter table public.planned_meal_options enable row level security;
alter table public.planned_meal_foods enable row level security;
alter table public.workout_schedule enable row level security;
alter table public.workout_logs enable row level security;

-- Pulisce policy già esistenti con lo stesso nome
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
DROP POLICY IF EXISTS "foods_select_own_or_public" ON public.foods;
DROP POLICY IF EXISTS "foods_insert_own" ON public.foods;
DROP POLICY IF EXISTS "foods_update_own" ON public.foods;
DROP POLICY IF EXISTS "foods_delete_own" ON public.foods;
DROP POLICY IF EXISTS "targets_all_own" ON public.daily_targets;
DROP POLICY IF EXISTS "logs_all_own" ON public.food_logs;
DROP POLICY IF EXISTS "status_all_own" ON public.daily_status;
DROP POLICY IF EXISTS "measurements_all_own" ON public.body_measurements;
DROP POLICY IF EXISTS "planned_options_all_own" ON public.planned_meal_options;
DROP POLICY IF EXISTS "planned_foods_all_own" ON public.planned_meal_foods;
DROP POLICY IF EXISTS "workout_schedule_all_own" ON public.workout_schedule;
DROP POLICY IF EXISTS "workout_logs_all_own" ON public.workout_logs;

create policy "profiles_select_own" on public.profiles for select using (auth.uid() = user_id);
create policy "profiles_insert_own" on public.profiles for insert with check (auth.uid() = user_id);
create policy "profiles_update_own" on public.profiles for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "foods_select_own_or_public" on public.foods for select using (auth.uid() = user_id or is_public = true);
create policy "foods_insert_own" on public.foods for insert with check (auth.uid() = user_id);
create policy "foods_update_own" on public.foods for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "foods_delete_own" on public.foods for delete using (auth.uid() = user_id);

create policy "targets_all_own" on public.daily_targets for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "logs_all_own" on public.food_logs for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "status_all_own" on public.daily_status for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "measurements_all_own" on public.body_measurements for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "planned_options_all_own" on public.planned_meal_options for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "planned_foods_all_own" on public.planned_meal_foods for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "workout_schedule_all_own" on public.workout_schedule for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "workout_logs_all_own" on public.workout_logs for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 11) ALIMENTI PUBBLICI DI BASE
insert into public.foods (name, category, kcal_100g, protein_100g, carbs_100g, fat_100g, fiber_100g, sugar_100g, salt_100g, source, is_public)
values
('Pasta di semola cruda', 'cereali', 353, 12, 70, 1.5, 3, 3.2, 0.01, 'base', true),
('Riso bianco crudo', 'cereali', 360, 7, 79, 0.6, 1.3, 0.1, 0.01, 'base', true),
('Pane comune', 'pane', 270, 8.8, 57, 1.3, 3.8, 2.5, 1.4, 'base', true),
('Petto di pollo crudo', 'carne', 110, 23.3, 0, 1.2, 0, 0, 0.18, 'base', true),
('Tonno al naturale sgocciolato', 'pesce', 110, 25, 0, 1, 0, 0, 0.8, 'base', true),
('Uovo intero', 'uova', 143, 12.6, 0.7, 9.5, 0, 0.4, 0.35, 'base', true),
('Latte parzialmente scremato', 'latte', 46, 3.3, 4.8, 1.6, 0, 4.8, 0.1, 'base', true),
('Yogurt greco 0%', 'latte', 59, 10.3, 3.6, 0.4, 0, 3.6, 0.1, 'base', true),
('Banana', 'frutta', 89, 1.1, 23, 0.3, 2.6, 12, 0.01, 'base', true),
('Mela', 'frutta', 52, 0.3, 14, 0.2, 2.4, 10, 0.01, 'base', true),
('Olio extravergine di oliva', 'condimenti', 884, 0, 0, 100, 0, 0, 0, 'base', true),
('Patate crude', 'verdure', 77, 2, 17, 0.1, 2.2, 0.8, 0.01, 'base', true),
('Lenticchie secche', 'legumi', 352, 25.8, 60, 1.1, 10.7, 2, 0.02, 'base', true),
('Ceci secchi', 'legumi', 364, 19, 61, 6, 17, 11, 0.02, 'base', true),
('Salmone', 'pesce', 208, 20, 0, 13, 0, 0, 0.06, 'base', true),
('Manzo magro', 'carne', 170, 21, 0, 9, 0, 0, 0.08, 'base', true),
('Insalata mista', 'verdure', 20, 1.4, 3, 0.2, 1.5, 1.5, 0.03, 'base', true),
('Mandorle', 'frutta secca', 579, 21, 22, 50, 12.5, 4.4, 0.01, 'base', true)
on conflict do nothing;
