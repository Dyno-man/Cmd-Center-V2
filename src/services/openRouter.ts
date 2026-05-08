import type { AppSettings, ChatMessage } from "../types/domain";

export async function sendOpenRouterChat(settings: AppSettings, messages: ChatMessage[], context: string[]) {
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
      messages: [
        {
          role: "system",
          content:
            "You are Command Center, a market intelligence assistant. Ground trade ideas in cited context, separate facts from inference, and include risk/invalidation."
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
      "Use the attached country and market context to form a directional thesis.",
      "",
      "## Entry Trigger",
      "Wait for confirmation from price action, liquidity, and a fresh corroborating article.",
      "",
      "## Risk",
      "Size the trade so a failed thesis does not impair the portfolio.",
      "",
      "## After Action",
      "Record outcome, article weights that mattered, and what should change in future scoring."
    ].join("\n");
  }

  return `${contextLine} Add an OpenRouter key in Settings for live model reasoning. Draft response: ${last}`;
}
