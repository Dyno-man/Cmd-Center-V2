import { invoke } from "@tauri-apps/api/core";
import { loadSettings } from "./storage";
import type { AppSettings } from "../types/domain";

const CONTEXT_LABELS_KEY = "command-center:context-labels";
const LABEL_MAX_WORDS = 5;
const LABEL_MAX_LENGTH = 42;

const isTauri = () => "__TAURI_INTERNALS__" in window;

export function contextKey(sourceLabel: string, content: string) {
  return `ctx-${hashText(`${normalize(sourceLabel)}\n${normalize(content).slice(0, 600)}`)}`;
}

export function fallbackContextLabel(sourceLabel: string) {
  const cleaned = sourceLabel
    .replace(/^[-–—\s]+/, "")
    .replace(/\s+/g, " ")
    .replace(/[|()[\]{}]/g, " ")
    .trim();
  const words = cleaned.split(/\s+/).filter(Boolean).slice(0, LABEL_MAX_WORDS);
  const label = titleCase(words.join(" ")).slice(0, LABEL_MAX_LENGTH).trim();
  return label || "Attached context";
}

export async function resolveContextLabel(sourceLabel: string, content: string) {
  const key = contextKey(sourceLabel, content);
  const fallbackLabel = fallbackContextLabel(sourceLabel);

  if (isTauri()) {
    try {
      return await invoke<string>("resolve_context_label", { sourceLabel, content, fallbackLabel });
    } catch (error) {
      console.warn("Falling back to browser context label resolver", error);
    }
  }

  const cached = readBrowserLabelCache()[key];
  if (cached) return cached;

  const settings = await loadSettings();
  const generated = await summarizeLabelWithOpenRouter(settings, sourceLabel, content).catch(() => null);
  const label = generated || fallbackLabel;
  writeBrowserLabelCache(key, label);
  return label;
}

async function summarizeLabelWithOpenRouter(settings: AppSettings, sourceLabel: string, content: string) {
  if (!settings.openRouterApiKey.trim()) return null;

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
      temperature: 0.1,
      max_tokens: 16,
      messages: [
        {
          role: "system",
          content: "Create a short context label for a market intelligence chat. Return 2 to 5 words only. No punctuation."
        },
        {
          role: "user",
          content: `Title: ${sourceLabel}\nContext: ${content.slice(0, 900)}`
        }
      ]
    })
  });

  if (!response.ok) return null;
  const payload = await response.json();
  return cleanGeneratedLabel(payload.choices?.[0]?.message?.content);
}

function cleanGeneratedLabel(value: unknown) {
  if (typeof value !== "string") return null;
  const cleaned = value.replace(/["'.:;]+/g, "").replace(/\s+/g, " ").trim();
  if (!cleaned) return null;
  return titleCase(cleaned.split(/\s+/).slice(0, LABEL_MAX_WORDS).join(" ")).slice(0, LABEL_MAX_LENGTH).trim();
}

function readBrowserLabelCache(): Record<string, string> {
  return JSON.parse(localStorage.getItem(CONTEXT_LABELS_KEY) ?? "{}");
}

function writeBrowserLabelCache(key: string, label: string) {
  const cache = readBrowserLabelCache();
  cache[key] = label;
  localStorage.setItem(CONTEXT_LABELS_KEY, JSON.stringify(cache));
}

function normalize(value: string) {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function titleCase(value: string) {
  return value.replace(/\b\w/g, (character) => character.toUpperCase());
}

function hashText(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}
