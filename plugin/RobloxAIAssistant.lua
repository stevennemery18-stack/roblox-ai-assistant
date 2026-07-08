-- Roblox AI Assistant Plugin for Roblox Studio
-- Complete source code for the DockWidgetPluginGui
-- Installation: Place this file in a LocalScript in ServerScriptService or load via plugin system

local HttpService = game:GetService("HttpService")
local ScriptEditorService = game:GetService("ScriptEditorService")
local ChangeHistoryService = game:GetService("ChangeHistoryService")

-- ============================================
-- CONFIGURATION
-- ============================================

local PLUGIN = plugin or _G.RobloxAIPlugin
local API_URL = "http://localhost:3001" -- Change to production URL
local REQUEST_TIMEOUT = 30 -- seconds

-- ============================================
-- PLUGIN STATE
-- ============================================

local pluginState = {
  apiToken = "",
  isGenerating = false,
  currentScript = nil,
  lastGeneration = nil,
}

-- ============================================
-- UTILITY FUNCTIONS
-- ============================================

--- Load setting from plugin storage
local function getSetting(key: string, defaultValue: any): any
  local success, result = pcall(function()
    return PLUGIN:GetSetting(key)
  end)
  return if success then result else defaultValue
end

--- Save setting to plugin storage
local function setSetting(key: string, value: any): boolean
  local success = pcall(function()
    PLUGIN:SetSetting(key, value)
  end)
  return success
end

--- Make HTTP request to API
local function makeApiRequest(
  endpoint: string,
  method: string,
  body: table?
): (boolean, string, number)
  local success, response = pcall(function()
    return HttpService:PostAsync(
      API_URL .. endpoint,
      if body then HttpService:JSONEncode(body) else "",
      Enum.HttpContentType.ApplicationJson,
      false,
      nil,
      REQUEST_TIMEOUT
    )
  end)

  if not success then
    return false, "Network error: " .. tostring(response), 0
  end

  local statusCode = 200 -- Default to 200 if not available
  return true, response, statusCode
end

--- Safely decode JSON response
local function decodeJson(jsonString: string): (boolean, any)
  local success, result = pcall(function()
    return HttpService:JSONDecode(jsonString)
  end)
  return success, result
end

--- Get currently selected text in editor
local function getSelectedCode(): string?
  local success, selectedText = pcall(function()
    local script = ScriptEditorService:FindScriptFromSibling(game.ServerScriptService:FindFirstChild("DummyScript") or Instance.new("Script"))
    if script then
      return ScriptEditorService:GetSelectedText(script)
    end
    return nil
  end)
  return if success then selectedText else nil
end

--- Insert or replace code in script
local function insertCodeIntoScript(code: string, replace: boolean): boolean
  if not pluginState.currentScript then
    return false
  end

  local success = pcall(function()
    local scriptText = pluginState.currentScript.Source
    if replace then
      -- Replace selected text or entire script
      local selectedCode = getSelectedCode()
      if selectedCode and selectedCode ~= "" then
        pluginState.currentScript.Source = scriptText:gsub(
          selectedCode:gsub("[%(%)%.%[%]%*%+%-%?%^%$%%]", "%%%1"),
          code,
          1
        )
      else
        pluginState.currentScript.Source = code
      end
    else
      -- Insert at cursor position (append at end for simplicity)
      pluginState.currentScript.Source = scriptText .. "\n\n" .. code
    end

    -- Record change in history
    ChangeHistoryService:SetWaypoint("AI Generated Code")
  end)

  return success
end

-- ============================================
-- UI COMPONENTS
-- ============================================

