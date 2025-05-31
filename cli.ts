import 'dotenv/config'
import { validateAndLoadFiles, loadAllMcpTools, GREEN, RED, RESET } from "./initialization";
import { runInteractiveSession } from "./interactions";
import { createSessionFile } from "./memory";

const REQUIRED_FILES = [
  "system.md",
  "config.json",
  "tools.json",
  "keys.json"
];
const MEMORY_DIR = "memory";

async function main() {
  console.log("Agentech System CLI");
  const { config, tools, keys } = validateAndLoadFiles(REQUIRED_FILES, MEMORY_DIR);

  // Set the OPENAI_API_KEY env var if found in keys.json
  const openaiApiKey = keys["openai"] || process.env.OPENAI_API_KEY;
  if (openaiApiKey) {
    process.env.OPENAI_API_KEY = openaiApiKey;
  }

  // Load all MCP tools
  const { loadedTools, toolStatus } = await loadAllMcpTools(tools);

  // Display a single row listing all tools, green if loaded, red if not
  const toolRow =
    "tools: [" +
    toolStatus
      .map((t) =>
        t.status === "success"
          ? `${GREEN}${t.name}${RESET}`
          : `${RED}${t.name}${RESET}`
      )
      .join(", ") +
    "]";
  console.log(toolRow);

  // Prepare session memory log file
  const now = new Date();
  let toolStatusMd = "";
  for (const t of toolStatus) {
    if (t.status === "success") {
      toolStatusMd += `- ${t.name}: ✅ loaded\n`;
    } else {
      toolStatusMd += `- ${t.name}: ❌ failed (${t.error})\n`;
    }
  }
  toolStatusMd += "\n";
  const sessionFile = createSessionFile(now, toolRow, toolStatusMd);

  // Pass all loaded tools to the session
  runInteractiveSession(config, loadedTools, sessionFile);
}

main();
