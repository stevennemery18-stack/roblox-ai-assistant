-- 🤖 Roblox AI Assistant Plugin
-- Production-ready Roblox Studio plugin for AI code generation
-- Version: 1.0.0
-- API: https://roblox-ai-api-s4ls.onrender.com

local HttpService = game:GetService("HttpService")
local ChangeHistoryService = game:GetService("ChangeHistoryService")

-- ============================================
-- CONFIGURATION
-- ============================================

local CONFIG = {
  API_URL = "https://roblox-ai-api-s4ls.onrender.com", -- ✅ PRODUCTION API
  REQUEST_TIMEOUT = 30,
  PLUGIN_VERSION = "1.0.0",
}

-- ============================================
-- PLUGIN STATE
-- ============================================

local PluginState = {
  apiToken = "",
  isGenerating = false,
  lastGeneration = nil,
  mode = "create", -- "create" or "edit"
}

-- ============================================
-- UTILITY FUNCTIONS
-- ============================================

local function getSetting(key: string, defaultValue: any): any
  local success, result = pcall(function()
    if plugin then
      return plugin:GetSetting("RobloxAI_" .. key)
    end
  end)
  return if success and result ~= nil then result else defaultValue
end

local function setSetting(key: string, value: any): boolean
  local success = pcall(function()
    if plugin then
      plugin:SetSetting("RobloxAI_" .. key, value)
    end
  end)
  return success
end

local function makeApiRequest(endpoint: string, body: table): (boolean, string)
  local url = CONFIG.API_URL .. endpoint
  
  local success, response = pcall(function()
    return HttpService:PostAsync(
      url,
      HttpService:JSONEncode(body),
      Enum.HttpContentType.ApplicationJson,
      false,
      nil,
      CONFIG.REQUEST_TIMEOUT
    )
  end)

  if not success then
    return false, "Network error: " .. tostring(response)
  end

  return true, response
end

local function decodeJson(jsonString: string): (boolean, table)
  local success, result = pcall(function()
    return HttpService:JSONDecode(jsonString)
  end)
  return success, if success then result else {}
end

local function formatError(errorMsg: string): string
  if string.find(errorMsg, "Network error") then
    return "❌ Network error - check connection"
  elseif string.find(errorMsg, "401") then
    return "❌ Invalid token"
  else
    return "❌ " .. string.sub(errorMsg, 1, 50)
  end
end

-- ============================================
-- UI SETUP
-- ============================================

