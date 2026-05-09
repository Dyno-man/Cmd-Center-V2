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
import type { ArticleContext, ChatMessage, ChatThread, CommandCenterSnapshot, CountryContext, MarketCategory } from "./types/domain";
import "./styles.css";

export default function App() {
  const [snapshot, setSnapshot] = useState<CommandCenterSnapshot>(sampleSnapshot);
  const [selectedCountryCode, setSelectedCountryCode] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<MarketCategory | null>(null);
  const [selectedArticle, setSelectedArticle] = useState<ArticleContext | null>(null);
  const [activeContinents, setActiveContinents] = useState<string[]>(["North America", "Europe", "Asia", "Oceania"]);
  const [activeNewsTypes, setActiveNewsTypes] = useState<string[]>(["Financial Markets", "Policy", "Supply Chain"]);
  const [attachedContext, setAttachedContext] = useState<{ label: string; content: string }[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [chatThreads, setChatThreads] = useState<ChatThread[]>([]);
  const [activeThreadId, setActiveThreadId] = useState("default");

  useEffect(() => {
    async function loadInitialState() {
      const [loadedSnapshot, threads] = await Promise.all([loadSnapshot(), loadChatThreads()]);
      const activeThread = threads[0] ?? (await createChatThread("Current Chat"));
      const messages = await loadChatMessages(activeThread.id);
      setActiveThreadId(activeThread.id);
      setChatThreads(threads.length ? threads : [activeThread]);
      setSnapshot({ ...loadedSnapshot, chat: messages.length ? messages : loadedSnapshot.chat });
    }

    void loadInitialState();
  }, []);

  useEffect(() => {
    saveSnapshot(snapshot);
  }, [snapshot]);

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
    setAttachedContext((items) => {
      if (items.some((item) => item.label === label)) return items;
      return [...items, { label, content }];
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

  async function runRefresh() {
    setRefreshing(true);
    try {
      setSnapshot(await refreshData(snapshot));
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
          </div>
          <MarketStrip indexes={snapshot.indexes} />
          <button className="refresh-button" disabled={refreshing} onClick={runRefresh} type="button">
            <RefreshCw size={18} />
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
