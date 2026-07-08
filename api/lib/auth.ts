import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

/**
 * Hash a token for secure storage
 * Using SHA-256 for fast lookups (not password hashing)
 */
export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Generate a unique API token for a user
 * Format: sk_roblox_<48 random hex chars>
 */
export function generateToken(): string {
  const randomBytes = crypto.randomBytes(24).toString('hex');
  return `sk_roblox_${randomBytes}`;
}

interface ValidateTokenResponse {
  valid: boolean;
  userId?: string;
  error?: string;
}

/**
 * Validate a plugin token and return the associated user ID
 * This is called on every API request from the plugin
 */
export async function validateToken(
  token: string
): Promise<ValidateTokenResponse> {
  if (!token || !token.startsWith('sk_roblox_')) {
    return { valid: false, error: 'Invalid token format' };
  }

  try {
    const tokenHash = hashToken(token);

    const { data, error } = await supabase
      .from('users')
      .select('id, api_token_is_active, rate_limit_resets_at')
      .eq('api_token_hash', tokenHash)
      .eq('api_token_is_active', true)
      .single();

    if (error || !data) {
      return { valid: false, error: 'Token not found or invalid' };
    }

    // Update last used timestamp
    await supabase
      .from('users')
      .update({ api_token_last_used: new Date().toISOString() })
      .eq('id', data.id);

    return { valid: true, userId: data.id };
  } catch (error) {
    console.error('Token validation error:', error);
    return { valid: false, error: 'Database error' };
  }
}

interface RateLimitResponse {
  allowed: boolean;
  remainingRequests: number;
  resetTime?: Date;
  error?: string;
}

/**
 * Check rate limiting for a user
 * Free tier: 30 requests per minute, 500 per day
 */
export async function checkRateLimit(
  userId: string
): Promise<RateLimitResponse> {
  try {
    const now = new Date();
    const oneMinuteAgo = new Date(now.getTime() - 60000);
    const oneDayAgo = new Date(now.getTime() - 86400000);

    // Check per-minute limit
    const { count: minuteCount } = await supabase
      .from('rate_limit_logs')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gt('timestamp', oneMinuteAgo.toISOString());

    const remainingMinute = Math.max(
      0,
      (process.env.RATE_LIMIT_REQUESTS ? parseInt(process.env.RATE_LIMIT_REQUESTS) : 30) -
        (minuteCount || 0)
    );

    if (remainingMinute <= 0) {
      return {
        allowed: false,
        remainingRequests: 0,
        resetTime: new Date(now.getTime() + 60000),
        error: 'Rate limit exceeded. Try again in 60 seconds.',
      };
    }

    // Check daily limit
    const { count: dailyCount } = await supabase
      .from('rate_limit_logs')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gt('timestamp', oneDayAgo.toISOString());

    const remainingDaily = Math.max(
      0,
      (process.env.RATE_LIMIT_DAILY_MAX ? parseInt(process.env.RATE_LIMIT_DAILY_MAX) : 500) -
        (dailyCount || 0)
    );

    if (remainingDaily <= 0) {
      return {
        allowed: false,
        remainingRequests: 0,
        resetTime: new Date(now.getTime() + 86400000),
        error: 'Daily limit exceeded. Try again tomorrow.',
      };
    }

    return {
      allowed: true,
      remainingRequests: Math.min(remainingMinute, remainingDaily),
    };
  } catch (error) {
    console.error('Rate limit check error:', error);
    return {
      allowed: false,
      remainingRequests: 0,
      error: 'Rate limit check failed',
    };
  }
}
