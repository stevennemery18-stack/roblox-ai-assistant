# System Architecture & Authentication Flow

## 🔐 Part 1: Authentication & Communication Cycle

### How Plugin Authentication Works (Without OAuth)

Instead of complex OAuth flows, we use a **Simple Token-Based System**:

```
USER SETUP FLOW:
1. User signs up on web dashboard
2. Dashboard generates a unique 32-character API Token (e.g., "sk_roblox_abc123def456...")
3. User copies token from dashboard settings
4. User pastes token into Roblox Studio Plugin settings (one time)
5. Plugin stores token securely in plugin settings using plugin:SetSetting()
6. All subsequent requests include this token for authentication
```

**Why this works:**
- Simple for users (no OAuth redirect links in Studio)
- Secure because token is unique per user
- Can be revoked instantly from dashboard
- No session management complexity
- Free tier friendly (no server sessions)

### Request/Response Lifecycle

```
STEP 1: USER IN ROBLOX STUDIO
┌─────────────────────────────────────────┐
│ User highlights code in script editor    │
│ Opens plugin sidebar                     │
│ Types: "Create a function to detect...." │
└──────────────────────┬──────────────────┘
                       │
STEP 2: PLUGIN READS CONTEXT
┌──────────────────────▼─────────────────┐
│ Plugin captures:                        │
│ - User's prompt                         │
│ - Selected code (if any)                │
│ - Plugin token from settings            │
│ - Request type ('create' or 'edit')     │
└──────────────────────┬──────────────────┘
                       │
STEP 3: SEND TO API
┌──────────────────────▼──────────────────────────────────┐
│ HttpService:PostAsync() to API endpoint                  │
│ POST /api/generate                                       │
│ Headers: Content-Type: application/json                  │
│ Body: {                                                  │
│   pluginToken: "sk_roblox_...",                          │
│   prompt: "Create a function to detect...",              │
│   contextCode: "function onTouched(hit)...",             │
│   requestType: "create"                                  │
│ }                                                        │
└──────────────────────┬──────────────────────────────────┘
                       │
STEP 4: API VALIDATES & ENRICHES
┌──────────────────────▼──────────────────────────────────┐
│ Backend checks:                                          │
│ ✓ Token exists in database                              │
│ ✓ Token not revoked                                     │
│ ✓ User hasn't exceeded rate limit                        │
│ If invalid → return 401 Unauthorized                     │
│                                                         │
│ If valid:                                               │
│ - Look up user_id from token                            │
│ - Create enhanced system prompt:                        │
│   * Include Roblox Luau best practices                  │
│   * Include user's context code                         │
│   * Specify request type                               │
└──────────────────────┬──────────────────────────────────┘
                       │
STEP 5: CALL GEMINI API
┌──────────────────────▼──────────────────────────────────┐
│ Use Google Generative AI SDK                            │
│ System prompt enforces:                                 │
│ - Modern Luau syntax (strict typing)                    │
│ - task.wait() instead of wait()                         │
│ - Modern APIs (no FindPartOnRay)                        │
│ - Roblox best practices                                 │
│                                                         │
│ Send to model: "gemini-1.5-flash-latest"                │
│ (free tier, fast, sufficient for code gen)              │
└──────────────────────┬──────────────────────────────────┘
                       │
STEP 6: LOG TO DATABASE
┌──────────────────────▼──────────────────────────────────┐
│ Insert into generations_history:                        │
│ - user_id                                               │
│ - prompt                                                │
│ - generated_code                                        │
│ - tokens_used                                           │
│ - timestamp                                             │
│ - source_script_name                                    │
│                                                         │
│ Update user's last_api_call timestamp                  │
│ (for activity tracking & analytics)                     │
└──────────────────────┬──────────────────────────────────┘
                       │
STEP 7: RETURN RESPONSE
┌──────────────────────▼──────────────────────────────────┐
│ Return JSON:                                            │
│ {                                                       │
│   success: true,                                        │
│   script: "function detectTouching(...)...",            │
│   tokensUsed: 847,                                      │
│   timestamp: "2024-07-08T15:45:32Z"                     │
│ }                                                       │
│                                                         │
│ On error:                                               │
│ {                                                       │
│   success: false,                                       │
│   error: "Rate limit exceeded. Try again in 30 sec",    │
│   code: "RATE_LIMIT"                                    │
│ }                                                       │
└──────────────────────┬──────────────────────────────────┘
                       │
STEP 8: PLUGIN HANDLES RESPONSE
┌──────────────────────▼──────────────────────────────────┐
│ pcall() handles network errors gracefully               │
│ If success:                                             │
│ - Show "Generated successfully!" status                 │
│ - Display code in preview textbox                       │
│ - Enable "Insert Code" button                           │
│                                                         │
│ If error:                                               │
│ - Show error message to user                            │
│ - Suggest retry or token refresh                        │
└──────────────────────┬──────────────────────────────────┘
                       │
STEP 9: USER INSERTS CODE
┌──────────────────────▼──────────────────────────────────┐
│ User clicks "Insert Code"                               │
│ Plugin uses ScriptEditorService to:                     │
│ - Replace selected code (if 'edit' mode)                │
│ - Insert at cursor (if 'create' mode)                   │
│ - Format code with proper indentation                   │
│ - Show "Code inserted!" confirmation                    │
└──────────────────────────────────────────────────────────┘
```

### Token Security Model

**Token Generation (Backend)**
```
- 32 random bytes → hex encoded
- Format: "sk_roblox_" + 48-char hex string
- Stored in database with:
  * user_id (foreign key)
  * created_at timestamp
  * last_used timestamp
  * is_active boolean (for revocation)
  * ip_whitelist (optional, for strict security)
```

**Token Usage (Frontend + Plugin)**
```
- Never transmitted over HTTP (only HTTPS in production)
- Stored locally in plugin settings (Roblox sandboxed)
- Users can regenerate tokens instantly from dashboard
- Old tokens automatically invalidate
- Rate limiting per token: 30 requests/minute (free tier)
```

### Rate Limiting Strategy

Free tier requires careful rate limiting to prevent API key abuse:

```
Per User:
- 30 API calls per minute
- 500 calls per day
- Max 10,000 tokens per generation

Across Platform:
- Queue-based processing for fairness
- Gemini free tier: ~60 requests/minute total
- If queue full, return 429 (retry after X seconds)

Graceful Degradation:
- If Gemini API down: return cached similar generations
- If database down: return "Service temporarily unavailable"
```

### Data Flow Security

```
HTTPS ONLY in Production:
- All requests encrypted in transit
- Certificate managed by hosting provider (Vercel/Render)

API Key Protection:
- Gemini API key stored in .env.local (never committed)
- Supabase connection string in environment only
- No keys in frontend code or git history

Token Rotation:
- Users can revoke tokens instantly
- Old tokens deleted after 7 days
- API tracks token version for audit trail

Sensitive Data Handling:
- User passwords hashed with bcrypt (cost: 12)
- Tokens hashed before database storage (SHA-256)
- API logs don't contain tokens or full code
- GDPR-compliant data retention (delete after 90 days if requested)
```

## Architecture Summary

This token-based system is:
- ✅ **Simple** - No OAuth complexity
- ✅ **Secure** - Token-based authentication
- ✅ **Scalable** - Stateless API (no session store)
- ✅ **Free-tier friendly** - No expensive infrastructure
- ✅ **User-friendly** - Copy/paste setup, no redirects
