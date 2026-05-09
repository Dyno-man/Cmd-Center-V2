import { Bot, FilePlus2, Maximize2, MessageSquarePlus, Send, Settings, X } from "lucide-react";
import { type KeyboardEvent, useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { loadPlan, loadSettings, loadSkills, savePlan, saveSettings } from "../services/storage";
import { sendOpenRouterChat } from "../services/openRouter";
import type { AppSettings, ChatMessage, ChatThread, Skill } from "../types/domain";

interface Props {
  activeThreadId: string;
  messages: ChatMessage[];
  threads: ChatThread[];
  context: { label: string; content: string }[];
  onMessage: (message: ChatMessage) => void;
  onAssistant: (content: string) => void;
  onClearContext: () => void;
  onNewChat: () => void;
  onSelectThread: (threadId: string) => void;
}

export function ChatPanel({
  activeThreadId,
  messages,
  threads,
  context,
  onMessage,
  onAssistant,
  onClearContext,
  onNewChat,
  onSelectThread
}: Props) {
  const [draft, setDraft] = useState("");
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    loadSettings().then(setSettings);
    loadSkills().then(setSkills);
  }, []);

  useEffect(() => {
    if (!expanded) return;

    function closeOnEscape(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") setExpanded(false);
    }

    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [expanded]);

  async function submit() {
    const rawDraft = draft;
    const trimmedDraft = rawDraft.trim();
    if (!trimmedDraft || !settings || busy) return;

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: expandSkill(rawDraft, skills),
      createdAt: new Date().toISOString(),
      contextIds: context.map((item) => item.label)
    };

    setDraft("");
    setBusy(true);
    onMessage(userMessage);

    try {
      if (trimmedDraft.startsWith("/update_plan")) {
        const title = trimmedDraft.match(/"(.+)"/)?.[1] ?? trimmedDraft.replace("/update_plan", "").trim();
        const plan = await loadPlan(title);
        onAssistant(plan ? `Loaded plan "${title}" into context:\n\n${plan}` : `No saved plan found for "${title}".`);
      } else {
        const reply = await sendOpenRouterChat(settings, [...messages, userMessage], context.map((item) => item.content));
        onAssistant(reply);
        if (trimmedDraft.startsWith("/finalize")) {
          await savePlan(`plan-${new Date().toISOString().slice(0, 10)}`, reply);
        }
      }
    } catch (error) {
      onAssistant(error instanceof Error ? error.message : "The assistant request failed.");
    } finally {
      setBusy(false);
    }
  }

  function handleComposerKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) return;
    event.preventDefault();
    void submit();
  }

  const chatSurface = (
    <ChatSurface
      busy={busy}
      activeThreadId={activeThreadId}
      context={context}
      draft={draft}
      messages={messages}
      onNewChat={onNewChat}
      onClearContext={onClearContext}
      onDraftChange={setDraft}
      onExpand={() => setExpanded(true)}
      onKeyDown={handleComposerKeyDown}
      onSelectThread={onSelectThread}
      onSettingsChange={setSettings}
      onSettingsOpenChange={setSettingsOpen}
      onSubmit={() => void submit()}
      settings={settings}
      settingsOpen={settingsOpen}
      threads={threads}
    />
  );

  return (
    <>
      <aside className="chat-panel">{chatSurface}</aside>
      {expanded ? (
        <div aria-modal="true" className="chat-modal-backdrop" onClick={() => setExpanded(false)} role="dialog">
          <section className="chat-modal" onClick={(event) => event.stopPropagation()}>
            <ChatSurface
              busy={busy}
              activeThreadId={activeThreadId}
              context={context}
              draft={draft}
              expanded
              messages={messages}
              onNewChat={onNewChat}
              onClearContext={onClearContext}
              onClose={() => setExpanded(false)}
              onDraftChange={setDraft}
              onKeyDown={handleComposerKeyDown}
              onSelectThread={onSelectThread}
              onSettingsChange={setSettings}
              onSettingsOpenChange={setSettingsOpen}
              onSubmit={() => void submit()}
              settings={settings}
              settingsOpen={settingsOpen}
              threads={threads}
            />
          </section>
        </div>
      ) : null}
    </>
  );
}

