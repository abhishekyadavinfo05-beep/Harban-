-- ============================================================================
-- HARBAN Grooming Storefront — Safe Non-Destructive RLS & Index Migration
-- ============================================================================
-- Target: Existing Supabase database (preserves all tables and existing data)
-- Usage : Paste into Supabase Dashboard -> SQL Editor and click Run.
-- Notes : Server-side sync routes use SUPABASE_SERVICE_ROLE_KEY (bypasses RLS).
--         Direct client/anon/authenticated requests are strictly locked down.
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- 1. Performance & Relational Indexes (Safe / Idempotent)
-- ----------------------------------------------------------------------------
create index if not exists idx_products_category_active
  on public.products (category, is_active, sort_order);

create index if not exists idx_customers_email_lower
  on public.customers (lower(email));

create index if not exists idx_customer_addresses_uid
  on public.customer_addresses (customer_uid);

create index if not exists idx_orders_customer_uid
  on public.orders (customer_uid);

create index if not exists idx_orders_customer_email_lower
  on public.orders (lower(customer_email));

create index if not exists idx_orders_placed_at
  on public.orders (placed_at desc);

create index if not exists idx_orders_razorpay_order_id
  on public.orders (razorpay_order_id)
  where razorpay_order_id is not null;

create index if not exists idx_order_items_order_code
  on public.order_items (order_code);

create index if not exists idx_cart_events_created_at
  on public.cart_events (created_at desc);

create index if not exists idx_product_views_created_at
  on public.product_views (created_at desc);

