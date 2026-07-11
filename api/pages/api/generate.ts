import type { NextApiRequest, NextApiResponse } from 'next';
import { generateCode } from '../../lib/gemini';

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
  remainingRequests?: number;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<GenerateResponse>
) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: 'Method not allowed',
    });
  }

  try {
    const { pluginToken, prompt, contextCode, requestType } =
      req.body as GenerateRequest;

    if (!pluginToken) {
      return res.status(400).json({
        success: false,
        error: 'Missing pluginToken',
      });
    }

    if (pluginToken !== process.env.PLUGIN_TOKEN) {
      return res.status(401).json({
        success: false,
        error: 'Invalid token',
      });
    }

    if (!prompt) {
      return res.status(400).json({
        success: false,
        error: 'Missing prompt',
      });
    }

    if (!requestType || !['create', 'edit'].includes(requestType)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid requestType',
      });
    }

    const generationResult = await generateCode({
      prompt,
      contextCode,
      requestType,
    });

    return res.status(200).json({
      success: true,
      script: generationResult.code,
      tokensUsed: generationResult.tokensUsed,
      timestamp: new Date().toISOString(),
      remainingRequests: 999,
    });
  } catch (error) {
    console.error('Unexpected error in /api/generate:', error);

    return res.status(500).json({
      success: false,
      error: `Internal server error: ${
        error instanceof Error ? error.message : 'Unknown error'
      }`,
    });
  }
}