--- Create the main plugin GUI
local function createPluginGui()
  -- Main DockWidgetPluginGui
  local widget = Instance.new("DockWidgetPluginGui")
  widget.Name = "RobloxAIAssistant"
  widget.Title = "Roblox AI Assistant"
  widget.InitialDockState = Enum.InitialDockState.Right
  widget.FloatingSize = UDim2.new(0, 350, 0, 600)
  widget.MinSize = UDim2.new(0, 300, 0, 400)

  -- Main container
  local container = Instance.new("Frame")
  container.Name = "Container"
  container.Size = UDim2.new(1, 0, 1, 0)
  container.BackgroundColor3 = Color3.fromRGB(25, 25, 25) -- Roblox dark theme
  container.BorderSizePixel = 0
  container.Parent = widget

  -- ScrollingFrame for content
  local scrollFrame = Instance.new("ScrollingFrame")
  scrollFrame.Name = "ScrollFrame"
  scrollFrame.Size = UDim2.new(1, -10, 1, -10)
  scrollFrame.Position = UDim2.new(0, 5, 0, 5)
  scrollFrame.BackgroundColor3 = Color3.fromRGB(25, 25, 25)
  scrollFrame.BorderSizePixel = 0
  scrollFrame.CanvasSize = UDim2.new(0, 0, 0, 0)
  scrollFrame.ScrollBarThickness = 6
  scrollFrame.Parent = container

  -- UIListLayout for auto-layout
  local listLayout = Instance.new("UIListLayout")
  listLayout.Padding = UDim.new(0, 10)
  listLayout.FillDirection = Enum.FillDirection.Vertical
  listLayout.SortOrder = Enum.SortOrder.LayoutOrder
  listLayout.Parent = scrollFrame

  -- Update canvas size when content changes
  listLayout:GetPropertyChangedSignal("AbsoluteContentSize"):Connect(function()
    scrollFrame.CanvasSize = UDim2.new(0, 0, 0, listLayout.AbsoluteContentSize.Y + 10)
  end)

  return widget, container, scrollFrame
end

--- Create header with title
local function createHeader(parent: Frame): TextLabel
  local header = Instance.new("TextLabel")
  header.Name = "Header"
  header.LayoutOrder = 1
  header.Size = UDim2.new(1, 0, 0, 40)
  header.BackgroundColor3 = Color3.fromRGB(20, 20, 20)
  header.BorderSizePixel = 0
  header.Text = "🤖 Roblox AI Assistant"
  header.TextColor3 = Color3.fromRGB(0, 162, 255) -- Roblox accent blue
  header.TextSize = 16
  header.Font = Enum.Font.GothamBold
  header.Parent = parent

  return header
end

--- Create prompt input section
local function createPromptInput(parent: Frame): (TextBox, Frame)
  -- Prompt label
  local promptLabel = Instance.new("TextLabel")
  promptLabel.Name = "PromptLabel"
  promptLabel.LayoutOrder = 2
  promptLabel.Size = UDim2.new(1, 0, 0, 20)
  promptLabel.BackgroundTransparency = 1
  promptLabel.Text = "📝 What do you need?"
  promptLabel.TextColor3 = Color3.fromRGB(200, 200, 200)
  promptLabel.TextSize = 12
  promptLabel.Font = Enum.Font.Gotham
  promptLabel.TextXAlignment = Enum.TextXAlignment.Left
  promptLabel.Parent = parent

  -- Prompt input box
  local promptBox = Instance.new("TextBox")
  promptBox.Name = "PromptBox"
  promptBox.LayoutOrder = 3
  promptBox.Size = UDim2.new(1, 0, 0, 100)
  promptBox.BackgroundColor3 = Color3.fromRGB(40, 40, 40)
  promptBox.BorderColor3 = Color3.fromRGB(80, 80, 80)
  promptBox.BorderSizePixel = 1
  promptBox.TextColor3 = Color3.fromRGB(255, 255, 255)
  promptBox.TextSize = 12
  promptBox.Font = Enum.Font.Gotham
  promptBox.TextWrapped = true
  promptBox.ClearTextOnFocus = false
  promptBox.Text = "Create a function to..."
  promptBox.Parent = parent

  -- Corner radius
  local corner = Instance.new("UICorner")
  corner.CornerRadius = UDim.new(0, 4)
  corner.Parent = promptBox

  return promptBox, promptLabel
