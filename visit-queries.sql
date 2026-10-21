-- Run these in the Supabase SQL editor for project bluegrassdoor.
-- Each block stands on its own. The window is the last 30 days.
-- The public website cannot run these. It can only add rows to site_events.
-- Paths are folded to a page name. The GitHub Pages folder prefix is ignored.
-- An empty result means no visits in the window, not a broken query.

-- 1. Top paths. One line is the page_view order for a browser tab.
with views as (
  select
    sid,
    step,
    case
      when regexp_replace(path, '^.*/', '') in ('', 'index.html') then 'home'
      else regexp_replace(path, '^.*/', '')
    end as page
  from public.site_events
  where event = 'page_view'
    and created_at > now() - interval '30 days'
),
seqs as (
  select sid, string_agg(page, ' > ' order by step) as path_taken
  from views
  group by sid
)
select path_taken, count(*) as sessions
from seqs
group by path_taken
order by sessions desc, path_taken
limit 40;

-- 2. Pages with no page view in the window.
with catalog(page) as (
  values
    ('home'),
    ('flagpoles.html'),
    ('start.html'),
    ('request.html'),
    ('visit-review.html')
),
seen as (
  select distinct
    case
      when regexp_replace(path, '^.*/', '') in ('', 'index.html') then 'home'
      else regexp_replace(path, '^.*/', '')
    end as page
  from public.site_events
  where event = 'page_view'
    and created_at > now() - interval '30 days'
)
select c.page as not_visited
from catalog c
left join seen s on s.page = c.page
where s.page is null
order by c.page;

-- 3. Clicks by control. tel_click and mailto_click have no number and no address.
select
  case
    when regexp_replace(path, '^.*/', '') in ('', 'index.html') then 'home'
    else regexp_replace(path, '^.*/', '')
  end as page,
  event,
  coalesce(props->>'control', props->>'kind', props->>'item', '') as control,
  coalesce(props->>'where', '') as place,
  count(*) as clicks
from public.site_events
where event in ('click', 'tel_click', 'mailto_click', 'quote_add', 'gallery_open', 'chat_open', 'chat_close')
  and created_at > now() - interval '30 days'
group by 1, 2, 3, 4
order by clicks desc, page, event;

-- 4. Sections with no entry. These are the section ids on the site.
with catalog(section_id) as (
  values
    ('builder'),
    ('codes'),
    ('services'),
    ('about'),
    ('reviews'),
    ('projects'),
    ('area'),
    ('contact'),
    ('quote')
),
seen as (
  select distinct props->>'section' as section_id
  from public.site_events
  where event = 'section_enter'
    and created_at > now() - interval '30 days'
)
select c.section_id as not_entered
from catalog c
left join seen s on s.section_id = c.section_id
where s.section_id is null
order by c.section_id;

-- 5. Median visible seconds on a page, from page_leave.
select
  case
    when regexp_replace(path, '^.*/', '') in ('', 'index.html') then 'home'
    else regexp_replace(path, '^.*/', '')
  end as page,
  count(*) as leaves,
  percentile_cont(0.5) within group (order by (props->>'seconds')::numeric) as median_seconds
from public.site_events
where event = 'page_leave'
  and created_at > now() - interval '30 days'
  and (props->>'seconds') ~ '^[0-9]+$'
group by 1
order by median_seconds desc nulls last, page;

-- 6. Engage marks (15, 30, 60, 120, 300 visible seconds) by page.
select
  case
    when regexp_replace(path, '^.*/', '') in ('', 'index.html') then 'home'
    else regexp_replace(path, '^.*/', '')
  end as page,
  (props->>'seconds')::numeric as seconds,
  count(*) as sessions
from public.site_events
where event = 'engage'
  and created_at > now() - interval '30 days'
  and (props->>'seconds') ~ '^[0-9]+$'
group by 1, 2
order by page, seconds;

-- 7. Scroll depth reached, by page.
select
  case
    when regexp_replace(path, '^.*/', '') in ('', 'index.html') then 'home'
    else regexp_replace(path, '^.*/', '')
  end as page,
  (props->>'pct')::numeric as depth_pct,
  count(*) as sessions
from public.site_events
where event = 'scroll_depth'
  and created_at > now() - interval '30 days'
  and (props->>'pct') ~ '^[0-9]+$'
group by 1, 2
order by page, depth_pct;

-- 8. Exit pages. The last page_leave in each tab.
select page, count(*) as sessions
from (
  select distinct on (sid)
    case
      when regexp_replace(path, '^.*/', '') in ('', 'index.html') then 'home'
      else regexp_replace(path, '^.*/', '')
    end as page
  from public.site_events
  where event = 'page_leave'
    and created_at > now() - interval '30 days'
  order by sid, step desc
) exits
group by page
order by sessions desc, page;

-- 9. Quote steps. A tab can focus a form, add a shop item, send, and save or fail.
with s as (
  select
    sid,
    bool_or(event = 'page_view') as saw_page,
    bool_or(event = 'form_focus' and coalesce(props->>'form', '') in (
      'quote-form', 'qlist-form', 'fp-form', 'door-form', 'flagpole-form'
    )) as focused_form,
    bool_or(event = 'quote_add') as added_item,
    bool_or(event = 'quote_submit') as submitted,
    bool_or(event = 'quote_submit_ok') as saved,
    bool_or(event = 'quote_submit_fail') as failed
  from public.site_events
  where created_at > now() - interval '30 days'
  group by sid
)
select
  count(*) filter (where saw_page) as sessions,
  count(*) filter (where focused_form) as focused_a_quote_form,
  count(*) filter (where added_item) as added_a_shop_item,
  count(*) filter (where submitted) as submit_started,
  count(*) filter (where saved) as saved,
  count(*) filter (where failed and not saved) as failed_only
from s;

-- 10. Dory. Opened the chat, then sent a message. The message text is not stored.
with s as (
  select
    sid,
    bool_or(event = 'chat_open') as opened,
    bool_or(event = 'chat_send') as sent
  from public.site_events
  where created_at > now() - interval '30 days'
  group by sid
)
select
  count(*) filter (where opened) as opened_dory,
  count(*) filter (where opened and sent) as sent_a_message,
  case
    when count(*) filter (where opened) = 0 then null
    else round(
      100.0 * count(*) filter (where opened and sent)
      / count(*) filter (where opened),
      1
    )
  end as send_rate_pct
from s;

-- 11. Ordered steps for one tab. Replace the sid before running.
-- select step, created_at, to_timestamp(client_ms / 1000.0) as client_time, event, path, props
-- from public.site_events
-- where sid = 'paste-a-sid-from-query-1'
-- order by step;
