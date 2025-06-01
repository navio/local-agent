# local-agent

A CLI agentic system for orchestrating tools and memory using the [agentic](https://github.com/transitive-bullshit/agentic) framework.  
**local-agent runs an agent with MCPs (Model Context Protocol tools) scoped to the root folder where it is launched, providing per-folder and per-file context, structure, and requirements.**  
Users can define the agent's structure, tools, and requirements specifically for each folder, enabling flexible, multi-root, and multi-file support.

**local-agent also allows you to set, per scope (folder/root), the MCP tools and system prompt, providing tailored direction for editing files, remembering the project scope, and recording all changes and interactions in the session log.**

---

## 🚀 Quick Start

### Run with npx (Recommended)

```sh
npx local-agent
```

### Install Globally

```sh
npm install -g local-agent
local-agent
```

---

## 🗂️ Scoping and Multi-Root Support

- **Root Scope:** When you run `local-agent` in a folder, it becomes the "root" scope for that agent instance.
- **Per-Folder/Per-File Context:** Each root can have its own configuration, tools, and requirements, defined by the user.
- **Per-Scope Tools & Prompts:** You can set different MCP tools and system prompts for each folder/root, giving the agent specific direction and memory for that context.
- **Multi-File/Folder Access:** The agent can access and operate on multiple files and subfolders within its root.
- **Multiple Roots:** You can run separate local-agent instances in different folders, each with its own context and configuration.
- **User-Defined Structure:** Users are encouraged to define the structure, requirements, and tools for each folder, making local-agent adaptable to diverse project layouts.

---

## 🏁 What Happens on First Run?

- Checks for required files: `system.md`, `local-agent.json`, `mcp-tools.json`, `keys.json`
- Prompts you to create any missing files (with templates or empty)
- Creates a `memory/` directory for session logs
- Loads default and custom MCPs (tools) from `mcp-tools.json`, scoped to the current folder/root
- Starts an interactive CLI session, using the system prompt and tools defined for the current scope

---

---
## 🤖 Model Provider Selection & Usage

local-agent supports multiple AI model providers via the [ai-sdk](https://ai-sdk.dev/docs/introduction) ecosystem. You can select and use different models by specifying the provider and model in your configuration.

### Supported Providers

- **OpenAI** (`@ai-sdk/openai`)
- **Anthropic** (`@ai-sdk/anthropic`)
- **Google** (`@ai-sdk/google`)
- **OpenRouter** (`@openrouter/ai-sdk-provider`)

> **Note:** "Custom" models are not currently supported due to SDK limitations.

### How to Select a Model

Set the `model` field in your configuration (e.g., `local-agent.json`) to a string in the format:

```
provider/model-name
```

- `provider`: The AI provider to use (e.g., `openai`, `anthropic`, `google`, `openrouter`)
- `model-name`: The specific model for that provider

#### Examples

##### OpenAI

```json
{
  "model": "openai/gpt-4o-mini"
---
## 🧩 Adding and Using MCP Tools

local-agent is designed to be highly extensible through Model Context Protocol (MCP) tools. MCP tools provide additional capabilities (such as file system access, memory, or custom APIs) and are loaded per project scope (the folder where you invoke the agent).

### How MCP Tools Work

- **Per-Scope Loading:** When you run `local-agent` in a folder, it loads MCP tools defined in that folder's configuration. Each folder/root can have its own set of tools, system prompt, and settings.
- **Initialization:** On first run, the agent will prompt you to create missing configuration files, including `mcp-tools.json`, and will initialize the folder with sensible defaults.
- **Isolation:** Each agent instance operates only within the folder where it was started, using only the tools and context defined there.

### Adding MCP Tools

To add or customize MCP tools for your project:

1. Open (or create) the `mcp-tools.json` file in your project root.
2. Add tool definitions as objects in a JSON array.

#### Example: Basic MCP Tools Configuration

```json
[
  {
    "name": "basic-memory",
    "module": "basic-memory",
    "options": { "memoryDir": "memory" }
  },
  {
    "name": "server-filesystem",
    "module": "@modelcontextprotocol/server-filesystem",
    "options": { "accessPath": "." }
  }
]
```

- **basic-memory:** Provides session memory and logging.
- **server-filesystem:** Allows the agent to read/write files in the current folder.

#### Example: Adding a Custom Tool

```json
[
  {
    "name": "basic-memory",
    "module": "basic-memory",
    "options": { "memoryDir": "memory" }
  },
  {
    "name": "server-filesystem",
    "module": "@modelcontextprotocol/server-filesystem",
    "options": { "accessPath": "." }
  },
  {
    "name": "my-custom-api",
    "module": "my-custom-mcp-module",
    "options": { "apiKey": "YOUR_API_KEY" }
  }
]
```

- Add your own MCP tool by specifying its `name`, `module`, and any required `options`.

### Key Features of Per-Scope Agents

- **Scoped Context:** Each agent instance is fully isolated to the folder where it is invoked. All memory, tools, and configuration are local to that folder.
- **Automatic Initialization:** On first run, the agent will create missing config files (`system.md`, `local-agent.json`, `mcp-tools.json`, `keys.json`) and initialize the folder for you.
- **Customizable:** You can tailor the agent's tools, system prompt, and settings for each project or folder independently.
- **Safe by Default:** The agent cannot access files or tools outside the current scope unless explicitly configured.

### Practical Workflow

1. **Initialize a new project folder:**
   ```sh
   mkdir my-project
   cd my-project
   npx local-agent
   ```
   - The agent will prompt you to create configuration files if they are missing.

2. **Customize your tools:**
   - Edit `mcp-tools.json` to add, remove, or configure MCP tools as needed.

3. **Run the agent:**
   - All actions, memory, and tools are scoped to the current folder.

For more details on available MCP tools and advanced configuration, see the [ARCHITECTURE.md](ARCHITECTURE.md) and [AI_CLIENT_PROVIDER_REFACTOR.md](AI_CLIENT_PROVIDER_REFACTOR.md) documents.

---
}
```
- Uses OpenAI as the provider with the `gpt-4o-mini` model.

##### Anthropic

```json
{
  "model": "anthropic/claude-3-5-sonnet-latest"
}
```
- Uses Anthropic as the provider with the `claude-3-5-sonnet-latest` model.

##### Google

```json
{
  "model": "google/models/gemini-2.0-flash-exp"
}
```
- Uses Google as the provider with the `gemini-2.0-flash-exp` model.

##### OpenRouter

```json
{
  "model": "openrouter/meta-llama/llama-3.1-405b-instruct"
}
```
- Uses OpenRouter as the provider with the `meta-llama/llama-3.1-405b-instruct` model.

### How to Switch Models

To switch between providers or models, simply update the `model` field in your configuration to the desired provider/model string as shown above. No code changes are required.

### Practical Usage Scenarios

- **Switching from OpenAI to Anthropic:**
  1. Open your `local-agent.json` config.
  2. Change `"model": "openai/gpt-4o-mini"` to `"model": "anthropic/claude-3-5-sonnet-latest"`.
  3. Save and restart the agent.

- **Using Google Gemini:**
  1. Set `"model": "google/models/gemini-2.0-flash-exp"` in your config.
  2. Ensure you have the correct API keys for Google in your `keys.json`.
  3. Save and restart the agent.

- **Using OpenRouter for advanced routing:**
  1. Set `"model": "openrouter/meta-llama/llama-3.1-405b-instruct"` in your config.
  2. Add your OpenRouter API key to `keys.json` as `"openrouter": "your-openrouter-api-key-here"`.
  3. Save and restart the agent.

### API Key Configuration

Add the required API keys for each provider in your `keys.json` file:

```json
{
  "openai": "your-openai-api-key-here",
  "openrouter": "your-openrouter-api-key-here",
  "anthropic": "your-anthropic-api-key-here",
  "google": "your-google-api-key-here"
}
```

### Requirements

- Ensure the relevant provider's package is installed (see `package.json`).
- Add the required API keys for each provider in your `keys.json` file.

### Troubleshooting

- If you see errors about missing modules, run `npm install` to ensure all dependencies are installed.
- If you see errors about missing API keys, add them to your `keys.json` file.

For more details, see the [AI Client Provider Refactor Design Document](AI_CLIENT_PROVIDER_REFACTOR.md).

---
## ⚙️ Configuration

- **system.md**: System prompt and agent instructions, specific to the folder/root.  
  _Set the direction and behavior of the agent for this scope._
- **local-agent.json**: Agent configuration (name, settings, etc.) for the current root.
- **mcp-tools.json**: List of MCP tools to load (default MCPs are injected if missing), can be tailored per folder/root.
  _Choose which tools are available for the agent in this scope._
- **keys.json**: API keys for different providers (OpenAI, OpenRouter, Anthropic, Google) for the current root.

You can edit these files at any time to change agent behavior for the current folder.

---

## 🧩 Extending with MCPs

Add additional MCPs by editing `mcp-tools.json`. Example:

```json
[
  {
    "name": "basic-memory",
    "module": "basic-memory",
    "options": { "memoryDir": "memory" }
  },
  {
    "name": "server-filesystem",
    "module": "@modelcontextprotocol/server-filesystem",
    "options": { "accessPath": "." }
  }
  // Add more MCPs here
]
```

Default MCPs (`basic-memory`, `server-filesystem`) are always loaded if not present.

---

## 🔄 Restarting or Re-initializing

- To restart, simply run `npx local-agent` again in the same folder (root).
- To re-initialize, delete or edit the config files and run the CLI; missing files will be recreated as needed.
- To use a different root, run `local-agent` in another folder with its own configuration.

---

## 📝 Session Logging & Change Tracking

All interactions and changes are logged in the `memory/` directory as markdown files, organized by session and scoped to the current root.  
**When you edit files or perform actions, local-agent records the context, scope, and changes, helping you track project history and agent decisions.**

---

## 🛠️ Troubleshooting

- **Missing files?** The CLI will prompt you to create them.
- **API key issues?** Add your keys to `keys.json`.
- **Custom tools not loading?** Check your `mcp-tools.json` syntax and module availability.
- **Multi-root confusion?** Each folder/root is independent; ensure you are in the correct directory for your intended agent context.

---

## 📦 Release & Contribution

- To publish: `npm publish`
- Contributions welcome! See `ARCHITECTURE.md` for design details.

---

## 📚 References

- [agentic](https://github.com/transitive-bullshit/agentic)
- [basic-memory](https://github.com/basicmachines-co/basic-memory)
- [@modelcontextprotocol/server-filesystem](https://github.com/modelcontextprotocol/server-filesystem)