end

--- Create button with styling
local function createButton(
  parent: Frame,
  name: string,
  text: string,
  layoutOrder: number
): TextButton
  local button = Instance.new("TextButton")
  button.Name = name
  button.LayoutOrder = layoutOrder
  button.Size = UDim2.new(1, 0, 0, 36)
  button.BackgroundColor3 = Color3.fromRGB(0, 162, 255) -- Roblox blue
  button.BorderSizePixel = 0
  button.Text = text
  button.TextColor3 = Color3.fromRGB(0, 0, 0)
  button.TextSize = 13
  button.Font = Enum.Font.GothamBold
  button.Parent = parent

  -- Corner radius
  local corner = Instance.new("UICorner")
  corner.CornerRadius = UDim.new(0, 4)
  corner.Parent = button

  -- Hover effect
  button.MouseEnter:Connect(function()
    button.BackgroundColor3 = Color3.fromRGB(0, 200, 255)
  end)

  button.MouseLeave:Connect(function()
    button.BackgroundColor3 = Color3.fromRGB(0, 162, 255)
  end)

  return button
end

--- Create status indicator
local function createStatusLabel(parent: Frame): TextLabel
  local status = Instance.new("TextLabel")
  status.Name = "StatusLabel"
  status.LayoutOrder = 10
  status.Size = UDim2.new(1, 0, 0, 30)
  status.BackgroundTransparency = 1
  status.Text = "✅ Ready"
  status.TextColor3 = Color3.fromRGB(100, 200, 100)
  status.TextSize = 11
  status.Font = Enum.Font.Gotham
  status.Parent = parent

  return status
end

--- Create code preview section
local function createCodePreview(parent: Frame): ScrollingFrame
  local previewLabel = Instance.new("TextLabel")
  previewLabel.Name = "PreviewLabel"
  previewLabel.LayoutOrder = 7
  previewLabel.Size = UDim2.new(1, 0, 0, 20)
  previewLabel.BackgroundTransparency = 1
  previewLabel.Text = "💻 Generated Code"
  previewLabel.TextColor3 = Color3.fromRGB(200, 200, 200)
  previewLabel.TextSize = 12
  previewLabel.Font = Enum.Font.Gotham
  previewLabel.TextXAlignment = Enum.TextXAlignment.Left
  previewLabel.Parent = parent

  local preview = Instance.new("ScrollingFrame")
  preview.Name = "CodePreview"
  preview.LayoutOrder = 8
  preview.Size = UDim2.new(1, 0, 0, 120)
  preview.BackgroundColor3 = Color3.fromRGB(15, 15, 15)
  preview.BorderColor3 = Color3.fromRGB(80, 80, 80)
  preview.BorderSizePixel = 1
  preview.CanvasSize = UDim2.new(0, 0, 0, 0)
  preview.ScrollBarThickness = 4
  preview.Parent = parent

  -- Corner radius
  local corner = Instance.new("UICorner")
  corner.CornerRadius = UDim.new(0, 4)
  corner.Parent = preview

  -- Code text inside preview
  local codeText = Instance.new("TextLabel")
  codeText.Name = "CodeText"
  codeText.Size = UDim2.new(1, -5, 0, 0)
  codeText.BackgroundTransparency = 1
  codeText.TextColor3 = Color3.fromRGB(0, 200, 100) -- Green for code
  codeText.TextSize = 10
  codeText.Font = Enum.Font.Courier
  codeText.TextWrapped = true
  codeText.TextXAlignment = Enum.TextXAlignment.Left
  codeText.TextYAlignment = Enum.TextYAlignment.Top
  codeText.Text = "Generated code will appear here..."
  codeText.Parent = preview

  -- Update canvas when text changes
  codeText:GetPropertyChangedSignal("AbsoluteSize"):Connect(function()
    codeText.Size = UDim2.new(1, -5, 0, codeText.TextBounds.Y)
    preview.CanvasSize = UDim2.new(0, 0, 0, codeText.TextBounds.Y + 5)
  end)

  return preview
