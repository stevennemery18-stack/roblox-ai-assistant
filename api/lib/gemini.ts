import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

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
- HttpService for web requests (with pcall)
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
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash-latest' });

    const systemPrompt = buildSystemPrompt(contextCode);

    let userPrompt = prompt;
    if (requestType === 'edit' && contextCode) {
      userPrompt = `[REQUEST TYPE: EDIT MODE]\nModify the following code to: ${prompt}\n\nOriginal code:\n\`\`\`lua\n${contextCode}\n\`\`\``;
    } else if (requestType === 'create') {
      userPrompt = `[REQUEST TYPE: CREATE MODE]\nGenerate new Luau code for: ${prompt}\n\nReturn ONLY the code, wrapped in a single lua code block.`;
    }

    // Combine system prompt with user prompt
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
      safetySettings: [
        {
          category: 'HARM_CATEGORY_UNSPECIFIED',
          threshold: 'BLOCK_NONE',
        },
        {
          category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
          threshold: 'BLOCK_NONE',
        },
      ],
    });

    const response = result.response;
    let code = response.text();

    // Clean up code block markers if present
    code = code
      .replace(/^```lua\n?/gm, '')
      .replace(/^```\n?/gm, '')
      .replace(/\n?```$/gm, '')
      .trim();

    const generationTimeMs = Date.now() - startTime;

    // Estimate tokens used (Gemini doesn't always return exact counts)
    // Rough estimate: ~4 chars per token
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
      `Failed to generate code: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}
