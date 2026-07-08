# Roblox AI Assistant Plugin

Full-featured Roblox Studio plugin for AI-powered code generation.

## Installation

### Option 1: Direct Installation
1. Download `RobloxAIAssistant.lua`
2. In Roblox Studio, go to **Plugins** → **File** → **Install Plugin**
3. Select the `.lua` file and click Open
4. The plugin will appear in the Plugins tab

### Option 2: As a Plugin Module
1. Place `RobloxAIAssistant.lua` in your game's **ServerScriptService** or **ReplicatedStorage**
2. The plugin will automatically initialize

## Usage

### First Time Setup
1. Open the **Roblox AI Assistant** plugin (right sidebar)
2. In the **⚙️ Settings** section at the bottom, paste your API token
3. The token is generated on the web dashboard at `dashboard.example.com`
4. Click anywhere outside the token box to save

### Generate Code
1. Type your request in the "📝 What do you need?" box
   - Example: "Create a function to detect when a player touches a part"
2. Choose **Create** or **Edit** mode:
   - **Create**: Generate new code
   - **Edit**: Modify selected code
3. Click **⚡ Generate Code**
4. Wait for the AI to respond (usually 5-10 seconds)

### Insert Code
1. Once code is generated, it appears in the **💻 Generated Code** preview
2. Click **✨ Insert Code** to inject it into the active script
3. The code will be inserted at the end of your script (or replace selected text in Edit mode)

### Copy Code
1. Click **📋 Copy Code** to display the code (Roblox sandboxing limitation)
2. Manually select and copy from the preview box

## Features

✅ **Modern Luau Code** - Uses latest Roblox APIs
✅ **Intelligent Context** - Reads your current script for context
✅ **Error Handling** - Built-in pcall() for safety
✅ **One-Time Setup** - Token saved locally in plugin settings
✅ **Roblox Studio Integration** - Native UI, no external dependencies
✅ **Dark Theme** - Matches Roblox Studio aesthetic

## Troubleshooting

### "Invalid token" error
- Make sure you're using the correct token from the dashboard
- Token starts with `sk_roblox_`
- Token may have been revoked - regenerate on dashboard

### "Network error" or timeout
- Check your internet connection
- Verify API URL is correct
- The API may be temporarily down

### Code won't insert
- Make sure you have a script selected in the game tree
- Try selecting a different script and try again
- Check that the generated code is valid Luau syntax

### Plugin won't load
- Make sure you're running Roblox Studio (not the game)
- Restart Roblox Studio
- Check the Output console for errors

## API Integration

The plugin communicates with the backend API via:
```
POST /api/generate
```

**Request Body:**
```lua
{
  pluginToken: "sk_roblox_...",
  prompt: "Create a function to...",
  requestType: "create" | "edit",
  contextCode: "optional current code",
  sourceScriptName: "ScriptName"
}
```

**Response:**
```lua
{
  success: true,
  script: "function myFunc()...end",
  tokensUsed: 847,
  timestamp: "2024-07-08T15:45:32Z"
}
```

## Performance

- **Generation Time**: 3-15 seconds (depends on complexity)
- **Token Usage**: 100-2000 tokens per generation
- **Rate Limit**: 30 requests/minute, 500/day (free tier)

## License

MIT - Free to use and modify
