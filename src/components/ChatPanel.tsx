import { Bot, FilePlus2, Send, Settings } from "lucide-react";
import { useEffect, useState } from "react";
import { loadPlan, loadSettings, loadSkills, savePlan, saveSettings } from "../services/storage";
import { sendOpenRouterChat } from "../services/openRouter";
import type { AppSettings, ChatMessage, Skill } from "../types/domain";

interface Props {
  messages: ChatMessage[];
  context: { label: string; content: string }[];
  onMessage: (message: ChatMessage) => void;
  onAssistant: (content: string) => void;
  onClearContext: () => void;
}

export function ChatPanel({ messages, context, onMessage, onAssistant, onClearContext }: Props) {
  const [draft, setDraft] = useState("");
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    loadSettings().then(setSettings);
    loadSkills().then(setSkills);
  }, []);

  async function submit() {
    if (!draft.trim() || !settings || busy) return;

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: expandSkill(draft, skills),
      createdAt: new Date().toISOString(),
      contextIds: context.map((item) => item.label)
    };

    setDraft("");
    setBusy(true);
    onMessage(userMessage);

    try {
      if (draft.startsWith("/update_plan")) {
        const title = draft.match(/"(.+)"/)?.[1] ?? draft.replace("/update_plan", "").trim();
        const plan = await loadPlan(title);
        onAssistant(plan ? `Loaded plan "${title}" into context:\n\n${plan}` : `No saved plan found for "${title}".`);
      } else {
        const reply = await sendOpenRouterChat(settings, [...messages, userMessage], context.map((item) => item.content));
        onAssistant(reply);
        if (draft.startsWith("/finalize")) {
          await savePlan(`plan-${new Date().toISOString().slice(0, 10)}`, reply);
        }
      }
    } catch (error) {
      onAssistant(error instanceof Error ? error.message : "The assistant request failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <aside className="chat-panel">
      <div className="chat-header">
        <Bot size={20} />
        <h2>AI Chat Room</h2>
        <button aria-label="Settings" className="icon-button" onClick={() => setSettingsOpen((value) => !value)} type="button">
          <Settings size={18} />
        </button>
      </div>
      {settingsOpen && settings && (
        <form className="settings-panel" onSubmit={(event) => {
          event.preventDefault();
          saveSettings(settings);
          setSettingsOpen(false);
        }}>
          <label>
            OpenRouter Key
            <input
              onChange={(event) => setSettings({ ...settings, openRouterApiKey: event.target.value })}
              placeholder="sk-or-..."
              type="password"
              value={settings.openRouterApiKey}
            />
          </label>
          <label>
            Model
            <input
              onChange={(event) => setSettings({ ...settings, openRouterModel: event.target.value })}
              value={settings.openRouterModel}
            />
          </label>
          <label>
            Refresh Minutes
            <input
              min={5}
              onChange={(event) => setSettings({ ...settings, refreshMinutes: Number(event.target.value) })}
              type="number"
              value={settings.refreshMinutes}
            />
          </label>
          <button type="submit">Save</button>
        </form>
      )}
      <div className="context-bin">
        <div>
          <FilePlus2 size={16} />
          <strong>ChatBot Context Filter</strong>
        </div>
        {context.length ? (
          <>
            {context.map((item) => <span key={item.label}>{item.label}</span>)}
            <button onClick={onClearContext} type="button">Clear</button>
          </>
        ) : (
          <small>No context attached</small>
        )}
      </div>
      <div className="messages">
        {messages.map((message) => (
          <div className={`message message--${message.role}`} key={message.id}>
            <p>{message.content}</p>
          </div>
        ))}
      </div>
      <div className="composer">
        <textarea
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) submit();
          }}
          placeholder='Ask, use /macro, /finalize, or /update_plan "plan-2026-05-08"'
          value={draft}
        />
        <button aria-label="Send" disabled={busy} onClick={submit} type="button">
          <Send size={18} />
        </button>
      </div>
    </aside>
  );
}

function expandSkill(input: string, skills: Skill[]) {
  const match = input.match(/^\/(\w+)/);
  if (!match) return input;
  const skill = skills.find((item) => item.name === match[1]);
  if (!skill) return input;
  return `Skill: ${skill.name}\n${skill.body}\n\nUser request:\n${input}`;
}
