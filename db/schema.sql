-- Roblox AI Assistant Database Schema
-- Supabase/PostgreSQL - Run these queries in Supabase SQL Editor

-- ============================================
-- TABLE: users
-- ============================================
-- Stores user accounts and their authentication info
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL, -- bcrypt hashed
  display_name TEXT,
  avatar_url TEXT,
  
  -- API Token Management
  api_token TEXT UNIQUE NOT NULL, -- "sk_roblox_" + 48-char hex
  api_token_hash TEXT NOT NULL, -- SHA-256 hash of token (for DB lookups)
  api_token_created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  api_token_last_used TIMESTAMP,
  api_token_is_active BOOLEAN DEFAULT TRUE,
  
  -- Usage Statistics
  total_generations INT DEFAULT 0,
  total_tokens_used INT DEFAULT 0,
  last_api_call TIMESTAMP,
  
  -- Preferences
  preferred_language TEXT DEFAULT 'lua',
  dark_mode BOOLEAN DEFAULT TRUE,
  email_notifications BOOLEAN DEFAULT FALSE,
  
  -- Account Status
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP,
  
  -- Rate Limiting
  rate_limit_resets_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index for fast token lookups
CREATE INDEX idx_users_api_token_hash ON users(api_token_hash) WHERE api_token_is_active = TRUE;
CREATE INDEX idx_users_email ON users(email);

-- ============================================
-- TABLE: generations_history
-- ============================================
-- Stores every code generation request and response
CREATE TABLE generations_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Request Details
  prompt TEXT NOT NULL,
  context_code TEXT, -- Original code user selected/highlighted
  request_type TEXT NOT NULL CHECK (request_type IN ('create', 'edit')), -- 'create' or 'edit'
  source_script_name TEXT, -- e.g., "ServerScript1", "LocalScript"
  
  -- Response Details
  generated_code TEXT NOT NULL,
  tokens_used INT NOT NULL, -- Gemini API tokens consumed
  
  -- Metadata
  status TEXT DEFAULT 'success' CHECK (status IN ('success', 'error', 'rate_limited')),
  error_message TEXT,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- Model Info
  model_used TEXT DEFAULT 'gemini-1.5-flash-latest',
  generation_time_ms INT -- How long Gemini took to respond
);

-- Indexes for fast historical queries
CREATE INDEX idx_generations_user_id ON generations_history(user_id);
CREATE INDEX idx_generations_created_at ON generations_history(created_at DESC);
CREATE INDEX idx_generations_user_created ON generations_history(user_id, created_at DESC);

-- ============================================
-- TABLE: api_tokens_archive
-- ============================================
-- Archive of revoked/regenerated tokens for audit trail
CREATE TABLE api_tokens_archive (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL,
  revoked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  reason TEXT -- 'manual_revoke', 'token_regenerate', 'security_breach'
);

-- ============================================
-- TABLE: rate_limit_logs
-- ============================================
-- Track API calls for rate limiting
CREATE TABLE rate_limit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL, -- '/api/generate', etc.
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  status_code INT,
  response_time_ms INT
);

CREATE INDEX idx_rate_limit_user_timestamp ON rate_limit_logs(user_id, timestamp DESC);

-- ============================================
-- FUNCTIONS & TRIGGERS
-- ============================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to users table
CREATE TRIGGER users_updated_at_trigger
BEFORE UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Apply trigger to generations_history table
CREATE TRIGGER generations_updated_at_trigger
BEFORE UPDATE ON generations_history
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================
-- Enable RLS for security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE generations_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_tokens_archive ENABLE ROW LEVEL SECURITY;
ALTER TABLE rate_limit_logs ENABLE ROW LEVEL SECURITY;

-- Users can only see their own data
CREATE POLICY "Users can view own record"
  ON users
  FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own record"
  ON users
  FOR UPDATE
  USING (auth.uid() = id);

-- Users can only see their own generation history
CREATE POLICY "Users can view own generations"
  ON generations_history
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own generations"
  ON generations_history
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- ============================================
-- VIEWS
-- ============================================

-- View for user dashboard stats
CREATE VIEW user_stats AS
SELECT 
  u.id,
  u.username,
  u.total_generations,
  u.total_tokens_used,
  COUNT(gh.id) as generation_count_30d,
  SUM(gh.tokens_used) as tokens_used_30d,
  MAX(gh.created_at) as last_generation
FROM users u
LEFT JOIN generations_history gh ON u.id = gh.user_id 
  AND gh.created_at > CURRENT_TIMESTAMP - INTERVAL '30 days'
GROUP BY u.id, u.username, u.total_generations, u.total_tokens_used;

-- ============================================
-- SEED DATA (OPTIONAL - FOR TESTING)
-- ============================================
-- Uncomment to add test user
/*
INSERT INTO users (email, username, password_hash, api_token, api_token_hash, display_name)
VALUES (
  'test@example.com',
  'testuser',
  '$2b$12$...',  -- bcrypt hash of 'password123'
  'sk_roblox_abc123def456...',
  'SHA256_HASH_OF_TOKEN',
  'Test User'
);
*/