-- ----------------------------------------------------------------------------
-- 2. Security Helper Functions (No RLS Recursion, Safe search_path)
-- ----------------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select (
    auth.role() = 'service_role'
    or (
      auth.uid() is not null
      and exists (
        select 1
        from public.customers c
        where c.role = 'admin'
          and (
            c.uid = auth.uid()::text
            or (
              lower(c.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
              and coalesce((auth.jwt() ->> 'email_verified')::boolean, false) = true
            )
          )
      )
    )
  );
$$;

create or replace function public.is_owner_uid_or_email(
  target_uid text,
  target_email text
)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select (
    auth.uid() is not null
    and (
      (target_uid is not null and target_uid = auth.uid()::text)
      or (
        target_email is not null
        and lower(target_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
        and coalesce((auth.jwt() ->> 'email_verified')::boolean, false) = true
      )
    )
  );
$$;

create or replace function public.get_customer_role(target_uid text)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select c.role from public.customers c where c.uid = target_uid limit 1;
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated, service_role;

revoke all on function public.is_owner_uid_or_email(text, text) from public;
grant execute on function public.is_owner_uid_or_email(text, text) to anon, authenticated, service_role;

revoke all on function public.get_customer_role(text) from public;
grant execute on function public.get_customer_role(text) to authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 3. Ensure RLS Is Enabled on Every Public Table
-- ----------------------------------------------------------------------------
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.reviews enable row level security;
alter table public.faqs enable row level security;
alter table public.customers enable row level security;
alter table public.customer_addresses enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.cart_events enable row level security;
alter table public.product_views enable row level security;
alter table public.newsletter_subscribers enable row level security;
alter table public.contact_messages enable row level security;

-- ----------------------------------------------------------------------------
-- 4. Drop Legacy Permissive Policies (Preserves Tables & Data)
-- ----------------------------------------------------------------------------
-- Categories
drop policy if exists "Public can read categories" on public.categories;
drop policy if exists "Storefront & admin manage categories" on public.categories;
drop policy if exists "Admins insert categories" on public.categories;
drop policy if exists "Admins update categories" on public.categories;
drop policy if exists "Admins delete categories" on public.categories;

-- Products
drop policy if exists "Public can read active products" on public.products;
drop policy if exists "Storefront & admin manage products" on public.products;
drop policy if exists "Admins insert products" on public.products;
drop policy if exists "Admins update products" on public.products;
drop policy if exists "Admins delete products" on public.products;

-- Reviews & FAQs
drop policy if exists "Public can read reviews" on public.reviews;
drop policy if exists "Storefront insert reviews" on public.reviews;
drop policy if exists "Admins manage reviews" on public.reviews;

drop policy if exists "Public can read faqs" on public.faqs;
drop policy if exists "Storefront insert faqs" on public.faqs;
drop policy if exists "Admins manage faqs" on public.faqs;

-- Customers & Addresses
drop policy if exists "Customers sync read" on public.customers;
drop policy if exists "Customers insert" on public.customers;
drop policy if exists "Customers update" on public.customers;
drop policy if exists "Customers read own or admin" on public.customers;
drop policy if exists "Customers insert own or admin" on public.customers;
drop policy if exists "Customers update own or admin" on public.customers;
drop policy if exists "Customers delete admin only" on public.customers;

drop policy if exists "Addresses sync read" on public.customer_addresses;
drop policy if exists "Addresses insert" on public.customer_addresses;
drop policy if exists "Addresses update" on public.customer_addresses;
drop policy if exists "Addresses delete" on public.customer_addresses;
drop policy if exists "Addresses read own or admin" on public.customer_addresses;
drop policy if exists "Addresses insert own or admin" on public.customer_addresses;
drop policy if exists "Addresses update own or admin" on public.customer_addresses;
drop policy if exists "Addresses delete own or admin" on public.customer_addresses;

-- Orders & Order Items
drop policy if exists "Orders read" on public.orders;
drop policy if exists "Orders create" on public.orders;
drop policy if exists "Orders update" on public.orders;
drop policy if exists "Orders read own or admin" on public.orders;
drop policy if exists "Orders insert admin only" on public.orders;
drop policy if exists "Orders update admin only" on public.orders;
drop policy if exists "Orders delete admin only" on public.orders;

drop policy if exists "Order items read" on public.order_items;
drop policy if exists "Order items create" on public.order_items;
drop policy if exists "Order items read own or admin" on public.order_items;
drop policy if exists "Order items write admin only" on public.order_items;

-- Telemetry, Newsletter & Contact
drop policy if exists "Cart events insert" on public.cart_events;
drop policy if exists "Cart events read" on public.cart_events;
drop policy if exists "Cart events admin only" on public.cart_events;

drop policy if exists "Product views insert" on public.product_views;
drop policy if exists "Product views read" on public.product_views;
drop policy if exists "Product views admin only" on public.product_views;

drop policy if exists "Newsletter insert" on public.newsletter_subscribers;
drop policy if exists "Newsletter read" on public.newsletter_subscribers;
drop policy if exists "Newsletter admin only" on public.newsletter_subscribers;

drop policy if exists "Contact insert" on public.contact_messages;
drop policy if exists "Contact read" on public.contact_messages;
drop policy if exists "Contact messages admin only" on public.contact_messages;

-- Storage
drop policy if exists "Public can view product images" on storage.objects;
drop policy if exists "Allow upload product images" on storage.objects;
drop policy if exists "Allow update product images" on storage.objects;
drop policy if exists "Admins can upload product images" on storage.objects;
drop policy if exists "Admins can update product images" on storage.objects;
drop policy if exists "Admins can delete product images" on storage.objects;

-- ----------------------------------------------------------------------------
-- 5. Hardened Row Level Security (RLS) Policies
-- ----------------------------------------------------------------------------

-- 5.1 Categories: Public read; only admins can create, update, or delete
create policy "Public can read categories"
  on public.categories for select
  using (true);

create policy "Admins insert categories"
  on public.categories for insert
  with check (public.is_admin());

create policy "Admins update categories"
  on public.categories for update
  using (public.is_admin())
  with check (public.is_admin());

create policy "Admins delete categories"
  on public.categories for delete
  using (public.is_admin());

-- 5.2 Products: Public read ONLY active products; only admins manage catalog
create policy "Public can read active products"
  on public.products for select
  using (is_active = true or public.is_admin());

create policy "Admins insert products"
  on public.products for insert
  with check (public.is_admin());

create policy "Admins update products"
  on public.products for update
  using (public.is_admin())
  with check (public.is_admin());

create policy "Admins delete products"
  on public.products for delete
  using (public.is_admin());

-- 5.3 Reviews & FAQs: Public read; only admins modify
create policy "Public can read reviews"
  on public.reviews for select
  using (true);

create policy "Admins manage reviews"
  on public.reviews for all
  using (public.is_admin())
  with check (public.is_admin());

create policy "Public can read faqs"
  on public.faqs for select
  using (true);

create policy "Admins manage faqs"
  on public.faqs for all
  using (public.is_admin())
  with check (public.is_admin());

-- 5.4 Customers: Own profile only (and cannot self-escalate role to admin); admins full access
create policy "Customers read own or admin"
  on public.customers for select
  using (public.is_admin() or public.is_owner_uid_or_email(uid, email));

create policy "Customers insert own or admin"
  on public.customers for insert
  with check (
    public.is_admin()
    or (
      public.is_owner_uid_or_email(uid, email)
      and role = 'customer'
    )
  );

create policy "Customers update own or admin"
  on public.customers for update
  using (public.is_admin() or public.is_owner_uid_or_email(uid, email))
  with check (
    public.is_admin()
    or (
      public.is_owner_uid_or_email(uid, email)
      and role = public.get_customer_role(uid)
    )
  );

create policy "Customers delete admin only"
  on public.customers for delete
  using (public.is_admin());

-- 5.5 Customer Addresses: Own addresses only; admins full access
create policy "Addresses read own or admin"
  on public.customer_addresses for select
  using (public.is_admin() or public.is_owner_uid_or_email(customer_uid, customer_email));

create policy "Addresses insert own or admin"
  on public.customer_addresses for insert
  with check (public.is_admin() or public.is_owner_uid_or_email(customer_uid, customer_email));

create policy "Addresses update own or admin"
  on public.customer_addresses for update
  using (public.is_admin() or public.is_owner_uid_or_email(customer_uid, customer_email))
  with check (public.is_admin() or public.is_owner_uid_or_email(customer_uid, customer_email));

create policy "Addresses delete own or admin"
  on public.customer_addresses for delete
  using (public.is_admin() or public.is_owner_uid_or_email(customer_uid, customer_email));

-- 5.6 Orders & Payment Records:
--     Customers can ONLY read their own orders; no client-side insert/update/delete
--     of orders or Razorpay payment fields (handled exclusively by backend service_role or admin).
create policy "Orders read own or admin"
  on public.orders for select
  using (public.is_admin() or public.is_owner_uid_or_email(customer_uid, customer_email));

create policy "Orders insert admin only"
  on public.orders for insert
  with check (public.is_admin());

create policy "Orders update admin only"
  on public.orders for update
  using (public.is_admin())
  with check (public.is_admin());

create policy "Orders delete admin only"
  on public.orders for delete
  using (public.is_admin());

-- 5.7 Order Items: Read own order items or admin; write strictly admin/service_role
create policy "Order items read own or admin"
  on public.order_items for select
  using (
    public.is_admin()
    or exists (
      select 1
      from public.orders o
      where o.order_code = order_items.order_code
        and public.is_owner_uid_or_email(o.customer_uid, o.customer_email)
    )
  );

create policy "Order items write admin only"
  on public.order_items for all
  using (public.is_admin())
  with check (public.is_admin());

-- 5.8 Cart Events & Product Views: Strictly admin/service_role (no public table access)
create policy "Cart events admin only"
  on public.cart_events for all
  using (public.is_admin())
  with check (public.is_admin());

create policy "Product views admin only"
  on public.product_views for all
  using (public.is_admin())
  with check (public.is_admin());

-- 5.9 Newsletter Subscribers & Contact Messages: Strictly admin/service_role
create policy "Newsletter admin only"
  on public.newsletter_subscribers for all
  using (public.is_admin())
  with check (public.is_admin());

create policy "Contact messages admin only"
  on public.contact_messages for all
  using (public.is_admin())
  with check (public.is_admin());

-- ----------------------------------------------------------------------------
-- 6. Storage Bucket & Secured Product Image Upload Policies
-- ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do update set public = true;

create policy "Public can view product images"
  on storage.objects for select
  using (bucket_id = 'product-images');

create policy "Admins can upload product images"
  on storage.objects for insert
  with check (bucket_id = 'product-images' and public.is_admin());

create policy "Admins can update product images"
  on storage.objects for update
  using (bucket_id = 'product-images' and public.is_admin())
  with check (bucket_id = 'product-images' and public.is_admin());

create policy "Admins can delete product images"
  on storage.objects for delete
  using (bucket_id = 'product-images' and public.is_admin());

commit;
