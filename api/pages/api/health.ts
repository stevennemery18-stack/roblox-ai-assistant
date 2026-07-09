import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

interface HealthResponse {
  status: string;
  timestamp: string;
  database: string;
  gemini: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<HealthResponse>
) {
  try {
    // Check database connection
    let dbStatus = 'error';
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id')
        .limit(1);
      
      if (!error) {
        dbStatus = 'ok';
      }
    } catch (e) {
      dbStatus = 'error';
    }

    // Check Gemini API key
    let geminiStatus = 'error';
    if (process.env.GEMINI_API_KEY) {
      geminiStatus = 'ok';
    }

    res.status(200).json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      database: dbStatus,
      gemini: geminiStatus,
    });
  } catch (error) {
    console.error('Health check error:', error);
    res.status(500).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      database: 'error',
      gemini: 'error',
    });
  }
}