end

--- Create settings/token section
local function createTokenSettings(parent: Frame): TextBox
  local settingsLabel = Instance.new("TextLabel")
  settingsLabel.Name = "SettingsLabel"
  settingsLabel.LayoutOrder = 11
  settingsLabel.Size = UDim2.new(1, 0, 0, 20)
  settingsLabel.BackgroundTransparency = 1
  settingsLabel.Text = "⚙️ Settings"
  settingsLabel.TextColor3 = Color3.fromRGB(200, 200, 200)
  settingsLabel.TextSize = 12
  settingsLabel.Font = Enum.Font.Gotham
  settingsLabel.TextXAlignment = Enum.TextXAlignment.Left
  settingsLabel.Parent = parent

  local tokenLabel = Instance.new("TextLabel")
  tokenLabel.Name = "TokenLabel"
  tokenLabel.LayoutOrder = 12
  tokenLabel.Size = UDim2.new(1, 0, 0, 15)
  tokenLabel.BackgroundTransparency = 1
  tokenLabel.Text = "API Token:"
  tokenLabel.TextColor3 = Color3.fromRGB(150, 150, 150)
  tokenLabel.TextSize = 10
  tokenLabel.Font = Enum.Font.Gotham
  tokenLabel.TextXAlignment = Enum.TextXAlignment.Left
  tokenLabel.Parent = parent

  local tokenBox = Instance.new("TextBox")
  tokenBox.Name = "TokenBox"
  tokenBox.LayoutOrder = 13
  tokenBox.Size = UDim2.new(1, 0, 0, 30)
  tokenBox.BackgroundColor3 = Color3.fromRGB(40, 40, 40)
  tokenBox.BorderColor3 = Color3.fromRGB(80, 80, 80)
  tokenBox.BorderSizePixel = 1
  tokenBox.TextColor3 = Color3.fromRGB(255, 255, 255)
  tokenBox.TextSize = 10
  tokenBox.Font = Enum.Font.Courier
  tokenBox.Text = getSetting("PluginToken", "")
  tokenBox.PlaceholderText = "Paste your API token here"
  tokenBox.Parent = parent

  -- Corner radius
  local corner = Instance.new("UICorner")
  corner.CornerRadius = UDim.new(0, 4)
  corner.Parent = tokenBox

  return tokenBox
end

-- ============================================
-- MAIN PLUGIN LOGIC
-- ============================================

