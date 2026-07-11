import { GoogleGenerativeAI } from '@google/generative-ai';

const apiKey =
  process.env.GEMINI_API_KEY ||
  process.env.GOOGLE_GENERATIVE_AI_API_KEY ||
  process.env.GOOGLE_API_KEY ||
  '';

const genAI = new GoogleGenerativeAI(apiKey);

/**
 * Enhanced system prompt for Roblox Luau code generation
 * Enforces modern Luau practices and Roblox best practices
 */
function buildSystemPrompt(contextCode?: string): string {
  let prompt = `You are an expert Roblox game developer and Lua/Luau specialist.

## CRITICAL RULES:
1. ALWAYS use modern Luau syntax with strict typing
2. Use 'task.wait()' NEVER use 'wait()'
3. Use 'task.defer()' for deferred execution
4. Use 'task.delay()' for delays with callbacks
5. NEVER use deprecated methods like Workspace:FindPartOnRay (use Raycast instead)
6. NEVER use Humanoid:MoveTo or old movement APIs
7. Always use local variables with explicit types when possible
8. Use 'local' keyword for all variables (no globals)
9. Use '::' for type annotations: local x: number = 5
10. Avoid nested callbacks - use task library instead
11. Always include comments explaining complex logic
12. Use modern Roblox APIs (Instance.new, GetService, etc.)
13. Follow Roblox naming conventions: camelCase for variables, PascalCase for classes
14. Return code that is production-ready and optimized

## CODE STYLE:
- Use tabs for indentation (Roblox standard)
- Max line length: 100 characters
- Add comments for non-obvious logic
- Use local functions for helper code
- Always validate input parameters

## SAFETY:
- Never use getfenv() or setfenv()
- Never use loadstring() or load()
- Always check if instances exist before accessing properties
- Use pcall() for risky operations
- Avoid infinite loops - always include exit conditions

## ROBLOX SERVICES:
- game:GetService() for all services
- UserInputService for input handling
- RunService for game loops
- HttpService for web requests with pcall
- TweenService for smooth animations
- Debris for cleanup
`;

  if (contextCode) {
    prompt += `\n## CURRENT CODE CONTEXT:\n\`\`\`lua\n${contextCode}\n\`\`\`\n`;
    prompt += `\nYou are working with or modifying the above code. Maintain consistency with existing patterns and style.\n`;
  }

  return prompt;
}

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

/**
 * Call Gemini API to generate Roblox Luau code
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
      model: 'gemini-2.5-flash',
    });

    const systemPrompt = buildSystemPrompt(contextCode);

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

Return ONLY the code, wrapped in a single lua code block.`;
    }

    const fullPrompt = `${systemPrompt}\n\n${userPrompt}`;

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
        temperature: 0.7,
        topP: 0.8,
        topK: 40,
        maxOutputTokens: 2048,
      },
    });

    const response = result.response;
    let code = response.text();

    code = code
      .replace(/^```lua\n?/gm, '')
      .replace(/^```\n?/gm, '')
      .replace(/\n?```$/gm, '')
      .trim();

    const generationTimeMs = Date.now() - startTime;

    const tokensUsed = Math.ceil(
      (prompt.length + code.length + (contextCode?.length || 0)) / 4
    );

    return {
      code,
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
