-- Requirement portal submissions table
create table if not exists public.requirement_submissions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),

  -- Section 1 : About you
  name text not null,
  company_name text not null,
  email text not null,

  -- Section 2 : Fleet requirement
  pilot_quantity integer,
  scale_quantity integer,
  pilot_timeline text,
  scale_timeline text,
  budget_per_unit numeric,

  -- Section 3 : Performance
  top_speed text,
  range_km text,
  storage_size text,
  overall_size text,
  ground_clearance text,

  -- Section 4 : Battery & charging
  battery_type text,
  voltage_architecture text,
  charging_time text,
  temperature_range text,

  -- Section 5 : Body & platform
  load_capacity text,
  body_style text,
  need_app text,

  -- Section 6 : Operating environment
  landscape text,
  cold_storage text,

  -- Section 7 : Delivery
  delivery_location text,
  point_of_contact text,
  delivery_basis text,

  -- Section 8 : Features
  airbags text,
  abs text,
  iot_enabled text,
  seatbelt text,
  ac text,
  pushback_seats text,
  v2x text,
  traction_control text,
  autonomous text,
  vinyl_sticker text,

  -- Raw answers, so nothing is ever lost
  full_payload jsonb not null default '{}'::jsonb
);

create index if not exists requirement_submissions_created_at_idx
  on public.requirement_submissions (created_at desc);

create index if not exists requirement_submissions_company_idx
  on public.requirement_submissions (company_name);

alter table public.requirement_submissions enable row level security;

-- Public can submit (the portal form is anonymous)
create policy "anyone can insert requirement submissions"
  on public.requirement_submissions for insert
  to anon, authenticated
  with check (true);

-- Only the service role can read (admin dashboard / edge function)
create policy "service role can read requirement submissions"
  on public.requirement_submissions for select
  to service_role
  using (true);
