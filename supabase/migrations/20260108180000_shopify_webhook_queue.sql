create table if not exists processed_webhooks (
  webhook_id text primary key,
  topic text not null,
  shop text not null,
  received_at timestamptz not null default now()
);

create table if not exists webhook_logs (
  id uuid primary key default gen_random_uuid(),
  webhook_id text null,
  topic text not null,
  shop text not null,
  order_id text null,
  payload jsonb not null,
  status text not null,
  error jsonb null,
  created_at timestamptz not null default now()
);

create index if not exists idx_webhook_logs_created_at on webhook_logs(created_at);
create index if not exists idx_webhook_logs_webhook_id on webhook_logs(webhook_id);

create table if not exists webhook_rate_limits (
  ip text not null,
  window_start timestamptz not null,
  count integer not null default 0,
  primary key (ip, window_start)
);

create table if not exists shopify_webhook_jobs (
  id uuid primary key default gen_random_uuid(),
  webhook_id text not null,
  topic text not null,
  shop text not null,
  order_id text null,
  payload jsonb not null,
  status text not null default 'queued', 
  attempts integer not null default 0,
  max_attempts integer not null default 8,
  run_at timestamptz not null default now(),
  last_attempt_at timestamptz null,
  locked_at timestamptz null,
  locked_by text null,
  last_error jsonb null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_shopify_webhook_jobs_webhook_id on shopify_webhook_jobs(webhook_id);
create index if not exists idx_shopify_webhook_jobs_status_run_at on shopify_webhook_jobs(status, run_at);

create table if not exists failed_webhook_jobs (
  id uuid primary key default gen_random_uuid(),
  webhook_job_id uuid null,
  webhook_id text null,
  topic text not null,
  shop text not null,
  order_id text null,
  payload jsonb not null,
  error jsonb not null,
  attempts integer not null,
  last_attempt_at timestamptz null,
  created_at timestamptz not null default now()
);

create index if not exists idx_failed_webhook_jobs_created_at on failed_webhook_jobs(created_at);

create table if not exists shopify_variant_map (
  shopify_variant_id bigint primary key,
  product_id uuid not null references products(id) on delete cascade
);

create index if not exists idx_shopify_variant_map_product_id on shopify_variant_map(product_id);

create table if not exists inventory_conflicts (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  attempted_delta numeric not null,
  result_quantity numeric not null,
  context jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_inventory_conflicts_created_at on inventory_conflicts(created_at);

create table if not exists webhook_inventory_effects (
  webhook_id text not null,
  product_id uuid not null references products(id) on delete cascade,
  delta numeric not null,
  context jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  primary key (webhook_id, product_id)
);

create index if not exists idx_webhook_inventory_effects_created_at on webhook_inventory_effects(created_at);

create or replace view inventory_levels as
select
  i.id,
  i.productid as product_id,
  i.quantityonhand as quantity_on_hand,
  i.lastupdated as last_updated
from inventory i;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'inventory_productid_unique'
  ) then
    alter table inventory
    add constraint inventory_productid_unique unique (productid);
  end if;
end $$;

create or replace function adjust_inventory_quantity(
  p_product_id uuid,
  p_delta numeric,
  p_context jsonb default '{}'::jsonb
)
returns table (
  product_id uuid,
  old_quantity numeric,
  new_quantity numeric,
  clamped boolean
)
language plpgsql
as $$
declare
  inv_row inventory%rowtype;
  next_qty numeric;
begin
  select * into inv_row
  from inventory
  where productid = p_product_id
  for update;

  if not found then
    insert into inventory (productid, quantityonhand, averagecostgbp, lastupdated)
    values (p_product_id, 0, 0, now())
    on conflict (productid) do update
      set lastupdated = excluded.lastupdated
    returning * into inv_row;
  end if;

  next_qty := coalesce(inv_row.quantityonhand, 0) + coalesce(p_delta, 0);

  clamped := next_qty < 0;
  if clamped then
    next_qty := 0;
  end if;

  update inventory
  set quantityonhand = next_qty,
      lastupdated = now()
  where id = inv_row.id;

  if clamped then
    insert into inventory_conflicts (product_id, attempted_delta, result_quantity, context)
    values (p_product_id, p_delta, next_qty, p_context);
  end if;

  product_id := p_product_id;
  old_quantity := coalesce(inv_row.quantityonhand, 0);
  new_quantity := next_qty;
  return next;
end;
$$;

create or replace function apply_shopify_inventory_effect(
  p_webhook_id text,
  p_product_id uuid,
  p_delta numeric,
  p_context jsonb default '{}'::jsonb
)
returns table (
  applied boolean,
  product_id uuid,
  old_quantity numeric,
  new_quantity numeric,
  clamped boolean
)
language plpgsql
as $$
declare
  effect_row webhook_inventory_effects%rowtype;
begin
  insert into webhook_inventory_effects (webhook_id, product_id, delta, context)
  values (p_webhook_id, p_product_id, p_delta, p_context)
  on conflict (webhook_id, product_id) do nothing
  returning * into effect_row;

  if not found then
    applied := false;
    product_id := p_product_id;
    old_quantity := null;
    new_quantity := null;
    clamped := false;
    return next;
    return;
  end if;

  applied := true;
  return query
  select true, r.product_id, r.old_quantity, r.new_quantity, r.clamped
  from adjust_inventory_quantity(p_product_id, p_delta, p_context) as r;
end;
$$;

create or replace function ratelimit_shopify_webhook(
  p_ip text,
  p_limit integer,
  p_window_seconds integer
)
returns boolean
language plpgsql
as $$
declare
  w_start timestamptz;
  new_count integer;
begin
  if p_ip is null or length(p_ip) = 0 then
    return true;
  end if;

  w_start := date_trunc('second', now()) - make_interval(secs => (extract(epoch from now())::int % greatest(p_window_seconds, 1)));

  insert into webhook_rate_limits(ip, window_start, count)
  values (p_ip, w_start, 1)
  on conflict (ip, window_start) do update
    set count = webhook_rate_limits.count + 1
  returning count into new_count;

  return new_count <= p_limit;
end;
$$;

create or replace function claim_shopify_webhook_jobs(
  p_max_jobs integer,
  p_worker_id text
)
returns setof shopify_webhook_jobs
language plpgsql
as $$
begin
  return query
  with candidate as (
    select id
    from shopify_webhook_jobs
    where status = 'queued'
      and run_at <= now()
    order by run_at asc, created_at asc
    limit greatest(p_max_jobs, 0)
    for update skip locked
  ), updated as (
    update shopify_webhook_jobs j
    set status = 'processing',
        attempts = j.attempts + 1,
        last_attempt_at = now(),
        locked_at = now(),
        locked_by = p_worker_id,
        updated_at = now()
    where j.id in (select id from candidate)
    returning j.*
  )
  select * from updated;
end;
$$;

alter table processed_webhooks disable row level security;
alter table webhook_logs disable row level security;
alter table webhook_rate_limits disable row level security;
alter table shopify_webhook_jobs disable row level security;
alter table failed_webhook_jobs disable row level security;
alter table shopify_variant_map disable row level security;
alter table inventory_conflicts disable row level security;
alter table webhook_inventory_effects disable row level security;
