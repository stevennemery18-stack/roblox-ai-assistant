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

function isJsonBuilderRequest(prompt: string): boolean {
  return (
    prompt.includes('Return ONLY valid JSON') ||
    prompt.includes('Required JSON schema') ||
    prompt.includes('"objects"') ||
    prompt.includes('The plugin will parse your JSON') ||
    prompt.includes('JSON schema')
  );
}

function buildCodePrompt(prompt: string, contextCode: string | undefined, requestType: 'create' | 'edit'): string {
  let systemPrompt = `You are an expert Roblox game developer and Lua/Luau specialist.

RULES:
- Return ONLY Luau code.
- Do not use markdown.
- Do not explain.
- Use modern Roblox APIs.
- Use task.wait(), not wait().
- Do not use malicious code.
`;

  if (contextCode) {
    systemPrompt += `

CURRENT CODE CONTEXT:
\`\`\`lua
${contextCode}
\`\`\`
`;
  }

  if (requestType === 'edit' && contextCode) {
    return `${systemPrompt}

Modify this code to: ${prompt}

Original code:
\`\`\`lua
${contextCode}
\`\`\``;
  }

  return `${systemPrompt}

Generate new Luau code for:
${prompt}

Return ONLY code.`;
}

function makeJsonPrompt(prompt: string): string {
  return `You are a strict JSON generator for a Roblox Studio builder plugin.

ABSOLUTE OUTPUT RULES:
- Return ONLY valid JSON.
- First character must be {.
- Last character must be }.
- Do NOT use markdown.
- Do NOT use code fences.
- Do NOT write explanations.
- Do NOT output Lua.
- Do NOT add comments.
- Do NOT use trailing commas.
- Keep the JSON under 70 objects.
- Every object must use the exact schema requested by the user prompt.
- Use numbers, booleans, strings, arrays, and objects only.

${prompt}`;
}

async function generateText(model: any, fullPrompt: string, jsonMode: boolean): Promise<string> {
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
    generationConfig: {
      temperature: jsonMode ? 0.1 : 0.7,
      topP: jsonMode ? 0.65 : 0.8,
      topK: 40,
      maxOutputTokens: jsonMode ? 8192 : 4096,
    },
  });

  return result.response.text();
}

async function repairJson(model: any, brokenJson: string, originalPrompt: string): Promise<string> {
  const repairPrompt = `Fix this into valid JSON only.

Rules:
- Return ONLY valid JSON.
- First character must be {.
- Last character must be }.
- No markdown.
- No explanations.
- Keep the same Roblox object plan and same schema.
- Remove any invalid syntax or trailing commas.

Original required instructions:
${originalPrompt}

Broken output:
${brokenJson}`;

  const fixed = await generateText(model, repairPrompt, true);
  return extractJsonOnly(fixed);
}

/**
 * Call Gemini API.
 * For the one-button Roblox Studio plugin, this returns a JSON build plan.
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

    const jsonMode = isJsonBuilderRequest(prompt);
    const fullPrompt = jsonMode
      ? makeJsonPrompt(prompt)
      : buildCodePrompt(prompt, contextCode, requestType);

    let output = await generateText(model, fullPrompt, jsonMode);

    if (jsonMode) {
      output = extractJsonOnly(output);

      try {
        JSON.parse(output);
      } catch {
        output = await repairJson(model, output, fullPrompt);
        JSON.parse(output);
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
