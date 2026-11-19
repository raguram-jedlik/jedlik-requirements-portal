-- Sync every new requirement submission into the Google Sheet.
--
-- The Edge Function "sync-requirement-to-sheets" appends one row per insert.
-- It is invoked asynchronously via pg_net so a Sheets hiccup never blocks or
-- fails the customer's submission.
--
-- Prerequisites (run once in the Supabase dashboard -> SQL Editor, or set as
-- database settings before applying):
--   select vault.create_secret('https://<project-ref>.supabase.co', 'function_url');
--   select vault.create_secret('<service-role-key>', 'service_role_key');
-- Both names are read below via current_setting('app.settings.<name>').

create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron with schema extensions;

-- Allow the trigger function to read the endpoint/secret from vault.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'supabase_admin') then
    null;
  end if;
end $$;

create or replace function public.sync_requirement_to_sheets()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  base_url text;
  service_key text;
  request_id bigint;
begin
  -- Read the function endpoint and service-role key from the vault, falling
  -- back to plain database settings for local/self-hosted setups.
  select decrypted_secret into base_url
    from vault.decrypted_secrets
   where name = 'function_url'
   limit 1;

  select decrypted_secret into service_key
    from vault.decrypted_secrets
   where name = 'service_role_key'
   limit 1;

  base_url := coalesce(base_url, current_setting('app.settings.function_url', true));
  service_key := coalesce(service_key, current_setting('app.settings.service_role_key', true));

  if base_url is null or service_key is null then
    raise warning 'Sheets sync skipped: vault secrets function_url / service_role_key not configured';
    return new;
  end if;

  perform net.http_post(
    url     := base_url || '/sync-requirement-to-sheets',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || service_key
    ),
    body    := jsonb_build_object('record', to_jsonb(new))
  );

  return new;
end;
$$;

drop trigger if exists trg_sync_requirement_to_sheets on public.requirement_submissions;

create trigger trg_sync_requirement_to_sheets
after insert on public.requirement_submissions
for each row
execute function public.sync_requirement_to_sheets();
