import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

interface HealthResponse {
  status: 'ok' | 'error';
  timestamp: string;
  database?: 'ok' | 'error';
  gemini?: 'ok' | 'error';
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<HealthResponse>
) {
  const timestamp = new Date().toISOString();
  let dbStatus: 'ok' | 'error' = 'ok';

  // Check database connection
  try {
    const { error } = await supabase
      .from('users')
      .select('id')
      .limit(1);
    if (error) dbStatus = 'error';
  } catch (error) {
    dbStatus = 'error';
  }

  const geminiStatus = process.env.GEMINI_API_KEY ? 'ok' : 'error';

  const overallStatus = dbStatus === 'ok' && geminiStatus === 'ok' ? 'ok' : 'error';

  res.status(overallStatus === 'ok' ? 200 : 503).json({
    status: overallStatus,
    timestamp,
    database: dbStatus,
    gemini: geminiStatus,
  });
}
