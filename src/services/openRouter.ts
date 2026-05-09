import type { AppSettings, ChatMessage } from "../types/domain";
import { invoke } from "@tauri-apps/api/core";

const isTauri = () => "__TAURI_INTERNALS__" in window;

const COMMAND_CENTER_SYSTEM_PROMPT = [
  "You are Command Center, a market intelligence assistant.",
  "Answer succinctly and focus on action.",
  "Prioritize: direct answer, actionable plan, important reasoning only when needed, and clear follow-up options.",
  "Use attached context as evidence, separate facts from inference, and include risk or invalidation when it materially changes the action.",
  "Avoid long explanations unless the user asks for more detail."
].join(" ");

export async function sendOpenRouterChat(settings: AppSettings, messages: ChatMessage[], context: string[]) {
  if (isTauri()) {
    try {
      return await invoke<string>("send_openrouter_chat", { settings, messages, context });
    } catch (error) {
      console.warn("Using browser OpenRouter fallback", error);
    }
  }

  if (!settings.openRouterApiKey) {
    return fallbackAssistant(messages, context);
  }

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${settings.openRouterApiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "http://localhost:1420",
      "X-Title": "Command Center"
    },
    body: JSON.stringify({
      model: settings.openRouterModel,
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content: COMMAND_CENTER_SYSTEM_PROMPT
        },
        context.length
          ? { role: "system", content: `Attached context:\n${context.join("\n\n")}` }
          : { role: "system", content: "No external context is attached." },
        ...messages.slice(-12).map((message) => ({
          role: message.role === "assistant" ? "assistant" : "user",
          content: message.content
        }))
      ]
    })
  });

  if (!response.ok) {
    throw new Error(`OpenRouter request failed: ${response.status}`);
  }

  const payload = await response.json();
  return payload.choices?.[0]?.message?.content ?? "No model response returned.";
}

function fallbackAssistant(messages: ChatMessage[], context: string[]) {
  const last = messages[messages.length - 1]?.content ?? "";
  const contextLine = context.length
    ? `I have ${context.length} context item${context.length === 1 ? "" : "s"} attached.`
    : "No context is attached yet.";

  if (last.startsWith("/finalize")) {
    return [
      "# Plan Of Action",
      "",
      "## Thesis",
      "Use the attached market context as evidence, then form a directional thesis only after confirmation.",
      "",
      "## Next Actions",
      "Wait for confirmation from price action, liquidity, and a fresh corroborating article.",
      "",
      "## Risk",
      "Define invalidation before sizing the trade."
    ].join("\n");
  }

  return `${contextLine} Add an OpenRouter key in Settings for live model reasoning. Short read: treat this as a watch item, define the affected market, wait for confirmation, and set an invalidation level. Draft request: ${last}`;
}
