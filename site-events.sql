-- Visitor events for the public site.
-- The website may insert one scrubbed row. It cannot read, change, or delete rows.
-- No email is sent from this table.

create schema if not exists private;

revoke all on schema private from public;
revoke all on schema private from anon, authenticated;
grant usage on schema private to anon;

create or replace function private.site_events_scrub()
returns trigger
language plpgsql
set search_path = public
as $fn$
declare
  cleaned jsonb := '{}'::jsonb;
  rec record;
  txt text;
  i int;
  n int;
  maxn int;
  c int;
begin
  if new.props is null or jsonb_typeof(new.props) <> 'object' then
    new.props := '{}'::jsonb;
  end if;
  for rec in select key, value from jsonb_each(new.props)
  loop
    if rec.key in (
      'name', 'phone', 'email', 'address', 'notes', 'message', 'value',
      'company', 'telephone', 'comment', 'body', 'user_agent', 'ip'
    ) then
      continue;
    end if;
    if jsonb_typeof(rec.value) = 'number' or jsonb_typeof(rec.value) = 'boolean' then
      cleaned := cleaned || jsonb_build_object(rec.key, rec.value);
    elsif jsonb_typeof(rec.value) = 'string' then
      txt := rec.value #>> '{}';
      if position('@' in txt) > 0 then
        continue;
      end if;
      n := 0;
      maxn := 0;
      for i in 1..char_length(txt) loop
        c := ascii(substr(txt, i, 1));
        if c between 48 and 57 then
          n := n + 1;
          if n > maxn then
            maxn := n;
          end if;
        elsif c in (45, 40, 41, 46, 32, 43) then
          null;
        else
          n := 0;
        end if;
      end loop;
      if maxn >= 7 then
        continue;
      end if;
      if char_length(txt) > 80 then
        txt := left(txt, 80);
      end if;
      cleaned := cleaned || jsonb_build_object(rec.key, txt);
    end if;
  end loop;
  new.props := cleaned;
  new.path := split_part(split_part(coalesce(new.path, ''), '?', 1), '#', 1);
  return new;
end;
$fn$;

revoke all on function private.site_events_scrub() from public;
grant execute on function private.site_events_scrub() to anon;

create table if not exists public.site_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  sid text not null,
  step integer not null,
  event text not null,
  path text not null,
  client_ms bigint not null,
  props jsonb not null default '{}'::jsonb,
  constraint site_events_event_ok check (event in (
    'page_view', 'click', 'tel_click', 'mailto_click', 'scroll_depth', 'section_enter',
    'hover', 'focus', 'form_focus', 'quote_submit', 'quote_submit_ok', 'quote_submit_fail',
    'chat_open', 'chat_close', 'chat_send', 'quote_add', 'gallery_open', 'engage', 'page_leave',
    'call_start', 'call_end', 'quote_from_call'
  )),
  constraint site_events_step_ok check (step >= 1 and step <= 500),
  constraint site_events_sid_ok check (sid ~ '^[a-z0-9]{8,40}$'),
  constraint site_events_path_ok check (
    char_length(path) between 1 and 200
    and path ~ '^/[A-Za-z0-9_./-]*$'
  ),
  constraint site_events_props_ok check (
    jsonb_typeof(props) = 'object'
    and pg_column_size(props) <= 2000
  ),
  constraint site_events_client_ms_ok check (client_ms > 0 and client_ms < 20000000000000)
);

comment on table public.site_events is
  'Scrubbed visitor events from the public website. The website may add a row. It cannot read, change, or delete rows. This table does not email anyone.';

revoke all on table public.site_events from anon, authenticated;
grant insert on table public.site_events to anon;

drop trigger if exists site_events_scrub_trg on public.site_events;
create trigger site_events_scrub_trg
  before insert on public.site_events
  for each row execute function private.site_events_scrub();

alter table public.site_events enable row level security;

drop policy if exists "website can add a visitor event" on public.site_events;
create policy "website can add a visitor event"
  on public.site_events
  for insert
  to anon
  with check (
    event in (
      'page_view', 'click', 'tel_click', 'mailto_click', 'scroll_depth', 'section_enter',
      'hover', 'focus', 'form_focus', 'quote_submit', 'quote_submit_ok', 'quote_submit_fail',
      'chat_open', 'chat_close', 'chat_send', 'quote_add', 'gallery_open', 'engage', 'page_leave',
      'call_start', 'call_end', 'quote_from_call'
    )
    and step >= 1 and step <= 500
    and sid ~ '^[a-z0-9]{8,40}$'
    and char_length(path) between 1 and 200
    and path ~ '^/[A-Za-z0-9_./-]*$'
    and jsonb_typeof(props) = 'object'
    and pg_column_size(props) <= 2000
    and client_ms > 0
    and client_ms < 20000000000000
  );

create index if not exists site_events_created_at_idx on public.site_events (created_at desc);
create index if not exists site_events_sid_step_idx on public.site_events (sid, step);
create index if not exists site_events_event_created_idx on public.site_events (event, created_at desc);
create index if not exists site_events_path_created_idx on public.site_events (path, created_at desc);

notify pgrst, 'reload schema';
