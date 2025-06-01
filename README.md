# localagent

A CLI agentic system for orchestrating tools and memory using the [agentic](https://github.com/transitive-bullshit/agentic) framework.  
**localagent runs an agent with MCPs (Model Context Protocol tools) scoped to the root folder where it is launched, providing per-folder and per-file context, structure, and requirements.**  
Users can define the agent's structure, tools, and requirements specifically for each folder, enabling flexible, multi-root, and multi-file support.

**localagent also allows you to set, per scope (folder/root), the MCP tools and system prompt, providing tailored direction for editing files, remembering the project scope, and recording all changes and interactions in the session log.**

---

## 🚀 Quick Start

### Run with npx (Recommended)

```sh
npx localagent
```

### Install Globally

```sh
npm install -g localagent
localagent
```

---

## 🗂️ Scoping and Multi-Root Support

- **Root Scope:** When you run `localagent` in a folder, it becomes the "root" scope for that agent instance.
- **Per-Folder/Per-File Context:** Each root can have its own configuration, tools, and requirements, defined by the user.
- **Per-Scope Tools & Prompts:** You can set different MCP tools and system prompts for each folder/root, giving the agent specific direction and memory for that context.
- **Multi-File/Folder Access:** The agent can access and operate on multiple files and subfolders within its root.
- **Multiple Roots:** You can run separate localagent instances in different folders, each with its own context and configuration.
- **User-Defined Structure:** Users are encouraged to define the structure, requirements, and tools for each folder, making localagent adaptable to diverse project layouts.

---

## 🏁 What Happens on First Run?

- Checks for required files: `system.md`, `config.json`, `tools.json`, `keys.json`
- Prompts you to create any missing files (with templates or empty)
- Creates a `memory/` directory for session logs
- Loads default and custom MCPs (tools) from `tools.json`, scoped to the current folder/root
- Starts an interactive CLI session, using the system prompt and tools defined for the current scope

---

## ⚙️ Configuration

- **system.md**: System prompt and agent instructions, specific to the folder/root.  
  _Set the direction and behavior of the agent for this scope._
- **config.json**: Agent configuration (name, settings, etc.) for the current root.
- **tools.json**: List of MCP tools to load (default MCPs are injected if missing), can be tailored per folder/root.  
  _Choose which tools are available for the agent in this scope._
- **keys.json**: API keys (e.g., OpenAI) for the current root.

You can edit these files at any time to change agent behavior for the current folder.

---

## 🧩 Extending with MCPs

Add additional MCPs by editing `tools.json`. Example:

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

- To restart, simply run `npx localagent` again in the same folder (root).
- To re-initialize, delete or edit the config files and run the CLI; missing files will be recreated as needed.
- To use a different root, run `localagent` in another folder with its own configuration.

---

## 📝 Session Logging & Change Tracking

All interactions and changes are logged in the `memory/` directory as markdown files, organized by session and scoped to the current root.  
**When you edit files or perform actions, localagent records the context, scope, and changes, helping you track project history and agent decisions.**

---

## 🛠️ Troubleshooting

- **Missing files?** The CLI will prompt you to create them.
- **API key issues?** Add your keys to `keys.json`.
- **Custom tools not loading?** Check your `tools.json` syntax and module availability.
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