import { Bot, Check, FilePlus2, Maximize2, MessageSquarePlus, Plus, Search, Send, Settings, X } from "lucide-react";
import { type KeyboardEvent, useEffect, useId, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { AutoResizeTextarea } from "./AutoResizeTextarea";
import { loadPlan, loadSettings, loadSkills, savePlan, saveSettings } from "../services/storage";
import { sendOpenRouterChat } from "../services/openRouter";
import type { AppSettings, ChatContextItem, ChatMessage, ChatThread, Skill } from "../types/domain";

interface Props {
  activeThreadId: string;
  messages: ChatMessage[];
  threads: ChatThread[];
  context: ChatContextItem[];
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
  context: ChatContextItem[];
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
  const messagesRef = useRef<HTMLDivElement | null>(null);
  const shouldStickToBottomRef = useRef(true);

  useEffect(() => {
    shouldStickToBottomRef.current = true;
    scrollMessagesToBottom(messagesRef.current, "auto");
  }, [activeThreadId]);

  useEffect(() => {
    if (!shouldStickToBottomRef.current) return;
    scrollMessagesToBottom(messagesRef.current, "smooth");
  }, [messages.length, busy]);

  function handleMessageScroll() {
    const element = messagesRef.current;
    if (!element) return;
    shouldStickToBottomRef.current = isNearBottom(element);
  }

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
      <ConversationPicker activeThreadId={activeThreadId} onSelectThread={onSelectThread} threads={threads} />
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
      <div className="messages" onScroll={handleMessageScroll} ref={messagesRef}>
        {messages.map((message) => (
          <div className={`message message--${message.role}`} key={message.id}>
            <MessageContent message={message} />
          </div>
        ))}
        {busy ? <TypingIndicator /> : null}
      </div>
      <div className="composer">
        <div className="composer-input-shell">
          <ComposerContextControl context={context} onClearContext={onClearContext} />
          <AutoResizeTextarea
            className="composer-textarea"
            onChange={onDraftChange}
            onKeyDown={onKeyDown}
            placeholder='Ask, use /macro, /finalize, or /update_plan "plan-2026-05-08"'
            value={draft}
          />
        </div>
        <button aria-label="Send" className="composer-send" disabled={busy} onClick={onSubmit} type="button">
          <Send size={18} />
        </button>
      </div>
    </>
  );
}

function ConversationPicker({
  activeThreadId,
  onSelectThread,
  threads
}: {
  activeThreadId: string;
  onSelectThread: (threadId: string) => void;
  threads: ChatThread[];
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const searchId = useId();
  const activeThread = threads.find((thread) => thread.id === activeThreadId);
  const results = useMemo(() => fuzzyThreads(threads, query), [query, threads]);

  useEffect(() => {
    function closeOnPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }

    window.addEventListener("pointerdown", closeOnPointerDown);
    return () => window.removeEventListener("pointerdown", closeOnPointerDown);
  }, []);

  function selectThread(threadId: string) {
    onSelectThread(threadId);
    setOpen(false);
    setQuery("");
  }

  return (
    <div className="conversation-picker" ref={rootRef}>
      <label htmlFor={searchId}>Conversation</label>
      <div className="conversation-search">
        <Search size={15} />
        <input
          autoComplete="off"
          id={searchId}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(event) => {
            if (event.key === "Escape") setOpen(false);
            if (event.key === "Enter" && results[0]) selectThread(results[0].id);
          }}
          placeholder={activeThread?.title ?? "Search conversations"}
          value={query}
        />
      </div>
      <div className="conversation-current">
        <span>{activeThread?.title ?? "No active conversation"}</span>
        {activeThread ? <time>{formatThreadDate(activeThread.updatedAt)}</time> : null}
      </div>
      {open ? (
        <div className="conversation-results" role="listbox">
          {results.length ? (
            results.map((thread) => (
              <button
                aria-selected={thread.id === activeThreadId}
                key={thread.id}
                onClick={() => selectThread(thread.id)}
                role="option"
                type="button"
              >
                <span>
                  <strong>{thread.title}</strong>
                  <small>{thread.summary || formatThreadDate(thread.updatedAt)}</small>
                </span>
                {thread.id === activeThreadId ? <Check size={15} /> : null}
              </button>
            ))
          ) : (
            <div className="conversation-empty">No matching conversations</div>
          )}
        </div>
      ) : null}
    </div>
  );
}

function ComposerContextControl({
  context,
  onClearContext
}: {
  context: ChatContextItem[];
  onClearContext: () => void;
}) {
  const [open, setOpen] = useState(false);
  const summary = context.length ? `${context[0].label}${context.length > 1 ? ` +${context.length - 1}` : ""}` : "No context";

  return (
    <div className="composer-context">
      <button
        aria-expanded={open}
        aria-label="Show chat context"
        className="composer-context__add"
        onClick={() => setOpen((value) => !value)}
        type="button"
      >
        <Plus size={14} />
      </button>
      <button className="composer-context__source" onClick={() => setOpen((value) => !value)} type="button">
        <FilePlus2 size={14} />
        <span>{summary}</span>
      </button>
      {open ? (
        <div className="composer-context__menu">
          {context.length ? (
            <>
              {context.map((item) => <span key={item.label}>{item.label}</span>)}
              <button onClick={onClearContext} type="button">Clear context</button>
            </>
          ) : (
            <small>Add context from a country, category, or article drill-down.</small>
          )}
        </div>
      ) : null}
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="message message--assistant message--loading" role="status">
      <span>Model is processing</span>
      <i />
      <i />
      <i />
    </div>
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

function fuzzyThreads(threads: ChatThread[], query: string) {
  const normalizedQuery = normalizeSearch(query);
  if (!normalizedQuery) return threads;

  return threads
    .map((thread) => ({ thread, score: fuzzyScore(`${thread.title} ${thread.summary ?? ""}`, normalizedQuery) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || Date.parse(b.thread.updatedAt) - Date.parse(a.thread.updatedAt))
    .map((item) => item.thread);
}

function fuzzyScore(value: string, query: string) {
  const haystack = normalizeSearch(value);
  if (haystack.includes(query)) return 100 + query.length;

  let score = 0;
  let searchIndex = 0;
  for (const character of query) {
    const foundIndex = haystack.indexOf(character, searchIndex);
    if (foundIndex === -1) return 0;
    score += foundIndex === searchIndex ? 8 : 3;
    searchIndex = foundIndex + 1;
  }

  return score;
}

function normalizeSearch(value: string) {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function formatThreadDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(date);
}

function isNearBottom(element: HTMLElement) {
  return element.scrollHeight - element.scrollTop - element.clientHeight < 72;
}

function scrollMessagesToBottom(element: HTMLElement | null, behavior: ScrollBehavior) {
  if (!element) return;
  requestAnimationFrame(() => {
    element.scrollTo({ top: element.scrollHeight, behavior });
  });
}

function expandSkill(input: string, skills: Skill[]) {
  const match = input.match(/^\/(\w+)/);
  if (!match) return input;
  const skill = skills.find((item) => item.name === match[1]);
  if (!skill) return input;
  return `Skill: ${skill.name}\n${skill.body}\n\nUser request:\n${input}`;
}
