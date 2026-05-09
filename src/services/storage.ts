import { invoke } from "@tauri-apps/api/core";
import { sampleSnapshot } from "../data/sampleData";
import { ensureUsableSnapshot, fetchLiveSnapshot } from "./liveData";
import type { AppSettings, ChatMessage, ChatThread, CommandCenterSnapshot, Skill } from "../types/domain";

const SNAPSHOT_KEY = "command-center:snapshot";
const SETTINGS_KEY = "command-center:settings";
const PLANS_KEY = "command-center:plans";
const CHAT_THREADS_KEY = "command-center:chat-threads";
const CHAT_MESSAGES_KEY = "command-center:chat-messages";

const isTauri = () => "__TAURI_INTERNALS__" in window;

export const defaultSettings: AppSettings = {
  openRouterApiKey: import.meta.env.VITE_OPENROUTER_API_KEY ?? "",
  openRouterModel: import.meta.env.VITE_OPENROUTER_MODEL ?? "openai/gpt-4.1-mini",
  financeApiKey: import.meta.env.VITE_FINANCE_API_KEY ?? "",
  refreshMinutes: 60
};

export async function loadSnapshot(): Promise<CommandCenterSnapshot> {
  if (isTauri()) {
    try {
      return ensureUsableSnapshot(await invoke<CommandCenterSnapshot>("load_snapshot"));
    } catch (error) {
      console.warn("Falling back to browser snapshot", error);
    }
  }

  const raw = localStorage.getItem(SNAPSHOT_KEY);
  return raw ? ensureUsableSnapshot(JSON.parse(raw)) : sampleSnapshot;
}

export async function saveSnapshot(snapshot: CommandCenterSnapshot) {
  if (isTauri()) {
    try {
      await invoke("save_snapshot", { snapshot });
      return;
    } catch (error) {
      console.warn("Falling back to browser snapshot save", error);
    }
  }

  localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(snapshot));
}

export async function loadSettings(): Promise<AppSettings> {
  if (isTauri()) {
    try {
      return await invoke<AppSettings>("load_settings");
    } catch (error) {
      console.warn("Falling back to browser settings", error);
    }
  }

  const raw = localStorage.getItem(SETTINGS_KEY);
  return raw ? { ...defaultSettings, ...JSON.parse(raw) } : defaultSettings;
}

