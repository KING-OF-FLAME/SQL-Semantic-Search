import { useState, useEffect, useRef } from "react";
import { AdminLayout } from "@/components/layout/admin-layout";
import { useAdminApi } from "@/hooks/use-admin-api";
import { Settings, Save, Loader2, Info, Clock, Search, Globe, Bot, Key, ChevronDown, Network } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

const RESET_PRESETS = [
  { label: "1 hour", value: 1 },
  { label: "6 hours", value: 6 },
  { label: "12 hours", value: 12 },
  { label: "1 day", value: 24 },
  { label: "3 days", value: 72 },
  { label: "1 week", value: 168 },
  { label: "1 month", value: 720 },
];

const OPENAI_MODELS = [
  { label: "GPT-4o Mini (fast, default)", value: "gpt-4o-mini" },
  { label: "GPT-4o (more capable)", value: "gpt-4o" },
  { label: "GPT-4 Turbo", value: "gpt-4-turbo" },
  { label: "GPT-3.5 Turbo (cheapest)", value: "gpt-3.5-turbo" },
];

function ToggleSwitch({
  checked,
  onChange,
  disabled,
  color = "primary",
}: {
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
  color?: "primary" | "orange" | "violet" | "green";
}) {
  const colors = {
    primary: "bg-primary",
    orange: "bg-orange-500",
    violet: "bg-violet-600",
    green: "bg-green-500",
  };
  return (
    <button
      onClick={onChange}
      disabled={disabled}
      aria-checked={checked}
      role="switch"
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-50 ${
        checked ? colors[color] : "bg-muted-foreground/30"
      }`}
    >
      <span
        className={`inline-block h-4 w-4 rounded-full bg-white shadow-md transition-transform duration-200 ${
          checked ? "translate-x-5" : "translate-x-0.5"
        }`}
      />
    </button>
  );
}

export default function AdminSettings() {
  const { adminFetch } = useAdminApi();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Guest limit state
  const [limit, setLimit] = useState(5);
  const [resetHours, setResetHours] = useState(24);
  const [dirty, setDirty] = useState(false);

  // Web search state
  const [webSearchEnabled, setWebSearchEnabled] = useState(false);

  // OpenAI state
  const [openaiEnabled, setOpenaiEnabled] = useState(true);
  const [openaiModel, setOpenaiModel] = useState("gpt-4o-mini");
  const [openaiKeyInput, setOpenaiKeyInput] = useState("");
  const [openaiKeyConfigured, setOpenaiKeyConfigured] = useState(false);
  const [showModelDropdown, setShowModelDropdown] = useState(false);
  const modelDropdownRef = useRef<HTMLDivElement>(null);

  // Crawl state
  const [crawlEnabled, setCrawlEnabled] = useState(true);

  const { data, isLoading } = useQuery({
    queryKey: ["/api/admin/settings"],
    queryFn: async () => {
      const res = await adminFetch("/admin/settings");
      if (!res.ok) throw new Error("Failed to load settings");
      return res.json() as Promise<{ settings: Record<string, string> }>;
    },
  });

  useEffect(() => {
    if (data?.settings) {
      setLimit(parseInt(data.settings.guest_search_limit ?? "5", 10));
      setResetHours(parseInt(data.settings.limit_reset_hours ?? "24", 10));
      setWebSearchEnabled(data.settings.web_search_enabled === "true");
      setOpenaiEnabled(data.settings.openai_enabled !== "false");
      setOpenaiModel(data.settings.openai_model || "gpt-4o-mini");
      setOpenaiKeyConfigured(data.settings.openai_api_key === "***configured***");
      setCrawlEnabled(data.settings.crawl_enabled !== "false");
      setDirty(false);
    }
  }, [data]);

  // Close model dropdown on outside click
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (modelDropdownRef.current && !modelDropdownRef.current.contains(e.target as Node)) {
        setShowModelDropdown(false);
      }
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  // Generic single-setting save
  const saveSetting = async (key: string, value: unknown) => {
    const res = await adminFetch("/admin/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [key]: value }),
    });
    if (!res.ok) throw new Error("Failed to save setting");
    return res.json();
  };

  // Guest limits save
  const { mutate: save, isPending: isSaving } = useMutation({
    mutationFn: async () => {
      const res = await adminFetch("/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ guest_search_limit: limit, limit_reset_hours: resetHours }),
      });
      if (!res.ok) throw new Error("Failed to save settings");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Settings Saved", description: "Guest search limits updated." });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/settings"] });
      setDirty(false);
    },
    onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  // Web search toggle
  const { mutate: saveWebSearch, isPending: isSavingWebSearch } = useMutation({
    mutationFn: (enabled: boolean) => saveSetting("web_search_enabled", enabled),
    onSuccess: (_data, enabled) => {
      toast({
        title: enabled ? "Web Search Enabled" : "Web Search Disabled",
        description: enabled
          ? "Answers will now be enhanced with DuckDuckGo results."
          : "Answers will use only the ADYPU knowledge base.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/settings"] });
    },
    onError: (err) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
      setWebSearchEnabled((prev) => !prev);
    },
  });

  // OpenAI enabled toggle
  const { mutate: saveOpenaiEnabled, isPending: isSavingOpenaiEnabled } = useMutation({
    mutationFn: (enabled: boolean) => saveSetting("openai_enabled", enabled),
    onSuccess: (_data, enabled) => {
      toast({
        title: enabled ? "AI Enabled" : "AI Disabled",
        description: enabled ? "OpenAI responses are now active." : "AI responses disabled; the system will return a placeholder message.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/settings"] });
    },
    onError: (err) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
      setOpenaiEnabled((prev) => !prev);
    },
  });

  // OpenAI model change
  const { mutate: saveModel, isPending: isSavingModel } = useMutation({
    mutationFn: (model: string) => saveSetting("openai_model", model),
    onSuccess: () => {
      toast({ title: "Model Updated", description: `Now using ${openaiModel}.` });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/settings"] });
      setShowModelDropdown(false);
    },
    onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  // OpenAI API key update
  const { mutate: saveApiKey, isPending: isSavingKey } = useMutation({
    mutationFn: async () => {
      const key = openaiKeyInput.trim();
      if (!key) throw new Error("Please enter a valid API key");
      const res = await adminFetch("/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ openai_api_key: key }),
      });
      if (!res.ok) throw new Error("Failed to update API key");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "API Key Updated", description: "The new OpenAI API key has been saved." });
      setOpenaiKeyInput("");
      setOpenaiKeyConfigured(true);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/settings"] });
    },
    onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  // Crawl enabled toggle
  const { mutate: saveCrawlEnabled, isPending: isSavingCrawl } = useMutation({
    mutationFn: (enabled: boolean) => saveSetting("crawl_enabled", enabled),
    onSuccess: (_data, enabled) => {
      toast({
        title: enabled ? "Crawling Enabled" : "Crawling Disabled",
        description: enabled ? "Crawl jobs can now be started." : "Crawl jobs are blocked until re-enabled.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/settings"] });
    },
    onError: (err) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
      setCrawlEnabled((prev) => !prev);
    },
  });

  const resetLabel = RESET_PRESETS.find(p => p.value === resetHours)?.label ?? `${resetHours}h`;
  const selectedModelLabel = OPENAI_MODELS.find(m => m.value === openaiModel)?.label ?? openaiModel;

  return (
    <AdminLayout>
      <div className="space-y-6 max-w-2xl">

        {/* Header */}
        <div>
          <h1 className="font-display font-bold text-2xl text-foreground">System Settings</h1>
          <p className="text-sm text-muted-foreground mt-1">Configure guest access, AI features, web search, and crawling.</p>
        </div>

        {/* Guest Search Limits */}
        <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
          <div className="p-5 sm:p-6 border-b border-border flex items-center gap-3">
            <div className="p-2 bg-primary/10 text-primary rounded-lg">
              <Search className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-display font-bold text-lg text-foreground">Guest Search Limits</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Control how many free searches guests can do before being prompted to sign in.</p>
            </div>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center p-12">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : (
            <div className="p-5 sm:p-6 space-y-6">
              <div>
                <label className="text-sm font-semibold text-foreground mb-2 block">Free searches per guest</label>
                <div className="flex items-center gap-4">
                  <input
                    type="range"
                    min={1}
                    max={50}
                    value={limit}
                    onChange={e => { setLimit(Number(e.target.value)); setDirty(true); }}
                    className="flex-1 h-2 rounded-full accent-primary cursor-pointer"
                  />
                  <div className="w-16 text-center">
                    <input
                      type="number"
                      min={1}
                      max={1000}
                      value={limit}
                      onChange={e => { setLimit(Math.max(1, Math.min(1000, Number(e.target.value)))); setDirty(true); }}
                      className="w-full text-center bg-muted border border-border rounded-xl py-2 px-2 text-sm font-bold focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                    />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Guests see a "Sign in for unlimited" prompt after <strong>{limit}</strong> search{limit !== 1 ? "es" : ""}.
                </p>
              </div>

              <div>
                <label className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
                  <Clock className="w-4 h-4" />Reset window
                </label>
                <div className="flex flex-wrap gap-2 mb-3">
                  {RESET_PRESETS.map(p => (
                    <button
                      key={p.value}
                      onClick={() => { setResetHours(p.value); setDirty(true); }}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all border ${
                        resetHours === p.value
                          ? "bg-primary text-primary-foreground border-primary shadow-md shadow-primary/20"
                          : "bg-muted text-muted-foreground border-border hover:border-primary/40 hover:text-foreground"
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground">Custom:</span>
                  <input
                    type="number"
                    min={1}
                    max={8760}
                    value={resetHours}
                    onChange={e => { setResetHours(Math.max(1, Math.min(8760, Number(e.target.value)))); setDirty(true); }}
                    className="w-24 bg-muted border border-border rounded-xl py-1.5 px-3 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                  />
                  <span className="text-xs text-muted-foreground">hours</span>
                </div>
                <p className="text-xs text-muted-foreground mt-2">Limit resets every <strong>{resetLabel}</strong> per browser session.</p>
              </div>

              <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 flex items-start gap-3">
                <Info className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                <p className="text-sm text-foreground">
                  Guests can send <strong>{limit} free message{limit !== 1 ? "s" : ""}</strong> every <strong>{resetLabel}</strong> before being prompted to register.
                </p>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  onClick={() => save()}
                  disabled={isSaving || !dirty}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground px-6 py-2.5 rounded-xl text-sm font-medium flex items-center gap-2 transition-all disabled:opacity-50 shadow-md shadow-primary/20"
                >
                  {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  {dirty ? "Save Changes" : "Saved"}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* AI Configuration */}
        <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
          <div className="p-5 sm:p-6 border-b border-border flex items-center gap-3">
            <div className="p-2 bg-violet-500/10 text-violet-600 dark:text-violet-400 rounded-lg">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-display font-bold text-lg text-foreground">AI Configuration</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Manage the OpenAI key, model, and master on/off switch.</p>
            </div>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center p-12">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : (
            <div className="p-5 sm:p-6 space-y-6">

              {/* OpenAI Enabled Toggle */}
              <div className="flex items-center justify-between gap-4">
                <div className="flex-1">
                  <p className="text-sm font-semibold text-foreground">Enable AI responses</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Master switch — when off, the chat returns a placeholder message and skips all OpenAI calls.</p>
                </div>
                <ToggleSwitch
                  checked={openaiEnabled}
                  onChange={() => {
                    const newVal = !openaiEnabled;
                    setOpenaiEnabled(newVal);
                    saveOpenaiEnabled(newVal);
                  }}
                  disabled={isSavingOpenaiEnabled}
                  color="violet"
                />
              </div>

              <div className="border-t border-border" />

              {/* Model Selector */}
              <div>
                <label className="text-sm font-semibold text-foreground mb-2 block">OpenAI Model</label>
                <div className="relative" ref={modelDropdownRef}>
                  <button
                    onClick={() => setShowModelDropdown(v => !v)}
                    className="w-full flex items-center justify-between gap-2 bg-muted border border-border rounded-xl px-4 py-2.5 text-sm font-medium hover:border-primary/40 transition-colors"
                  >
                    <span>{selectedModelLabel}</span>
                    <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${showModelDropdown ? "rotate-180" : ""}`} />
                  </button>
                  {showModelDropdown && (
                    <div className="absolute z-10 mt-1 w-full bg-popover border border-border rounded-xl shadow-lg overflow-hidden">
                      {OPENAI_MODELS.map(m => (
                        <button
                          key={m.value}
                          onClick={() => {
                            setOpenaiModel(m.value);
                            saveModel(m.value);
                          }}
                          disabled={isSavingModel}
                          className={`w-full text-left px-4 py-3 text-sm hover:bg-muted transition-colors flex items-center justify-between ${
                            openaiModel === m.value ? "text-primary font-semibold" : "text-foreground"
                          }`}
                        >
                          {m.label}
                          {openaiModel === m.value && <span className="text-xs text-primary">Active</span>}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-2">Takes effect immediately — no restart required.</p>
              </div>

              <div className="border-t border-border" />

              {/* API Key */}
              <div>
                <label className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
                  <Key className="w-4 h-4" />
                  OpenAI API Key
                </label>
                {openaiKeyConfigured && (
                  <div className="mb-3 flex items-center gap-2 text-xs text-green-700 dark:text-green-400 bg-green-500/10 border border-green-500/20 rounded-lg px-3 py-2">
                    <span className="font-semibold">Key configured</span>
                    <span className="text-muted-foreground">— enter a new one below to replace it</span>
                  </div>
                )}
                <div className="flex gap-2">
                  <input
                    type="password"
                    value={openaiKeyInput}
                    onChange={e => setOpenaiKeyInput(e.target.value)}
                    placeholder={openaiKeyConfigured ? "sk-••••••• (leave blank to keep current)" : "sk-..."}
                    className="flex-1 bg-muted border border-border rounded-xl px-4 py-2.5 text-sm font-mono focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none placeholder:text-muted-foreground/50"
                  />
                  <button
                    onClick={() => saveApiKey()}
                    disabled={isSavingKey || !openaiKeyInput.trim()}
                    className="bg-violet-600 hover:bg-violet-700 text-white px-4 py-2.5 rounded-xl text-sm font-medium flex items-center gap-2 transition-all disabled:opacity-50 whitespace-nowrap"
                  >
                    {isSavingKey ? <Loader2 className="w-4 h-4 animate-spin" /> : <Key className="w-4 h-4" />}
                    Update Key
                  </button>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  The key is stored securely. It is never displayed after saving. If the Replit AI integration is active, the DB key takes precedence for standard API calls.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* DuckDuckGo Web Search Enhancement */}
        <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
          <div className="p-5 sm:p-6 border-b border-border flex items-center gap-3">
            <div className="p-2 bg-orange-500/10 text-orange-600 dark:text-orange-400 rounded-lg">
              <Globe className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-display font-bold text-lg text-foreground">Web Search Enhancement</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Supplement answers with real-time DuckDuckGo results — no API key required.</p>
            </div>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center p-12">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : (
            <div className="p-5 sm:p-6 space-y-5">
              <div className="flex items-center justify-between gap-4">
                <div className="flex-1">
                  <p className="text-sm font-semibold text-foreground">Enable DuckDuckGo web search</p>
                  <p className="text-xs text-muted-foreground mt-0.5">When enabled, users can also toggle web search per session from the chat interface.</p>
                </div>
                <ToggleSwitch
                  checked={webSearchEnabled}
                  onChange={() => {
                    const newVal = !webSearchEnabled;
                    setWebSearchEnabled(newVal);
                    saveWebSearch(newVal);
                  }}
                  disabled={isSavingWebSearch}
                  color="orange"
                />
              </div>

              <div className={`border rounded-xl p-4 flex items-start gap-3 transition-colors ${
                webSearchEnabled ? "bg-orange-500/5 border-orange-500/20" : "bg-muted/50 border-border"
              }`}>
                <Globe className={`w-4 h-4 mt-0.5 shrink-0 ${webSearchEnabled ? "text-orange-500" : "text-muted-foreground"}`} />
                <div className="text-sm">
                  {webSearchEnabled ? (
                    <p className="text-foreground"><strong>Active:</strong> Answers are enhanced with DuckDuckGo results. Users see a Web toggle in the chat input bar to opt in/out per session.</p>
                  ) : (
                    <p className="text-muted-foreground"><strong>Inactive:</strong> Answers use only the indexed ADYPU knowledge base. Enable to unlock user-facing web search toggling.</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-muted-foreground">
                <div className="bg-muted/40 rounded-xl p-3 flex flex-col gap-1">
                  <span className="font-semibold text-foreground">No API key</span>
                  <span>Uses DuckDuckGo's free HTML search — zero cost, no credentials needed.</span>
                </div>
                <div className="bg-muted/40 rounded-xl p-3 flex flex-col gap-1">
                  <span className="font-semibold text-foreground">ADYPU-scoped</span>
                  <span>Queries are automatically scoped with ADYPU university context.</span>
                </div>
                <div className="bg-muted/40 rounded-xl p-3 flex flex-col gap-1">
                  <span className="font-semibold text-foreground">User control</span>
                  <span>Users can toggle web search on/off per session from the chat.</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Crawler Settings */}
        <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
          <div className="p-5 sm:p-6 border-b border-border flex items-center gap-3">
            <div className="p-2 bg-green-500/10 text-green-600 dark:text-green-400 rounded-lg">
              <Network className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-display font-bold text-lg text-foreground">Web Crawler</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Control whether crawl jobs can be started from the Sources panel.</p>
            </div>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center p-12">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : (
            <div className="p-5 sm:p-6 space-y-5">
              <div className="flex items-center justify-between gap-4">
                <div className="flex-1">
                  <p className="text-sm font-semibold text-foreground">Enable web crawling</p>
                  <p className="text-xs text-muted-foreground mt-0.5">When disabled, all "Start Crawl" and "Re-crawl" buttons in Sources will be blocked until re-enabled here.</p>
                </div>
                <ToggleSwitch
                  checked={crawlEnabled}
                  onChange={() => {
                    const newVal = !crawlEnabled;
                    setCrawlEnabled(newVal);
                    saveCrawlEnabled(newVal);
                  }}
                  disabled={isSavingCrawl}
                  color="green"
                />
              </div>

              <div className={`border rounded-xl p-4 flex items-start gap-3 transition-colors ${
                crawlEnabled ? "bg-green-500/5 border-green-500/20" : "bg-muted/50 border-border"
              }`}>
                <Network className={`w-4 h-4 mt-0.5 shrink-0 ${crawlEnabled ? "text-green-500" : "text-muted-foreground"}`} />
                <p className="text-sm">
                  {crawlEnabled ? (
                    <span className="text-foreground"><strong>Active:</strong> Crawl jobs can be triggered from the Sources panel. The crawler will respect source domains and depth limits.</span>
                  ) : (
                    <span className="text-muted-foreground"><strong>Blocked:</strong> All crawl operations are blocked. Existing knowledge base data is unaffected.</span>
                  )}
                </p>
              </div>
            </div>
          )}
        </div>

      </div>
    </AdminLayout>
  );
}
