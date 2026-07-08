import type { NextApiRequest, NextApiResponse } from 'next';
import { validateToken, checkRateLimit, hashToken } from '../../lib/auth';
import { generateCode } from '../../lib/gemini';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

interface GenerateRequest {
  pluginToken: string;
  prompt: string;
  contextCode?: string;
  requestType: 'create' | 'edit';
  sourceScriptName?: string;
}

interface GenerateResponse {
  success: boolean;
  script?: string;
  tokensUsed?: number;
  timestamp?: string;
  error?: string;
  code?: string;
  remainingRequests?: number;
}

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type': 'application/json',
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<GenerateResponse>
) {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Only accept POST requests
  if (req.method !== 'POST') {
    res.status(405).json({ success: false, error: 'Method not allowed' });
    return;
  }

  try {
    // Parse request body
    const { pluginToken, prompt, contextCode, requestType, sourceScriptName } =
      req.body as GenerateRequest;

    // Validate required fields
    if (!pluginToken) {
      return res.status(400).json({ success: false, error: 'Missing pluginToken' });
    }
    if (!prompt) {
      return res.status(400).json({ success: false, error: 'Missing prompt' });
    }
    if (!requestType || !['create', 'edit'].includes(requestType)) {
      return res.status(400).json({ success: false, error: 'Invalid requestType' });
    }

    // Step 1: Validate token
    const tokenValidation = await validateToken(pluginToken);
    if (!tokenValidation.valid) {
      return res.status(401).json({
        success: false,
        error: tokenValidation.error || 'Invalid token',
      });
    }

    const userId = tokenValidation.userId!;

    // Step 2: Check rate limiting
    const rateLimitCheck = await checkRateLimit(userId);
    if (!rateLimitCheck.allowed) {
      // Log the failed request
      await supabase.from('rate_limit_logs').insert({
        user_id: userId,
        endpoint: '/api/generate',
        status_code: 429,
        response_time_ms: 0,
      });

      return res.status(429).json({
        success: false,
        error: rateLimitCheck.error,
      });
    }

    // Step 3: Generate code using Gemini
    let generationResult;
    try {
      generationResult = await generateCode({
        prompt,
        contextCode,
        requestType,
      });
    } catch (error) {
      // Log generation error
      await supabase.from('rate_limit_logs').insert({
        user_id: userId,
        endpoint: '/api/generate',
        status_code: 500,
        response_time_ms: 0,
      });

      return res.status(500).json({
        success: false,
        error: `Generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
    }

    // Step 4: Save to generation history
    try {
      await supabase.from('generations_history').insert({
        user_id: userId,
        prompt,
        context_code: contextCode || null,
        request_type: requestType,
        source_script_name: sourceScriptName || null,
        generated_code: generationResult.code,
        tokens_used: generationResult.tokensUsed,
        status: 'success',
        generation_time_ms: generationResult.generationTimeMs,
      });

      // Update user's usage stats
      const { data: user } = await supabase
        .from('users')
        .select('total_generations, total_tokens_used')
        .eq('id', userId)
        .single();

      if (user) {
        await supabase
          .from('users')
          .update({
            total_generations: (user.total_generations || 0) + 1,
            total_tokens_used:
              (user.total_tokens_used || 0) + generationResult.tokensUsed,
            last_api_call: new Date().toISOString(),
          })
          .eq('id', userId);
      }
    } catch (dbError) {
      console.error('Database error:', dbError);
      // Don't fail the request if logging fails - code was generated
    }

    // Step 5: Log successful API call
    try {
      await supabase.from('rate_limit_logs').insert({
        user_id: userId,
        endpoint: '/api/generate',
        status_code: 200,
        response_time_ms: generationResult.generationTimeMs,
      });
    } catch (logError) {
      console.error('Failed to log API call:', logError);
    }

    // Step 6: Return response
    return res.status(200).json({
      success: true,
      script: generationResult.code,
      tokensUsed: generationResult.tokensUsed,
      timestamp: new Date().toISOString(),
      remainingRequests: rateLimitCheck.remainingRequests - 1,
    });
  } catch (error) {
    console.error('Unexpected error in /api/generate:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
}
