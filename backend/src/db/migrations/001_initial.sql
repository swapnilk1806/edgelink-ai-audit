CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  website_url text NOT NULL,
  business_type text NOT NULL,
  business_location text NOT NULL,
  contact_name text NOT NULL,
  contact_email text NOT NULL,
  contact_phone text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  role text NOT NULL CHECK (role IN ('admin','client')),
  client_id uuid REFERENCES clients(id) ON DELETE CASCADE,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((role='client' AND client_id IS NOT NULL) OR (role='admin' AND client_id IS NULL))
);

CREATE TABLE IF NOT EXISTS audits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  website_url text NOT NULL,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','running','completed','failed')),
  progress integer NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
  error_message text,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS audit_results (
  audit_id uuid PRIMARY KEY REFERENCES audits(id) ON DELETE CASCADE,
  result_json jsonb NOT NULL,
  source_data jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS audit_reports (
  audit_id uuid PRIMARY KEY REFERENCES audits(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_users_client_id ON users(client_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_lower ON users(lower(email));
CREATE INDEX IF NOT EXISTS idx_audits_client_created ON audits(client_id,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audits_status_created ON audits(status,created_at DESC);