interface ChatSurfaceProps {
  activeThreadId: string;
  busy: boolean;
  context: { label: string; content: string }[];
  draft: string;
  expanded?: boolean;
  messages: ChatMessage[];
  onClearContext: () => void;
  onClose?: () => void;
  onDraftChange: (value: string) => void;
  onExpand?: () => void;
  onKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => void;
  onNewChat: () => void;
  onSelectThread: (threadId: string) => void;
  onSettingsChange: (settings: AppSettings) => void;
  onSettingsOpenChange: (open: boolean | ((value: boolean) => boolean)) => void;
  onSubmit: () => void;
  settings: AppSettings | null;
  settingsOpen: boolean;
  threads: ChatThread[];
}

function ChatSurface({
  activeThreadId,
  busy,
  context,
  draft,
  expanded = false,
  messages,
  onClearContext,
  onClose,
  onDraftChange,
  onExpand,
  onKeyDown,
  onNewChat,
  onSelectThread,
  onSettingsChange,
  onSettingsOpenChange,
  onSubmit,
  settings,
  settingsOpen,
  threads
}: ChatSurfaceProps) {
  const activeThread = threads.find((thread) => thread.id === activeThreadId);

  return (
    <>
      <div className="chat-header">
        <Bot size={20} />
        <h2>{activeThread?.title ?? (expanded ? "Expanded AI Chat" : "AI Chat Room")}</h2>
        <div className="chat-header__actions">
          <button aria-label="Start new chat" className="icon-button" onClick={onNewChat} type="button">
            <MessageSquarePlus size={18} />
          </button>
          <button aria-label="Settings" className="icon-button" onClick={() => onSettingsOpenChange((value) => !value)} type="button">
            <Settings size={18} />
          </button>
          {expanded ? (
            <button aria-label="Close expanded chat" className="icon-button" onClick={onClose} type="button">
              <X size={18} />
            </button>
          ) : (
            <button aria-label="Expand chat" className="icon-button" onClick={onExpand} type="button">
              <Maximize2 size={18} />
            </button>
          )}
        </div>
      </div>
      <div className="thread-bar">
        <label>
          Conversation
          <select onChange={(event) => onSelectThread(event.target.value)} value={activeThreadId}>
            {threads.map((thread) => (
              <option key={thread.id} value={thread.id}>
                {thread.title}
              </option>
            ))}
          </select>
        </label>
      </div>
      {settingsOpen && settings && (
        <form className="settings-panel" onSubmit={(event) => {
          event.preventDefault();
          saveSettings(settings);
          onSettingsOpenChange(false);
        }}>
          <label>
            OpenRouter Key
            <input
              onChange={(event) => onSettingsChange({ ...settings, openRouterApiKey: event.target.value })}
              placeholder="sk-or-..."
              type="password"
              value={settings.openRouterApiKey}
            />
          </label>
          <label>
            Model
            <input
              onChange={(event) => onSettingsChange({ ...settings, openRouterModel: event.target.value })}
              value={settings.openRouterModel}
            />
          </label>
          <label>
            Refresh Minutes
            <input
              min={5}
              onChange={(event) => onSettingsChange({ ...settings, refreshMinutes: Number(event.target.value) })}
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
            <MessageContent message={message} />
          </div>
        ))}
      </div>
      <div className="composer">
        <textarea
          onChange={(event) => onDraftChange(event.target.value)}
          onKeyDown={onKeyDown}
          placeholder='Ask, use /macro, /finalize, or /update_plan "plan-2026-05-08"'
          value={draft}
        />
        <button aria-label="Send" disabled={busy} onClick={onSubmit} type="button">
          <Send size={18} />
        </button>
      </div>
    </>
  );
}

function MessageContent({ message }: { message: ChatMessage }) {
  if (message.role === "assistant") {
    return (
      <div className="message-content message-content--markdown">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
      </div>
    );
  }

  return <p className="message-content message-content--plain">{message.content}</p>;
}

function expandSkill(input: string, skills: Skill[]) {
  const match = input.match(/^\/(\w+)/);
  if (!match) return input;
  const skill = skills.find((item) => item.name === match[1]);
  if (!skill) return input;
  return `Skill: ${skill.name}\n${skill.body}\n\nUser request:\n${input}`;
}
