-- HARBAN Storefront — Serverless Netlify / Supabase Client Checkout & Admin Helper
-- Safe & Idempotent: Run once in Supabase Dashboard -> SQL Editor

-- 1. Promote configured admin emails if already present in public.customers
update public.customers
set role = 'admin', updated_at = now()
where lower(email) in ('abhishekyadavinfo05@gmail.com', 'care@harban.in')
  and role <> 'admin';

-- 2. Allow anonymous/authenticated storefront visitors to log newsletter, contact & analytics safely
drop policy if exists "Public can subscribe newsletter" on public.newsletter_subscribers;
create policy "Public can subscribe newsletter"
  on public.newsletter_subscribers for insert
  with check (true);

drop policy if exists "Public can send contact message" on public.contact_messages;
create policy "Public can send contact message"
  on public.contact_messages for insert
  with check (true);

drop policy if exists "Public can log cart events" on public.cart_events;
create policy "Public can log cart events"
  on public.cart_events for insert
  with check (true);

drop policy if exists "Public can log product views" on public.product_views;
create policy "Public can log product views"
  on public.product_views for insert
  with check (true);

-- 3. Secure RPC for placing orders directly from Netlify / static frontend
create or replace function public.place_storefront_order(
  p_customer_name text,
  p_customer_email text,
  p_phone text,
  p_shipping_address jsonb,
  p_payment_method text default 'Cash on Delivery',
  p_payment_status text default 'pending',
  p_razorpay_order_id text default null,
  p_razorpay_payment_id text default null,
  p_items jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_item jsonb;
  v_prod record;
  v_qty integer;
  v_unit_price integer;
  v_subtotal integer := 0;
  v_max_num integer := 99;
  v_code text;
  v_existing_code text;
  v_num integer;
  v_uid text := nullif(auth.uid()::text, '');
  v_email text := lower(trim(coalesce(p_customer_email, '')));
  v_items_out jsonb := '[]'::jsonb;
  v_summary text := '';
  v_eta timestamptz := now() + interval '4 days';
  v_placed timestamptz := now();
begin
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Cart is empty.';
  end if;

  for v_existing_code in select order_code from public.orders loop
    if v_existing_code ~ '^HB[0-9]+$' then
      v_num := substring(v_existing_code from 3)::integer;
      if v_num > v_max_num then
        v_max_num := v_num;
      end if;
    end if;
  end loop;
  v_code := 'HB' || (v_max_num + 1)::text;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_qty := greatest(1, coalesce((v_item ->> 'qty')::integer, 1));
    select * into v_prod
    from public.products
    where id = (v_item ->> 'id')
      and is_active = true
    for update;

    if not found then
      raise exception 'Selected product is no longer available.';
    end if;
    if v_prod.stock < v_qty then
      raise exception 'Insufficient stock for %.', v_prod.name;
    end if;

    v_unit_price := v_prod.price;
    v_subtotal := v_subtotal + (v_unit_price * v_qty);

    update public.products
    set stock = stock - v_qty, updated_at = now()
    where id = v_prod.id;

    v_items_out := v_items_out || jsonb_build_array(jsonb_build_object(
      'id', v_prod.id,
      'name', v_prod.name,
      'image', v_prod.image,
      'sku', coalesce(v_item ->> 'sku', v_prod.sku),
      'variantLabel', v_item ->> 'variantLabel',
      'price', v_unit_price,
      'qty', v_qty,
      'fulfilledQty', 0
    ));

    if v_summary <> '' then
      v_summary := v_summary || ', ';
    end if;
    v_summary := v_summary || v_prod.name || ' x' || v_qty::text;
  end loop;

  insert into public.orders (
    order_code, customer_uid, customer_name, customer_email, phone,
    shipping_address, payment_method, payment_status,
    razorpay_order_id, razorpay_payment_id,
    subtotal, shipping, total, status, status_label, fulfillment_status,
    cancelled, items, items_summary, eta_at, placed_at
  ) values (
    v_code,
    v_uid,
    coalesce(nullif(trim(p_customer_name), ''), 'HARBAN Customer'),
    nullif(v_email, ''),
    coalesce(trim(p_phone), ''),
    p_shipping_address,
    coalesce(nullif(trim(p_payment_method), ''), 'Cash on Delivery'),
    coalesce(nullif(trim(p_payment_status), ''), 'pending'),
    p_razorpay_order_id,
    p_razorpay_payment_id,
    v_subtotal,
    0,
    v_subtotal,
    0,
    'Order placed',
    'pending',
    false,
    v_items_out,
    v_summary,
    v_eta,
    v_placed
  );

  insert into public.order_items (
    order_code, product_id, product_name, product_image, unit_price, qty, sku, variant_label
  )
  select
    v_code,
    (el ->> 'id'),
    (el ->> 'name'),
    coalesce(el ->> 'image', ''),
    (el ->> 'price')::integer,
    (el ->> 'qty')::integer,
    nullif(el ->> 'sku', ''),
    nullif(el ->> 'variantLabel', '')
  from jsonb_array_elements(v_items_out) as el;

  insert into public.payments (order_code, provider, method, amount, currency, status, razorpay_order_id, razorpay_payment_id, signature_verified)
  values (
    v_code,
    case when lower(coalesce(p_payment_method, '')) like '%razorpay%' then 'razorpay' else 'cod' end,
    coalesce(nullif(trim(p_payment_method), ''), 'Cash on Delivery'),
    v_subtotal,
    'INR',
    coalesce(nullif(trim(p_payment_status), ''), 'pending'),
    p_razorpay_order_id,
    p_razorpay_payment_id,
    coalesce(p_payment_status, '') = 'paid'
  );

  insert into public.fulfillments (order_code, status, notes)
  values (
    v_code,
    'pending',
    'Order placed via ' || coalesce(nullif(trim(p_payment_method), ''), 'Cash on Delivery')
  );

  return jsonb_build_object(
    'id', v_code,
    'customerUid', v_uid,
    'customerEmail', nullif(v_email, ''),
    'customerName', coalesce(nullif(trim(p_customer_name), ''), 'HARBAN Customer'),
    'phone', coalesce(trim(p_phone), ''),
    'shippingAddress', p_shipping_address,
    'paymentMethod', coalesce(nullif(trim(p_payment_method), ''), 'Cash on Delivery'),
    'paymentStatus', coalesce(nullif(trim(p_payment_status), ''), 'pending'),
    'subtotal', v_subtotal,
    'shipping', 0,
    'total', v_subtotal,
    'status', 0,
    'orderStatus', 'pending',
    'fulfillmentStatus', 'pending',
    'cancelled', false,
    'items', v_items_out,
    'placedAt', (extract(epoch from v_placed) * 1000)::bigint,
    'eta', (extract(epoch from v_eta) * 1000)::bigint
  );
end;
$$;

revoke all on function public.place_storefront_order(text, text, text, jsonb, text, text, text, text, jsonb) from public;
grant execute on function public.place_storefront_order(text, text, text, jsonb, text, text, text, text, jsonb) to anon, authenticated, service_role;

-- 4. Secure RPC for guest order tracking by order_code
create or replace function public.track_storefront_order(p_order_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ord record;
  v_timeline jsonb := '[]'::jsonb;
begin
  select * into v_ord
  from public.orders
  where upper(order_code) = upper(trim(coalesce(p_order_code, '')))
  limit 1;

  if not found then
    return null;
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', f.id,
    'status', f.status,
    'courierPartner', f.courier_partner,
    'trackingNumber', f.tracking_number,
    'trackingUrl', f.tracking_url,
    'notes', f.notes,
    'createdAt', (extract(epoch from f.created_at) * 1000)::bigint
  ) order by f.created_at asc), '[]'::jsonb)
  into v_timeline
  from public.fulfillments f
  where f.order_code = v_ord.order_code;

  return jsonb_build_object(
    'id', v_ord.order_code,
    'customerName', v_ord.customer_name,
    'paymentMethod', v_ord.payment_method,
    'paymentStatus', v_ord.payment_status,
    'subtotal', v_ord.subtotal,
    'shipping', v_ord.shipping,
    'total', v_ord.total,
    'status', v_ord.status,
    'orderStatus', coalesce(v_ord.fulfillment_status, 'pending'),
    'cancelled', v_ord.cancelled,
    'items', v_ord.items,
    'shippingAddress', v_ord.shipping_address,
    'timeline', v_timeline,
    'placedAt', (extract(epoch from v_ord.placed_at) * 1000)::bigint,
    'eta', (extract(epoch from v_ord.eta_at) * 1000)::bigint
  );
end;
$$;

revoke all on function public.track_storefront_order(text) from public;
grant execute on function public.track_storefront_order(text) to anon, authenticated, service_role;
