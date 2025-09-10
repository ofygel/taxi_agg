-- Database schema for taxi aggregation service

-- Users table
CREATE TABLE public.users (
  telegram_id BIGINT PRIMARY KEY,
  phone TEXT,
  first_name TEXT,
  username TEXT,
  role TEXT CHECK (role IN ('DRIVER','COURIER','CLIENT')),
  verify_status TEXT CHECK (verify_status IN ('PENDING','APPROVED','REJECTED')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users are self" ON public.users
  FOR ALL
  USING (telegram_id = (current_setting('request.jwt.claims', true)::jsonb->>'telegram_id')::bigint)
  WITH CHECK (telegram_id = (current_setting('request.jwt.claims', true)::jsonb->>'telegram_id')::bigint);

-- Profiles table
CREATE TABLE public.profiles (
  telegram_id BIGINT PRIMARY KEY,
  full_name TEXT,
  phone TEXT,
  car_model TEXT,
  car_number TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Profiles are self" ON public.profiles
  FOR ALL
  USING (telegram_id = (current_setting('request.jwt.claims', true)::jsonb->>'telegram_id')::bigint)
  WITH CHECK (telegram_id = (current_setting('request.jwt.claims', true)::jsonb->>'telegram_id')::bigint);

-- App settings
CREATE TABLE public.app_settings (
  key TEXT PRIMARY KEY,
  value TEXT
);

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read app settings" ON public.app_settings
  FOR SELECT
  USING (((current_setting('request.jwt.claims', true)::jsonb->>'telegram_id')::bigint IS NOT NULL));

-- Verifications
CREATE TABLE public.verifications (
  telegram_id BIGINT PRIMARY KEY,
  role TEXT CHECK (role IN ('DRIVER','COURIER','CLIENT')),
  status TEXT CHECK (status IN ('PENDING','APPROVED','REJECTED')),
  reason TEXT,
  files JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.verifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Verifications are self" ON public.verifications
  FOR ALL
  USING (telegram_id = (current_setting('request.jwt.claims', true)::jsonb->>'telegram_id')::bigint)
  WITH CHECK (telegram_id = (current_setting('request.jwt.claims', true)::jsonb->>'telegram_id')::bigint);

-- Subscriptions
CREATE TABLE public.subscriptions (
  telegram_id BIGINT PRIMARY KEY,
  until_ts TIMESTAMPTZ NOT NULL,
  plan_days INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Subscriptions are self" ON public.subscriptions
  FOR ALL
  USING (telegram_id = (current_setting('request.jwt.claims', true)::jsonb->>'telegram_id')::bigint)
  WITH CHECK (telegram_id = (current_setting('request.jwt.claims', true)::jsonb->>'telegram_id')::bigint);

-- Receipts
CREATE TABLE public.receipts (
  id BIGSERIAL PRIMARY KEY,
  telegram_id BIGINT NOT NULL,
  plan_days INTEGER NOT NULL,
  file JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.receipts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Receipts are self" ON public.receipts
  FOR ALL
  USING (telegram_id = (current_setting('request.jwt.claims', true)::jsonb->>'telegram_id')::bigint)
  WITH CHECK (telegram_id = (current_setting('request.jwt.claims', true)::jsonb->>'telegram_id')::bigint);

-- Orders
CREATE TABLE public.orders (
  id BIGSERIAL PRIMARY KEY,
  client_id BIGINT NOT NULL,
  driver_id BIGINT,
  kind TEXT CHECK (kind IN ('TAXI','DELIVERY')),
  from_text TEXT,
  from_lat DOUBLE PRECISION,
  from_lon DOUBLE PRECISION,
  to_text TEXT,
  to_lat DOUBLE PRECISION,
  to_lon DOUBLE PRECISION,
  comment_text TEXT,
  price_estimate NUMERIC,
  status TEXT CHECK (status IN ('NEW','TAKEN','CANCELLED','DONE')) DEFAULT 'NEW',
  channel_msg_id BIGINT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Orders visible to client or driver" ON public.orders
  FOR SELECT
  USING (
    client_id = (current_setting('request.jwt.claims', true)::jsonb->>'telegram_id')::bigint
    OR driver_id = (current_setting('request.jwt.claims', true)::jsonb->>'telegram_id')::bigint
  );

CREATE POLICY "Clients manage their orders" ON public.orders
  FOR INSERT
  WITH CHECK (client_id = (current_setting('request.jwt.claims', true)::jsonb->>'telegram_id')::bigint);

CREATE POLICY "Client or driver update own order" ON public.orders
  FOR UPDATE
  USING (
    client_id = (current_setting('request.jwt.claims', true)::jsonb->>'telegram_id')::bigint
    OR driver_id = (current_setting('request.jwt.claims', true)::jsonb->>'telegram_id')::bigint
  )
  WITH CHECK (
    client_id = (current_setting('request.jwt.claims', true)::jsonb->>'telegram_id')::bigint
    OR driver_id = (current_setting('request.jwt.claims', true)::jsonb->>'telegram_id')::bigint
  );

-- Media assets
CREATE TABLE public.media_assets (
  id BIGSERIAL PRIMARY KEY,
  owner_telegram_id BIGINT NOT NULL,
  kind TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_url TEXT,
  mime TEXT,
  meta JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.media_assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Media assets are self" ON public.media_assets
  FOR ALL
  USING (owner_telegram_id = (current_setting('request.jwt.claims', true)::jsonb->>'telegram_id')::bigint)
  WITH CHECK (owner_telegram_id = (current_setting('request.jwt.claims', true)::jsonb->>'telegram_id')::bigint);
