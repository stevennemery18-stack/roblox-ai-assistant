import { GoogleGenerativeAI } from '@google/generative-ai';

const apiKey =
  process.env.GEMINI_API_KEY ||
  process.env.GOOGLE_GENERATIVE_AI_API_KEY ||
  process.env.GOOGLE_API_KEY ||
  '';

const genAI = new GoogleGenerativeAI(apiKey);

interface GenerateCodeOptions {
  prompt: string;
  contextCode?: string;
  requestType: 'create' | 'edit';
}

interface GenerateCodeResponse {
  code: string;
  tokensUsed: number;
  generationTimeMs: number;
}

function extractJsonOnly(text: string): string {
  let cleaned = String(text || '').trim();

  cleaned = cleaned
    .replace(/^```json\s*/i, '')
    .replace(/^```lua\s*/i, '')
    .replace(/^```luau\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();

  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');

  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    cleaned = cleaned.slice(firstBrace, lastBrace + 1);
  }

  return cleaned.trim();
}

function looksLikeJsonBuilderRequest(prompt: string): boolean {
  return (
    prompt.includes('Return ONLY valid JSON') ||
    prompt.includes('Required JSON schema') ||
    prompt.includes('"objects"') ||
    prompt.includes('The plugin will parse your JSON')
  );
}

function buildCodeSystemPrompt(contextCode?: string): string {
  let systemPrompt = `You are an expert Roblox game developer and Lua/Luau specialist.

CRITICAL RULES:
1. Use modern Luau syntax.
2. Use task.wait(), not wait().
3. Never use deprecated APIs.
4. Return ONLY code.
5. No explanations.
6. No markdown unless specifically requested.
7. Use game:GetService() for services.
8. Validate instances before using them.
9. Avoid malicious code.
`;

  if (contextCode) {
    systemPrompt += `

CURRENT CODE CONTEXT:
\`\`\`lua
${contextCode}
\`\`\`
`;
  }

  return systemPrompt;
}

/**
 * Call Gemini API.
 * IMPORTANT:
 * - For the one-button Studio builder plugin, this returns JSON build plans.
 * - For old code-generation calls, this can still return Luau code.
 */
export async function generateCode({
  prompt,
  contextCode,
  requestType,
}: GenerateCodeOptions): Promise<GenerateCodeResponse> {
  const startTime = Date.now();

  try {
    if (!apiKey) {
      throw new Error('Missing Gemini API key');
    }

    const model = genAI.getGenerativeModel({
      model: 'gemini-3.5-flash',
    });

    const jsonMode = looksLikeJsonBuilderRequest(prompt);

    let fullPrompt: string;

    if (jsonMode) {
      fullPrompt = `You are a strict JSON generator for a Roblox Studio builder plugin.

ABSOLUTE OUTPUT RULES:
- Return ONLY valid JSON.
- Do NOT return Lua code.
- Do NOT use markdown.
- Do NOT use code fences.
- Do NOT write explanations.
- Do NOT add comments.
- The first character must be { and the last character must be }.
- Keep the JSON complete and parseable.
- Use under 70 objects so the response does not get cut off.

${prompt}`;
    } else {
      const systemPrompt = buildCodeSystemPrompt(contextCode);

      let userPrompt = prompt;

      if (requestType === 'edit' && contextCode) {
        userPrompt = `[REQUEST TYPE: EDIT MODE]
Modify the following code to: ${prompt}

Original code:
\`\`\`lua
${contextCode}
\`\`\``;
      } else if (requestType === 'create') {
        userPrompt = `[REQUEST TYPE: CREATE MODE]
Generate new Luau code for: ${prompt}

Return ONLY the code.`;
      }

      fullPrompt = `${systemPrompt}

${userPrompt}`;
    }

    const generationConfig: any = {
      temperature: jsonMode ? 0.15 : 0.7,
      topP: jsonMode ? 0.7 : 0.8,
      topK: 40,
      maxOutputTokens: jsonMode ? 8192 : 4096,
    };

    if (jsonMode) {
      generationConfig.responseMimeType = 'application/json';
    }

    const result = await model.generateContent({
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: fullPrompt,
            },
          ],
        },
      ],
      generationConfig,
    });

    const response = result.response;
    let output = response.text();

    if (jsonMode) {
      output = extractJsonOnly(output);

      // Validate before sending to Roblox plugin.
      try {
        JSON.parse(output);
      } catch (jsonError) {
        console.error('Invalid JSON from Gemini:', output);
        throw new Error(
          `AI returned invalid JSON: ${
            jsonError instanceof Error ? jsonError.message : 'Unknown JSON error'
          }`
        );
      }
    } else {
      output = output
        .replace(/^```lua\n?/gm, '')
        .replace(/^```luau\n?/gm, '')
        .replace(/^```\n?/gm, '')
        .replace(/\n?```$/gm, '')
        .trim();
    }

    const generationTimeMs = Date.now() - startTime;

    const tokensUsed = Math.ceil(
      (prompt.length + output.length + (contextCode?.length || 0)) / 4
    );

    return {
      code: output,
      tokensUsed,
      generationTimeMs,
    };
  } catch (error) {
    console.error('Gemini API error:', error);

    throw new Error(
      `Failed to generate code: ${
        error instanceof Error ? error.message : 'Unknown error'
      }`
    );
  }
}