export async function saveSettings(settings: AppSettings) {
  if (isTauri()) {
    try {
      await invoke("save_settings", { settings });
      return;
    } catch (error) {
      console.warn("Falling back to browser settings save", error);
    }
  }

  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

export async function refreshData(snapshot: CommandCenterSnapshot): Promise<CommandCenterSnapshot> {
  if (isTauri()) {
    try {
      return ensureUsableSnapshot(await invoke<CommandCenterSnapshot>("refresh_live_data", { snapshot: ensureUsableSnapshot(snapshot) }));
    } catch (error) {
      console.warn("Using browser live refresh fallback", error);
    }
  }

  try {
    return await fetchLiveSnapshot(ensureUsableSnapshot(snapshot));
  } catch (error) {
    console.warn("Using local refresh fallback", error);
  }

  if (isTauri()) {
    try {
      return ensureUsableSnapshot(await invoke<CommandCenterSnapshot>("refresh_data", { snapshot }));
    } catch (error) {
      console.warn("Using browser refresh simulation", error);
    }
  }

  return {
    ...snapshot,
    lastRefresh: new Date().toISOString(),
    indexes: snapshot.indexes.map((index, position) => ({
      ...index,
      change: Number((index.change + (position % 2 === 0 ? 0.07 : -0.05)).toFixed(2)),
      updatedAt: new Date().toISOString()
    }))
  };
}

export async function loadSkills(): Promise<Skill[]> {
  if (isTauri()) {
    try {
      return await invoke<Skill[]>("load_skills");
    } catch (error) {
      console.warn("Using built-in skills", error);
    }
  }

  return [
    {
      name: "finalize",
      description: "Create a trading action plan from the active chat and attached context.",
      body: "Produce a concise markdown plan with thesis, instruments, entry triggers, invalidation, risk, and after-action fields."
    },
    {
      name: "macro",
      description: "Analyze a country or region through a macro market lens.",
      body: "Focus on rates, currency, commodities, policy, capital flows, and tradeable market implications."
    }
  ];
}

export async function loadChatThreads(): Promise<ChatThread[]> {
  if (isTauri()) {
    try {
      return await invoke<ChatThread[]>("load_chat_threads");
    } catch (error) {
      console.warn("Falling back to browser chat threads", error);
    }
  }

  const raw = localStorage.getItem(CHAT_THREADS_KEY);
  if (raw) return JSON.parse(raw);

  const timestamp = new Date().toISOString();
  const thread = {
    id: "default",
    title: "Current Chat",
    summary: null,
    archived: false,
    createdAt: timestamp,
    updatedAt: timestamp
  };
  localStorage.setItem(CHAT_THREADS_KEY, JSON.stringify([thread]));
  return [thread];
}

export async function createChatThread(title?: string): Promise<ChatThread> {
  if (isTauri()) {
    try {
      return await invoke<ChatThread>("create_chat_thread", { title: title ?? null });
    } catch (error) {
      console.warn("Falling back to browser chat thread create", error);
    }
  }

  const threads = await loadChatThreads();
  const timestamp = new Date().toISOString();
  const thread: ChatThread = {
    id: crypto.randomUUID(),
    title: title ?? `Chat ${new Date().toLocaleString()}`,
    summary: null,
    archived: false,
    createdAt: timestamp,
    updatedAt: timestamp
  };
  localStorage.setItem(CHAT_THREADS_KEY, JSON.stringify([thread, ...threads]));
  return thread;
}

export async function loadChatMessages(threadId: string): Promise<ChatMessage[]> {
  if (isTauri()) {
    try {
      return await invoke<ChatMessage[]>("load_chat_messages", { threadId });
    } catch (error) {
      console.warn("Falling back to browser chat messages", error);
    }
  }

  const messages = JSON.parse(localStorage.getItem(CHAT_MESSAGES_KEY) ?? "{}");
  return messages[threadId] ?? [];
}

export async function saveChatMessage(threadId: string, message: ChatMessage) {
  if (isTauri()) {
    try {
      await invoke("save_chat_message", { threadId, message });
      return;
    } catch (error) {
      console.warn("Falling back to browser chat message save", error);
    }
  }

  const messages = JSON.parse(localStorage.getItem(CHAT_MESSAGES_KEY) ?? "{}");
  messages[threadId] = [...(messages[threadId] ?? []), message];
  localStorage.setItem(CHAT_MESSAGES_KEY, JSON.stringify(messages));

  const threads = await loadChatThreads();
  localStorage.setItem(
    CHAT_THREADS_KEY,
    JSON.stringify(
      threads.map((thread) =>
        thread.id === threadId ? { ...thread, updatedAt: message.createdAt, title: deriveThreadTitle(thread.title, message) } : thread
      )
    )
  );
}

function deriveThreadTitle(currentTitle: string, message: ChatMessage) {
  if (currentTitle !== "Current Chat" && !currentTitle.startsWith("Chat ")) return currentTitle;
  if (message.role !== "user") return currentTitle;
  return message.content.replace(/\s+/g, " ").trim().slice(0, 48) || currentTitle;
}

export async function savePlan(title: string, content: string) {
  if (isTauri()) {
    try {
      await invoke("save_plan", { title, content });
      return;
    } catch (error) {
      console.warn("Falling back to browser plan save", error);
    }
  }

  const plans = JSON.parse(localStorage.getItem(PLANS_KEY) ?? "{}");
  plans[title] = content;
  localStorage.setItem(PLANS_KEY, JSON.stringify(plans));
}

export async function loadPlan(title: string): Promise<string | null> {
  if (isTauri()) {
    try {
      return await invoke<string | null>("load_plan", { title });
    } catch (error) {
      console.warn("Falling back to browser plan load", error);
    }
  }

  const plans = JSON.parse(localStorage.getItem(PLANS_KEY) ?? "{}");
  return plans[title] ?? null;
}

export function appendMessage(snapshot: CommandCenterSnapshot, message: ChatMessage): CommandCenterSnapshot {
  return {
    ...snapshot,
    chat: [...snapshot.chat, message]
  };
}