local function initializePlugin()
  if not plugin then
    warn("Must run as plugin")
    return
  end

  -- Create widget
  local widget = Instance.new("DockWidgetPluginGui")
  widget.Name = "RobloxAIAssistant"
  widget.Title = "🤖 Roblox AI Assistant"
  widget.InitialDockState = Enum.InitialDockState.Right
  widget.FloatingSize = UDim2.new(0, 380, 0, 700)
  widget.MinSize = UDim2.new(0, 300, 0, 500)

  local container = Instance.new("Frame")
  container.Size = UDim2.new(1, 0, 1, 0)
  container.BackgroundColor3 = Color3.fromRGB(25, 25, 25)
  container.BorderSizePixel = 0
  container.Parent = widget

  local scrollFrame = Instance.new("ScrollingFrame")
  scrollFrame.Size = UDim2.new(1, -10, 1, -10)
  scrollFrame.Position = UDim2.new(0, 5, 0, 5)
  scrollFrame.BackgroundColor3 = Color3.fromRGB(25, 25, 25)
  scrollFrame.BorderSizePixel = 0
  scrollFrame.CanvasSize = UDim2.new(0, 0, 0, 1000)
  scrollFrame.ScrollBarThickness = 6
  scrollFrame.Parent = container

  local listLayout = Instance.new("UIListLayout")
  listLayout.Padding = UDim.new(0, 10)
  listLayout.FillDirection = Enum.FillDirection.Vertical
  listLayout.SortOrder = Enum.SortOrder.LayoutOrder
  listLayout.Parent = scrollFrame

  listLayout:GetPropertyChangedSignal("AbsoluteContentSize"):Connect(function()
    scrollFrame.CanvasSize = UDim2.new(0, 0, 0, listLayout.AbsoluteContentSize.Y + 20)
  end)

  -- Helper: Create label
  local function label(text: string, order: number, size: number, bold: boolean)
    local lbl = Instance.new("TextLabel")
    lbl.LayoutOrder = order
    lbl.Size = UDim2.new(1, 0, 0, size)
    lbl.BackgroundTransparency = 1
    lbl.Text = text
    lbl.TextColor3 = Color3.fromRGB(200, 200, 200)
    lbl.TextSize = 12
    lbl.Font = if bold then Enum.Font.GothamBold else Enum.Font.Gotham
    lbl.TextXAlignment = Enum.TextXAlignment.Left
    lbl.TextWrapped = true
    lbl.Parent = scrollFrame
    return lbl
  end

  -- Helper: Create button
  local function button(text: string, order: number, color: Color3)
    local btn = Instance.new("TextButton")
    btn.LayoutOrder = order
    btn.Size = UDim2.new(1, 0, 0, 36)
    btn.BackgroundColor3 = color
    btn.BorderSizePixel = 0
    btn.Text = text
    btn.TextColor3 = Color3.fromRGB(255, 255, 255)
    btn.TextSize = 12
    btn.Font = Enum.Font.GothamBold
    btn.Parent = scrollFrame
    local corner = Instance.new("UICorner")
    corner.CornerRadius = UDim.new(0, 4)
    corner.Parent = btn
    return btn
  end

  -- Helper: Create textbox
  local function textbox(placeholder: string, order: number, height: number)
    local box = Instance.new("TextBox")
    box.LayoutOrder = order
    box.Size = UDim2.new(1, 0, 0, height)
    box.BackgroundColor3 = Color3.fromRGB(40, 40, 40)
    box.BorderColor3 = Color3.fromRGB(80, 80, 80)
    box.BorderSizePixel = 1
    box.TextColor3 = Color3.fromRGB(255, 255, 255)
    box.TextSize = 11
    box.Font = Enum.Font.Gotham
    box.TextWrapped = true
    box.ClearTextOnFocus = false
    box.PlaceholderText = placeholder
    box.Parent = scrollFrame
    local corner = Instance.new("UICorner")
    corner.CornerRadius = UDim.new(0, 4)
    corner.Parent = box
    return box
  end

  -- Helper: Create status label
  local function status_label(order: number)
    local stat = Instance.new("TextLabel")
    stat.Name = "StatusLabel"
    stat.LayoutOrder = order
    stat.Size = UDim2.new(1, 0, 0, 30)
    stat.BackgroundColor3 = Color3.fromRGB(30, 30, 30)
    stat.BorderColor3 = Color3.fromRGB(80, 80, 80)
    stat.BorderSizePixel = 1
    stat.Text = "✅ Ready"
    stat.TextColor3 = Color3.fromRGB(100, 200, 100)
    stat.TextSize = 11
    stat.Font = Enum.Font.Gotham
    stat.TextWrapped = true
    stat.Parent = scrollFrame
    local corner = Instance.new("UICorner")
    corner.CornerRadius = UDim.new(0, 4)
    corner.Parent = stat
    return stat
  end

  -- UI ELEMENTS
  label("🤖 Roblox AI Assistant v" .. CONFIG.PLUGIN_VERSION, 1, 25, true)
  label("Generate Luau code with AI", 2, 18, false)
  
  label("🔑 API Token", 3, 20, true)
  local tokenBox = textbox("Paste your API token here", 4, 36)
  tokenBox.Text = getSetting("token", "")

  label("📝 Mode", 5, 20, true)
  local modeFrame = Instance.new("Frame")
  modeFrame.LayoutOrder = 6
  modeFrame.Size = UDim2.new(1, 0, 0, 36)
  modeFrame.BackgroundTransparency = 1
  modeFrame.Parent = scrollFrame
  local modeLayout = Instance.new("UIListLayout")
  modeLayout.Padding = UDim.new(0, 5)
  modeLayout.FillDirection = Enum.FillDirection.Horizontal
  modeLayout.SortOrder = Enum.SortOrder.LayoutOrder
  modeLayout.Parent = modeFrame

  local createBtn = Instance.new("TextButton")
  createBtn.LayoutOrder = 1
  createBtn.Size = UDim2.new(0.5, -2.5, 1, 0)
  createBtn.BackgroundColor3 = Color3.fromRGB(0, 162, 255)
  createBtn.BorderSizePixel = 0
  createBtn.Text = "✨ Create"
  createBtn.TextColor3 = Color3.fromRGB(255, 255, 255)
  createBtn.TextSize = 11
  createBtn.Font = Enum.Font.GothamBold
  createBtn.Parent = modeFrame
  local corner1 = Instance.new("UICorner")
  corner1.CornerRadius = UDim.new(0, 4)
  corner1.Parent = createBtn

  local editBtn = Instance.new("TextButton")
  editBtn.LayoutOrder = 2
  editBtn.Size = UDim2.new(0.5, -2.5, 1, 0)
  editBtn.BackgroundColor3 = Color3.fromRGB(60, 60, 60)
  editBtn.BorderSizePixel = 0
  editBtn.Text = "✏️ Edit"
  editBtn.TextColor3 = Color3.fromRGB(255, 255, 255)
  editBtn.TextSize = 11
  editBtn.Font = Enum.Font.GothamBold
  editBtn.Parent = modeFrame
  local corner2 = Instance.new("UICorner")
  corner2.CornerRadius = UDim.new(0, 4)
  corner2.Parent = editBtn

  local function updateModeUI()
    if PluginState.mode == "create" then
      createBtn.BackgroundColor3 = Color3.fromRGB(0, 162, 255)
      editBtn.BackgroundColor3 = Color3.fromRGB(60, 60, 60)
    else
      createBtn.BackgroundColor3 = Color3.fromRGB(60, 60, 60)
      editBtn.BackgroundColor3 = Color3.fromRGB(0, 162, 255)
    end
  end

  createBtn.MouseButton1Click:Connect(function()
    PluginState.mode = "create"
    updateModeUI()
  end)

  editBtn.MouseButton1Click:Connect(function()
    PluginState.mode = "edit"
    updateModeUI()
  end)

  label("💬 What do you need?", 7, 20, true)
  local promptBox = textbox("Describe what code you need...", 8, 80)

  label("💻 Generated Code", 9, 20, false)
  local codePreview = Instance.new("TextLabel")
  codePreview.Name = "CodePreview"
  codePreview.LayoutOrder = 10
  codePreview.Size = UDim2.new(1, 0, 0, 120)
  codePreview.BackgroundColor3 = Color3.fromRGB(15, 15, 15)
  codePreview.BorderColor3 = Color3.fromRGB(80, 80, 80)
  codePreview.BorderSizePixel = 1
  codePreview.TextColor3 = Color3.fromRGB(0, 200, 100)
  codePreview.TextSize = 9
  codePreview.Font = Enum.Font.Courier
  codePreview.TextWrapped = true
  codePreview.TextXAlignment = Enum.TextXAlignment.Left
  codePreview.TextYAlignment = Enum.TextYAlignment.Top
  codePreview.Text = "Generated code will appear here..."
  codePreview.Parent = scrollFrame
  local previewCorner = Instance.new("UICorner")
  previewCorner.CornerRadius = UDim.new(0, 4)
  previewCorner.Parent = codePreview

  local generateBtn = button("⚡ Generate Code", 11, Color3.fromRGB(0, 162, 255))
  local statusLabel = status_label(12)
  local insertBtn = button("✨ Insert into Script", 13, Color3.fromRGB(0, 180, 100))
  
  label("💡 Paste token, write prompt, click Generate!", 14, 30, false)

  -- ============================================
  -- EVENT HANDLERS
  -- ============================================

  tokenBox.FocusLost:Connect(function()
    setSetting("token", tokenBox.Text)
    PluginState.apiToken = tokenBox.Text
    if PluginState.apiToken ~= "" then
      statusLabel.Text = "✅ Token saved"
      statusLabel.TextColor3 = Color3.fromRGB(100, 200, 100)
    end
  end)

  generateBtn.MouseButton1Click:Connect(function()
    if PluginState.isGenerating then
      statusLabel.Text = "⏳ Already generating..."
      return
    end

    PluginState.apiToken = tokenBox.Text
    if not PluginState.apiToken or PluginState.apiToken == "" then
      statusLabel.Text = "❌ Please enter your API token"
      statusLabel.TextColor3 = Color3.fromRGB(255, 100, 100)
      return
    end

    local prompt = promptBox.Text:match("^%s*(.-)%s*$")
    if not prompt or prompt == "" then
      statusLabel.Text = "❌ Please enter a prompt"
      statusLabel.TextColor3 = Color3.fromRGB(255, 100, 100)
      return
    end

    PluginState.isGenerating = true
    statusLabel.Text = "🔄 Generating..."
    statusLabel.TextColor3 = Color3.fromRGB(255, 200, 0)
    generateBtn.Text = "⏳ Generating..."
    generateBtn.Enabled = false

    local requestBody = {
      api_token = PluginState.apiToken,
      prompt = prompt,
      request_type = PluginState.mode,
    }

    local success, response = makeApiRequest("/api/generate", requestBody)

    if success then
      local decoded, result = decodeJson(response)
      if decoded and result.success then
        PluginState.lastGeneration = result.script or ""
        codePreview.Text = PluginState.lastGeneration ~= "" and PluginState.lastGeneration or "No code generated"
        statusLabel.Text = "✅ Code generated!"
        statusLabel.TextColor3 = Color3.fromRGB(100, 200, 100)
      else
        statusLabel.Text = formatError(result.error or "Failed")
        statusLabel.TextColor3 = Color3.fromRGB(255, 100, 100)
      end
    else
      statusLabel.Text = formatError(response)
      statusLabel.TextColor3 = Color3.fromRGB(255, 100, 100)
    end

    PluginState.isGenerating = false
    generateBtn.Text = "⚡ Generate Code"
    generateBtn.Enabled = true
  end)

  insertBtn.MouseButton1Click:Connect(function()
    if not PluginState.lastGeneration or PluginState.lastGeneration == "" then
      statusLabel.Text = "❌ Generate code first"
      statusLabel.TextColor3 = Color3.fromRGB(255, 100, 100)
      return
    end

    local success = pcall(function()
      local selection = game:GetSelection()
      local targetScript = nil

      if selection and #selection:GetChildren() > 0 then
        for _, obj in ipairs(selection:GetChildren()) do
          if obj:IsA("Script") or obj:IsA("LocalScript") then
            targetScript = obj
            break
          end
        end
      end

      if not targetScript then
        statusLabel.Text = "❌ Select a Script first"
        statusLabel.TextColor3 = Color3.fromRGB(255, 100, 100)
        return
      end

      targetScript.Source = targetScript.Source .. "\n\n" .. PluginState.lastGeneration
      ChangeHistoryService:SetWaypoint("AI Generated Code")

      statusLabel.Text = "✨ Code inserted!"
      statusLabel.TextColor3 = Color3.fromRGB(100, 255, 100)
    end)

    if not success then
      statusLabel.Text = "❌ Failed to insert"
      statusLabel.TextColor3 = Color3.fromRGB(255, 100, 100)
    end
  end)

  PluginState.apiToken = getSetting("token", "")
  if PluginState.apiToken ~= "" then
    statusLabel.Text = "✅ Token loaded"
    statusLabel.TextColor3 = Color3.fromRGB(100, 200, 100)
  else
    statusLabel.Text = "ℹ️ Ready - paste token"
    statusLabel.TextColor3 = Color3.fromRGB(100, 200, 255)
  end

  plugin:Activate(widget)
  widget.Enabled = true

  print("✅ Roblox AI Assistant initialized!")
  print("📍 API: " .. CONFIG.API_URL)
end

initializePlugin()
