import React, { useState, useCallback, useEffect } from "react";
import { Box, Text } from "ink";
import TextInput from "ink-text-input";
import Spinner from "ink-spinner";
import { validateAndLoadFiles, loadAllMcpTools } from "./initialization.js";
import { marked } from "marked";
import TerminalRenderer from "marked-terminal";

// MarkdownRenderer using marked + marked-terminal (CJS compatible)
const MarkdownRenderer = (props: { children: string }) => {
	const ansi = marked(props.children, { renderer: new TerminalRenderer() });
	return <Text>{ansi}</Text>;
};
import { createAISDKTools } from "@agentic/ai-sdk";
import { openai } from "@ai-sdk/openai";
import { anthropic } from "@ai-sdk/anthropic";
import { google } from "@ai-sdk/google";
import { generateText } from "ai";

type Message = {
	role: "user" | "assistant" | "system";
	content: string;
	timestamp: Date;
	toolUsed?: string;
};

const REQUIRED_FILES = ["local-agent.json", "mcp-tools.json", "keys.json", "system.md"];
const MEMORY_DIR = "memory";

// Model selection logic from interactions.ts
function parseModelString(modelString: string): { provider: string, modelName: string } {
	if (!modelString.includes("/")) {
		return { provider: "openai", modelName: modelString };
	}
	const [provider, ...rest] = modelString.split("/");
	return { provider: provider.toLowerCase(), modelName: rest.join("/") };
}
function getClientForProvider(provider: string): ((modelName: string) => any) {
	switch (provider) {
		case "openai":
			return openai;
		case "anthropic":
			return anthropic;
		case "google":
			return google;
		default:
			throw new Error(`Unsupported AI provider: ${provider}`);
	}
}

const App: React.FC = () => {
	const [input, setInput] = useState("");
	const [conversation, setConversation] = useState<Message[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [config, setConfig] = useState<any>(null);
	const [tools, setTools] = useState<any>(null);
	const [keys, setKeys] = useState<any>(null);
	const [loadedTools, setLoadedTools] = useState<any>(null);

	const agentName = config?.name || "Local Agent";

	// Load config, tools, and keys on mount
	useEffect(() => {
		(async () => {
			try {
				const { config, tools, keys } = await validateAndLoadFiles(REQUIRED_FILES, MEMORY_DIR);
				setConfig(config);
				setTools(tools);
				setKeys(keys);
				const { loadedTools } = await loadAllMcpTools(tools);
				setLoadedTools(loadedTools);
				setIsLoading(false);
			} catch (e: any) {
				setError(e.message || "Failed to load configuration or tools.");
				setIsLoading(false);
			}
		})();
	}, []);

	// Build conversation context string (last 10 messages)
	const buildConversationContext = () => {
		if (conversation.length === 0) return "";
		const recent = conversation.slice(-10);
		let context = "\n\nCONVERSATION HISTORY:\n";
		recent.forEach((msg) => {
			const timeStr = msg.timestamp.toLocaleTimeString();
			context += `[${timeStr}] ${msg.role.toUpperCase()}: ${msg.content}\n`;
			if (msg.toolUsed) {
				context += `[${timeStr}] TOOL_USED: ${msg.toolUsed}\n`;
			}
		});
		return context;
	};

	const handleSubmit = useCallback(async (value: string) => {
		setError(null);
		setIsLoading(true);
		const userMsg: Message = {
			role: "user",
			content: value,
			timestamp: new Date()
		};
		setConversation((prev) => [...prev, userMsg]);
		setInput("");

		try {
			// Prepare tools for LLM
			const mcpToolInstances = loadedTools ? Object.values(loadedTools) : [];
			const allTools = mcpToolInstances.length === 1
				? createAISDKTools(mcpToolInstances[0] as any)
				: createAISDKTools(...(mcpToolInstances as any[]));

			// Build prompt with context
			const contextualPrompt = value + buildConversationContext();

			// Model selection
			const { provider, modelName } = parseModelString(config.model);
			const client = getClientForProvider(provider);
			const model = client(modelName);

			const result = await generateText({
				model,
				tools: allTools,
				temperature: config.temperature,
				system: config.system,
				prompt: contextualPrompt
			});

			let assistantResponse = "";
			if (typeof result.text === "string" && result.text.trim() !== "") {
				assistantResponse = result.text;
			} else {
				assistantResponse = JSON.stringify(result, null, 2);
			}

			const agentMsg: Message = {
				role: "assistant",
				content: assistantResponse,
				timestamp: new Date()
			};
			setConversation((prev) => [...prev, agentMsg]);
		} catch (e: any) {
			setError(e.message || "Unknown error");
		} finally {
			setIsLoading(false);
		}
	}, [loadedTools, config, conversation]);

	if (isLoading) {
		return (
			<Box flexDirection="column" padding={1}>
				<Text color="yellow">
					<Spinner type="dots" /> Loading configuration and tools...
				</Text>
			</Box>
		);
	}

	if (error) {
		return (
			<Box flexDirection="column" padding={1}>
				<Text color="red">Error: {error}</Text>
			</Box>
		);
	}

	return (
		<Box flexDirection="column" padding={1}>
			<Text color="green">Welcome to the Ink-based Local Agent CLI!</Text>
			<Text>
				Type your prompt for <Text color="yellow">{agentName}</Text> (Ctrl+C to exit):
			</Text>
			<Box flexDirection="column" marginTop={1} marginBottom={1}>
				{conversation.map((msg, idx) => (
					<Box key={idx} flexDirection="column" marginBottom={1}>
						<Text color={msg.role === "user" ? "blue" : msg.role === "assistant" ? "yellow" : "gray"}>
							{msg.role === "user" ? "You" : agentName}:
						</Text>
						<MarkdownRenderer>{msg.content}</MarkdownRenderer>
					</Box>
				))}
			</Box>
			<TextInput
				value={input}
				onChange={setInput}
				onSubmit={handleSubmit}
				placeholder="Enter your prompt"
			/>
		</Box>
	);
};

export default App;