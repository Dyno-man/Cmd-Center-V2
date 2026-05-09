import { RefreshCw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { ChatPanel } from "./components/ChatPanel";
import { CountryPanel } from "./components/CountryPanel";
import { FilterBar } from "./components/FilterBar";
import { MarketStrip } from "./components/MarketStrip";
import { WorldMap } from "./components/WorldMap";
import { sampleSnapshot } from "./data/sampleData";
import {
  appendMessage,
  createChatThread,
  loadChatMessages,
  loadChatThreads,
  loadSnapshot,
  refreshData,
  saveChatMessage,
  saveSnapshot
} from "./services/storage";
import { contextKey, fallbackContextLabel, resolveContextLabel } from "./services/contextLabels";
import type { ArticleContext, ChatContextItem, ChatMessage, ChatThread, CommandCenterSnapshot, CountryContext, MarketCategory } from "./types/domain";
import "./styles.css";

type RefreshPhase = "loading" | "archived" | "fetching" | "deduping" | "ready" | "failed";

export default function App() {
  const [snapshot, setSnapshot] = useState<CommandCenterSnapshot>(sampleSnapshot);
  const [selectedCountryCode, setSelectedCountryCode] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<MarketCategory | null>(null);
  const [selectedArticle, setSelectedArticle] = useState<ArticleContext | null>(null);
  const [activeContinents, setActiveContinents] = useState<string[]>(["North America", "Europe", "Asia", "Oceania"]);
  const [activeNewsTypes, setActiveNewsTypes] = useState<string[]>(["Financial Markets", "Policy", "Supply Chain"]);
  const [attachedContext, setAttachedContext] = useState<ChatContextItem[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [refreshPhase, setRefreshPhase] = useState<RefreshPhase>("loading");
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [chatThreads, setChatThreads] = useState<ChatThread[]>([]);
  const [activeThreadId, setActiveThreadId] = useState("default");

  useEffect(() => {
    let cancelled = false;

    async function loadInitialState() {
      try {
        setRefreshPhase("loading");
        const [loadedSnapshot, threads] = await Promise.all([loadSnapshot(), loadChatThreads()]);
        if (cancelled) return;

        const activeThread = threads[0] ?? (await createChatThread("Current Chat"));
        const messages = await loadChatMessages(activeThread.id);
        if (cancelled) return;

        const archivedSnapshot = { ...loadedSnapshot, chat: messages.length ? messages : loadedSnapshot.chat };
        setActiveThreadId(activeThread.id);
        setChatThreads(threads.length ? threads : [activeThread]);
        setSnapshot(archivedSnapshot);
        setHydrated(true);
        setRefreshPhase("archived");
        void runRefresh(archivedSnapshot, true);
      } catch (error) {
        if (cancelled) return;
        setHydrated(true);
        setRefreshPhase("failed");
        setRefreshError(error instanceof Error ? error.message : "Startup load failed.");
      }
    }

    void loadInitialState();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (hydrated) void saveSnapshot(snapshot);
  }, [hydrated, snapshot]);

  const countries = useMemo(
    () => snapshot.countries.filter((country) => activeContinents.includes(country.continent)),
    [activeContinents, snapshot.countries]
  );

  const selectedCountry = useMemo(
    () => countries.find((country) => country.code === selectedCountryCode) ?? null,
    [countries, selectedCountryCode]
  );

  function selectCountry(country: CountryContext) {
    setSelectedCountryCode(country.code);
    setSelectedCategory(null);
    setSelectedArticle(null);
  }

  function closeCountryPanel() {
    setSelectedCountryCode(null);
    setSelectedCategory(null);
    setSelectedArticle(null);
  }

  function addContext(label: string, content: string) {
    const id = contextKey(label, content);
    setAttachedContext((items) => {
      if (items.some((item) => item.id === id)) return items;
      return [...items, { id, label: fallbackContextLabel(label), sourceLabel: label, content }];
    });

    void resolveContextLabel(label, content).then((resolvedLabel) => {
      setAttachedContext((items) =>
        items.map((item) => (item.id === id ? { ...item, label: resolvedLabel } : item))
      );
    });
  }

  function addMessage(message: ChatMessage) {
    setSnapshot((current) => appendMessage(current, message));
    void saveChatMessage(activeThreadId, message).then(loadAndSetThreads);
  }

  function addAssistant(content: string) {
    addMessage({
      id: crypto.randomUUID(),
      role: "assistant",
      content,
      createdAt: new Date().toISOString()
    });
  }

  async function runRefresh(baseSnapshot = snapshot, automatic = false) {
    setRefreshing(true);
    setRefreshError(null);
    setRefreshPhase("fetching");
    try {
      const refreshed = await refreshData(baseSnapshot);
      setRefreshPhase("deduping");
      setSnapshot((current) => ({
        ...refreshed,
        chat: current.chat
      }));
      setRefreshPhase("ready");
    } catch (error) {
      setRefreshPhase(automatic ? "archived" : "failed");
      setRefreshError(error instanceof Error ? error.message : "Live refresh failed.");
    } finally {
      setRefreshing(false);
    }
  }

  async function loadAndSetThreads() {
    setChatThreads(await loadChatThreads());
  }

  async function startNewChat() {
    const thread = await createChatThread();
    setChatThreads((current) => [thread, ...current]);
    setActiveThreadId(thread.id);
    setSnapshot((current) => ({ ...current, chat: [] }));
    setAttachedContext([]);
  }

  async function selectChatThread(threadId: string) {
    const messages = await loadChatMessages(threadId);
    setActiveThreadId(threadId);
    setSnapshot((current) => ({ ...current, chat: messages }));
  }

  return (
    <main className="app-shell">
      <section className="workspace">
        <header className="topbar">
          <div>
            <h1>Command Center</h1>
            <span>Last refresh {new Date(snapshot.lastRefresh).toLocaleString()}</span>
            <small className={`refresh-status refresh-status--${refreshPhase}`}>
              {statusText(refreshPhase, refreshError)}
            </small>
          </div>
          <MarketStrip indexes={snapshot.indexes} />
          <button className="refresh-button" disabled={refreshing} onClick={() => void runRefresh()} type="button">
            <RefreshCw className={refreshing ? "spin" : undefined} size={18} />
            Refresh
          </button>
        </header>
        <div className="dashboard-grid">
          <div className="map-column">
            <div className="map-stage">
              <WorldMap
                countries={countries}
                interactions={snapshot.interactions}
                onClearCountry={closeCountryPanel}
                onSelectCountry={selectCountry}
                selectedCountryCode={selectedCountry?.code ?? null}
              />
              {selectedCountry ? (
                <div className="map-panel-overlay">
                  <CountryPanel
                    country={selectedCountry}
                    onAddContext={addContext}
                    onSelectArticle={setSelectedArticle}
                    onSelectCategory={setSelectedCategory}
                    selectedArticle={selectedArticle}
                    selectedCategory={selectedCategory}
                  />
                </div>
              ) : null}
            </div>
            <FilterBar
              activeContinents={activeContinents}
              activeNewsTypes={activeNewsTypes}
              onContinentsChange={setActiveContinents}
              onNewsTypesChange={setActiveNewsTypes}
            />
          </div>
        </div>
      </section>
      <ChatPanel
        activeThreadId={activeThreadId}
        context={attachedContext}
        messages={snapshot.chat}
        onAssistant={addAssistant}
        onClearContext={() => setAttachedContext([])}
        onMessage={addMessage}
        onNewChat={startNewChat}
        onSelectThread={selectChatThread}
        threads={chatThreads}
      />
    </main>
  );
}

function statusText(phase: RefreshPhase, error: string | null) {
  if (error && phase === "failed") return `Refresh issue: ${error}`;
  if (error) return `Archived data available; live refresh issue: ${error}`;
  if (phase === "loading") return "Loading archived intelligence";
  if (phase === "archived") return "Archived data loaded; live refresh running";
  if (phase === "fetching") return "Fetching live market and news data";
  if (phase === "deduping") return "Deduping and scoring articles";
  if (phase === "ready") return "Live data synced";
  return "Archived data available";
}