local function initializePlugin()
  -- Create GUI
  local widget, container, scrollFrame = createPluginGui()

  -- Add header
  createHeader(scrollFrame)

  -- Add prompt input
  local promptBox, promptLabel = createPromptInput(scrollFrame)

  -- Add request type selector
  local typeLabel = Instance.new("TextLabel")
  typeLabel.Name = "TypeLabel"
  typeLabel.LayoutOrder = 4
  typeLabel.Size = UDim2.new(1, 0, 0, 20)
  typeLabel.BackgroundTransparency = 1
  typeLabel.Text = "Request Type:"
  typeLabel.TextColor3 = Color3.fromRGB(200, 200, 200)
  typeLabel.TextSize = 12
  typeLabel.Font = Enum.Font.Gotham
  typeLabel.TextXAlignment = Enum.TextXAlignment.Left
  typeLabel.Parent = scrollFrame

  local typeFrame = Instance.new("Frame")
  typeFrame.Name = "TypeFrame"
  typeFrame.LayoutOrder = 5
  typeFrame.Size = UDim2.new(1, 0, 0, 32)
  typeFrame.BackgroundTransparency = 1
  typeFrame.Parent = scrollFrame

  local listLayout = Instance.new("UIListLayout")
  listLayout.Padding = UDim.new(0, 5)
  listLayout.FillDirection = Enum.FillDirection.Horizontal
  listLayout.SortOrder = Enum.SortOrder.LayoutOrder
  listLayout.Parent = typeFrame

  local createBtn = Instance.new("TextButton")
  createBtn.Name = "CreateBtn"
  createBtn.LayoutOrder = 1
  createBtn.Size = UDim2.new(0.5, -2.5, 1, 0)
  createBtn.BackgroundColor3 = Color3.fromRGB(0, 162, 255)
  createBtn.BorderSizePixel = 0
  createBtn.Text = "Create"
  createBtn.TextColor3 = Color3.fromRGB(0, 0, 0)
  createBtn.TextSize = 12
  createBtn.Font = Enum.Font.GothamBold
  createBtn.Parent = typeFrame

  local corner1 = Instance.new("UICorner")
  corner1.CornerRadius = UDim.new(0, 4)
  corner1.Parent = createBtn

  local editBtn = Instance.new("TextButton")
  editBtn.Name = "EditBtn"
  editBtn.LayoutOrder = 2
  editBtn.Size = UDim2.new(0.5, -2.5, 1, 0)
  editBtn.BackgroundColor3 = Color3.fromRGB(60, 60, 60)
  editBtn.BorderSizePixel = 0
  editBtn.Text = "Edit"
  editBtn.TextColor3 = Color3.fromRGB(255, 255, 255)
  editBtn.TextSize = 12
  editBtn.Font = Enum.Font.GothamBold
  editBtn.Parent = typeFrame

  local corner2 = Instance.new("UICorner")
  corner2.CornerRadius = UDim.new(0, 4)
  corner2.Parent = editBtn

  -- State tracking for mode
  local currentMode = "create"
  local function updateModeUI()
    if currentMode == "create" then
      createBtn.BackgroundColor3 = Color3.fromRGB(0, 162, 255)
      createBtn.TextColor3 = Color3.fromRGB(0, 0, 0)
      editBtn.BackgroundColor3 = Color3.fromRGB(60, 60, 60)
      editBtn.TextColor3 = Color3.fromRGB(255, 255, 255)
    else
      createBtn.BackgroundColor3 = Color3.fromRGB(60, 60, 60)
      createBtn.TextColor3 = Color3.fromRGB(255, 255, 255)
      editBtn.BackgroundColor3 = Color3.fromRGB(0, 162, 255)
      editBtn.TextColor3 = Color3.fromRGB(0, 0, 0)
    end
  end

  createBtn.MouseButton1Click:Connect(function()
    currentMode = "create"
    updateModeUI()
  end)

  editBtn.MouseButton1Click:Connect(function()
    currentMode = "edit"
    updateModeUI()
  end)

  -- Add code preview
  local preview = createCodePreview(scrollFrame)
  local codeText = preview:FindFirstChild("CodeText") :: TextLabel

  -- Add generate button
  local generateBtn = createButton(scrollFrame, "GenerateBtn", "⚡ Generate Code", 6)

  -- Add copy button
  local copyBtn = createButton(scrollFrame, "CopyBtn", "📋 Copy Code", 9)
  copyBtn.BackgroundColor3 = Color3.fromRGB(100, 100, 100)

  -- Add insert button
  local insertBtn = createButton(scrollFrame, "InsertBtn", "✨ Insert Code", 10)
  insertBtn.BackgroundColor3 = Color3.fromRGB(0, 180, 100)

  -- Add status label
  local statusLabel = createStatusLabel(scrollFrame)

  -- Add token settings
  local tokenBox = createTokenSettings(scrollFrame)

  -- Save token on change
  tokenBox.FocusLost:Connect(function()
    setSetting("PluginToken", tokenBox.Text)
    pluginState.apiToken = tokenBox.Text
  end)

  -- Generate button handler
  generateBtn.MouseButton1Click:Connect(function()
    if pluginState.isGenerating then
      statusLabel.Text = "⏳ Already generating..."
      return
    end

    if not pluginState.apiToken or pluginState.apiToken == "" then
      statusLabel.Text = "❌ Please enter your API token"
      statusLabel.TextColor3 = Color3.fromRGB(255, 100, 100)
      return
    end

    local prompt = promptBox.Text
    if not prompt or prompt == "" or prompt == "Create a function to..." then
      statusLabel.Text = "❌ Please enter a prompt"
      statusLabel.TextColor3 = Color3.fromRGB(255, 100, 100)
      return
    end

    pluginState.isGenerating = true
    statusLabel.Text = "🔄 Generating..."
    statusLabel.TextColor3 = Color3.fromRGB(255, 200, 0)
    generateBtn.Text = "⏳ Generating..."
    generateBtn.Enabled = false

    -- Make API request
    local requestBody = {
      pluginToken = pluginState.apiToken,
      prompt = prompt,
      requestType = currentMode,
      contextCode = getSelectedCode() or nil,
      sourceScriptName = pluginState.currentScript and pluginState.currentScript.Name or nil,
    }

    local success, response = makeApiRequest("/api/generate", "POST", requestBody)

    if success then
      local decoded, result = decodeJson(response)
      if decoded and result.success then
        codeText.Text = result.script or "No code generated"
        pluginState.lastGeneration = result.script
        statusLabel.Text = "✅ Generated successfully!"
        statusLabel.TextColor3 = Color3.fromRGB(100, 255, 100)
      else
        codeText.Text = ""
        statusLabel.Text = "❌ " .. (result.error or "Generation failed")
        statusLabel.TextColor3 = Color3.fromRGB(255, 100, 100)
      end
    else
      codeText.Text = ""
      statusLabel.Text = "❌ " .. response
      statusLabel.TextColor3 = Color3.fromRGB(255, 100, 100)
    end

    pluginState.isGenerating = false
    generateBtn.Text = "⚡ Generate Code"
    generateBtn.Enabled = true
  end)

  -- Copy button handler
  copyBtn.MouseButton1Click:Connect(function()
    if pluginState.lastGeneration then
      -- Note: Clipboard is sandboxed in Roblox, so we show it in preview
      statusLabel.Text = "📋 Code copied to preview (manual copy from preview)"
      statusLabel.TextColor3 = Color3.fromRGB(100, 200, 255)
    else
      statusLabel.Text = "❌ No code to copy"
      statusLabel.TextColor3 = Color3.fromRGB(255, 100, 100)
    end
  end)

  -- Insert button handler
  insertBtn.MouseButton1Click:Connect(function()
    if not pluginState.lastGeneration or pluginState.lastGeneration == "" then
      statusLabel.Text = "❌ No code to insert"
      statusLabel.TextColor3 = Color3.fromRGB(255, 100, 100)
      return
    end

    -- Get active script from selection
    local scripts = game:GetDescendants()
    for _, obj in ipairs(scripts) do
      if obj:IsA("Script") or obj:IsA("LocalScript") then
        pluginState.currentScript = obj
        break
      end
    end

    if not pluginState.currentScript then
      statusLabel.Text = "❌ No script found. Select a script in the tree."
      statusLabel.TextColor3 = Color3.fromRGB(255, 100, 100)
      return
    end

    local insertSuccess = insertCodeIntoScript(pluginState.lastGeneration, currentMode == "edit")
    if insertSuccess then
      statusLabel.Text = "✨ Code inserted successfully!"
      statusLabel.TextColor3 = Color3.fromRGB(100, 255, 100)
    else
      statusLabel.Text = "❌ Failed to insert code"
      statusLabel.TextColor3 = Color3.fromRGB(255, 100, 100)
    end
  end)

  -- Load saved token on startup
  pluginState.apiToken = getSetting("PluginToken", "")
  if pluginState.apiToken ~= "" then
    statusLabel.Text = "✅ Token loaded"
    statusLabel.TextColor3 = Color3.fromRGB(100, 200, 100)
  end

  -- Display the widget
  PLUGIN:Activate(widget)
  widget.Enabled = true

  print("✅ Roblox AI Assistant plugin initialized!")
end

-- Initialize on plugin load
if PLUGIN then
  initializePlugin()
else
  warn("This script must be run as a Roblox Studio plugin")
end
