import { useState, useRef, useEffect, useCallback } from "react";
import {
  Send, Sparkles, GraduationCap, Library, BookOpen, Plus, User, Bot, Loader2,
  History, X, Trash2, LogIn, Clock, ChevronRight, AlertCircle, Globe,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { PublicLayout } from "@/components/layout/public-layout";
import { ConfidenceBadge } from "@/components/ui/confidence-badge";
import { CitationCard } from "@/components/ui/citation-card";
import { AuthModal } from "@/components/ui/auth-modal";
import { useToast } from "@/hooks/use-toast";
import { usePublicAuth, getPublicAuthHeaders } from "@/hooks/use-public-auth";
import ReactMarkdown from "react-markdown";

const BASE = import.meta.env.BASE_URL;

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  response?: {
    confidence: { score: number; label: string };
    intent?: string;
    entities?: { type: string; value: string }[];
    citations?: { documentTitle?: string; sourceUrl: string; excerpt?: string; relevanceScore?: number }[];
    webSearchUsed?: boolean;
    webCitations?: { title: string; url: string; snippet: string }[];
    guest?: { used: number; limit: number; remaining: number } | null;
  };
}

interface HistoryItem {
  id: number;
  question: string;
  answer: string | null;
  intent: string | null;
  confidence: { label: string; score: number };
  createdAt: string;
}

const suggestions = [
  "What are the admission requirements for B.Tech CSE?",
  "Tell me about the hostel facilities on campus.",
  "What is the fee structure for MBA programs?",
  "Are there any international exchange programs?",
];

export default function ChatPage() {
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sessionId] = useState(() => {
    const k = "adypu_session";
    let id = sessionStorage.getItem(k);
    if (!id) { id = Math.random().toString(36).substring(2); sessionStorage.setItem(k, id); }
    return id;
  });
  const [isPending, setIsPending] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [guestUsed, setGuestUsed] = useState(() => {
    const saved = sessionStorage.getItem("adypu_guest_used");
    return saved ? parseInt(saved, 10) : 0;
  });
  const [guestLimit, setGuestLimit] = useState(5);
  const [webSearchEnabled, setWebSearchEnabled] = useState(false);
  const [sessionWebSearch, setSessionWebSearch] = useState(true);
  const [limitReached, setLimitReached] = useState(() => {
    return sessionStorage.getItem("adypu_limit_reached") === "1";
  });
  const { toast } = useToast();
  const { isAuthenticated, token } = usePublicAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Refs for values that sendMessage reads — always up-to-date regardless of stale closures
  const sessionWebSearchRef = useRef(sessionWebSearch);
  const webSearchEnabledRef = useRef(webSearchEnabled);
  useEffect(() => { sessionWebSearchRef.current = sessionWebSearch; }, [sessionWebSearch]);
  useEffect(() => { webSearchEnabledRef.current = webSearchEnabled; }, [webSearchEnabled]);

  useEffect(() => { inputRef.current?.focus(); }, []);
  useEffect(() => {
    if (messages.length > 0 || isPending) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isPending]);

  // Fetch the guest search limit from the server on mount
  useEffect(() => {
    fetch(`${BASE}api/config`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data?.guestSearchLimit) setGuestLimit(data.guestSearchLimit);
        if (data?.webSearchEnabled !== undefined) setWebSearchEnabled(data.webSearchEnabled);
      })
      .catch(() => {});
  }, []);

  // Keep sessionStorage in sync with guestUsed / limitReached state
  useEffect(() => {
    if (!isAuthenticated) sessionStorage.setItem("adypu_guest_used", String(guestUsed));
  }, [guestUsed, isAuthenticated]);
  useEffect(() => {
    if (!isAuthenticated) sessionStorage.setItem("adypu_limit_reached", limitReached ? "1" : "0");
  }, [limitReached, isAuthenticated]);

  // Reset limit when user logs in and clear session storage counters
  useEffect(() => {
    if (isAuthenticated) {
      setLimitReached(false);
      setGuestUsed(0);
      sessionStorage.removeItem("adypu_guest_used");
      sessionStorage.removeItem("adypu_limit_reached");
    }
  }, [isAuthenticated]);

  const loadHistory = useCallback(async () => {
    if (!isAuthenticated) return;
    setHistoryLoading(true);
    try {
      const res = await fetch(`${BASE}api/user/history?limit=30`, {
        headers: getPublicAuthHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        setHistory(data.history || []);
      }
    } catch {
      // ignore
    } finally {
      setHistoryLoading(false);
    }
  }, [isAuthenticated]);

  const openHistory = useCallback(() => {
    setHistoryOpen(true);
    loadHistory();
  }, [loadHistory]);

  const deleteHistoryItem = async (id: number) => {
    try {
      await fetch(`${BASE}api/user/history/${id}`, {
        method: "DELETE",
        headers: getPublicAuthHeaders(),
      });
      setHistory((prev) => prev.filter((h) => h.id !== id));
    } catch {
      toast({ title: "Error", description: "Failed to delete item.", variant: "destructive" });
    }
  };

  const clearAllHistory = async () => {
    try {
      await fetch(`${BASE}api/user/history`, {
        method: "DELETE",
        headers: getPublicAuthHeaders(),
      });
      setHistory([]);
      toast({ title: "History cleared", description: "Your search history has been cleared." });
    } catch {
      toast({ title: "Error", description: "Failed to clear history.", variant: "destructive" });
    }
  };

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || isPending) return;
      if (limitReached && !isAuthenticated) {
        setShowAuthModal(true);
        return;
      }

      const userMsgId = Math.random().toString(36).substring(7);
      setMessages((prev) => [...prev, { id: userMsgId, role: "user", content: text }]);
      setQuestion("");
      setIsPending(true);

      try {
        const res = await fetch(`${BASE}api/chat`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ question: text, sessionId, useWebSearch: webSearchEnabledRef.current ? sessionWebSearchRef.current : false }),
        });

        if (res.status === 429) {
          const data = await res.json();
          setLimitReached(true);
          setGuestUsed(data.used ?? guestLimit);
          setMessages((prev) => prev.filter((m) => m.id !== userMsgId));
          setShowAuthModal(true);
          return;
        }

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.message || "Failed to get an answer");
        }

        const data = await res.json();

        if (data.guest) {
          setGuestUsed(data.guest.used ?? 0);
          if (data.guest.limit) setGuestLimit(data.guest.limit);
          if (data.guest.remaining === 0) setLimitReached(true);
        }

        setMessages((prev) => [
          ...prev,
          {
            id: Math.random().toString(36).substring(7),
            role: "assistant",
            content: data.answer,
            response: {
              confidence: data.confidence,
              intent: data.intent,
              entities: data.entities,
              citations: data.citations,
              webSearchUsed: data.webSearchUsed ?? false,
              webCitations: data.webCitations ?? [],
              guest: data.guest,
            },
          },
        ]);
      } catch (err: unknown) {
        toast({
          title: "Error",
          description: err instanceof Error ? err.message : "Failed to get an answer.",
          variant: "destructive",
        });
        setMessages((prev) => prev.filter((m) => m.id !== userMsgId));
      } finally {
        setIsPending(false);
      }
    },
    [isPending, limitReached, isAuthenticated, token, sessionId, toast],
  );

  const handleSubmit = (e: React.FormEvent) => { e.preventDefault(); sendMessage(question); };
  const handleSuggestion = (text: string) => { setQuestion(text); sendMessage(text); };
  const handleNewChat = () => { setMessages([]); setQuestion(""); inputRef.current?.focus(); };

  const isEmpty = messages.length === 0 && !isPending;

  return (
    <PublicLayout noFooter onOpenHistory={isAuthenticated ? openHistory : undefined}>
      <div className="flex flex-col h-full w-full max-w-4xl mx-auto relative">

        {/* Top bar: new chat + guest counter */}
        {!isEmpty && (
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={handleNewChat}
              className="flex items-center gap-2 px-3 py-1.5 text-xs sm:text-sm font-medium bg-muted hover:bg-muted/70 border border-border rounded-xl transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              New Chat
            </button>
            {!isAuthenticated && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <div className="flex gap-1">
                  {Array.from({ length: guestLimit }).map((_, i) => (
                    <div
                      key={i}
                      className={`w-2 h-2 rounded-full transition-colors ${i < guestUsed ? "bg-primary" : "bg-muted-foreground/30"}`}
                    />
                  ))}
                </div>
                <span>{guestUsed}/{guestLimit} free</span>
                <button
                  onClick={() => setShowAuthModal(true)}
                  className="text-primary hover:underline font-medium ml-1"
                >
                  Sign in for unlimited
                </button>
              </div>
            )}
          </div>
        )}

        {/* Landing / Suggestions */}
        <AnimatePresence mode="wait">
          {isEmpty && (
            <motion.div
              key="hero"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, filter: "blur(10px)" }}
              transition={{ duration: 0.35 }}
              className="flex-1 flex flex-col items-center justify-center text-center pb-24 px-2"
            >
              <motion.div
                initial={{ scale: 0.8 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 200, delay: 0.1 }}
                className="mb-8"
              >
                <img
                  src={`${BASE}images/logo-horizontal.png`}
                  alt="Ajeenkya DY Patil University"
                  className="h-16 sm:h-20 w-auto object-contain mx-auto drop-shadow-lg"
                />
              </motion.div>
              <h2 className="font-display text-2xl sm:text-3xl lg:text-4xl font-bold text-foreground mb-3">
                How can I help you today?
              </h2>
              <p className="text-sm sm:text-base text-muted-foreground max-w-xl mb-4 px-2">
                Ask anything about Ajeenkya DY Patil University. My answers are grounded in official university sources.
              </p>
              {!isAuthenticated && (
                <div className="flex items-center gap-2 mb-8 bg-primary/10 border border-primary/20 rounded-xl px-4 py-2.5 text-sm text-primary">
                  <Sparkles className="w-4 h-4 shrink-0" />
                  <span>
                    <strong>{Math.max(0, guestLimit - guestUsed)} of {guestLimit} free searches remaining</strong> · 
                    <button onClick={() => setShowAuthModal(true)} className="ml-1 underline font-semibold hover:no-underline">
                      Sign in for unlimited + history
                    </button>
                  </span>
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-2xl px-2">
                {suggestions.map((s, i) => (
                  <button
                    key={i}
                    onClick={() => handleSuggestion(s)}
                    className="flex items-center gap-3 p-3 sm:p-4 bg-card hover:bg-muted/50 border border-border/50 rounded-2xl text-left transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 group"
                  >
                    <div className="p-2 bg-primary/10 rounded-lg text-primary group-hover:scale-110 transition-transform shrink-0">
                      {i % 2 === 0 ? <Library className="w-4 h-4" /> : <BookOpen className="w-4 h-4" />}
                    </div>
                    <span className="text-sm font-medium text-foreground/80 group-hover:text-foreground">{s}</span>
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Conversation Thread */}
        {!isEmpty && (
          <div className="flex-1 flex flex-col gap-5 pb-32 px-1">
            <AnimatePresence initial={false}>
              {messages.map((msg) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                  className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"} w-full`}
                >
                  {msg.role === "user" ? (
                    <div className="flex items-end gap-2 max-w-[90%]">
                      <div className="bg-primary text-primary-foreground px-5 py-3.5 rounded-3xl rounded-tr-sm shadow-md">
                        <p className="text-sm sm:text-base [&::selection]:bg-white/30 [&::selection]:text-white">{msg.content}</p>
                      </div>
                      <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                        <User className="w-4 h-4 text-primary" />
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start gap-2 sm:gap-3 w-full">
                      <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center shrink-0 mt-1">
                        <Bot className="w-4 h-4 text-primary-foreground" />
                      </div>
                      <div className="bg-card border border-border p-5 sm:p-6 rounded-3xl rounded-tl-sm flex-1 shadow-lg shadow-black/5 flex flex-col gap-4 min-w-0">
                        {msg.response && (() => {
                          const ragCount = msg.response.citations?.length ?? 0;
                          const webCount = msg.response.webCitations?.length ?? 0;
                          const total = ragCount + webCount;
                          const ragPct = total > 0 ? Math.round((ragCount / total) * 100) : (ragCount > 0 ? 100 : 0);
                          const webPct = total > 0 ? Math.round((webCount / total) * 100) : 0;
                          return (
                            <div className="flex flex-col gap-1.5">
                              {/* Row 1: Confidence + Intent */}
                              <div className="flex flex-wrap items-center gap-2">
                                <ConfidenceBadge label={msg.response.confidence.label} score={msg.response.confidence.score} />
                                {msg.response.intent && (
                                  <div className="px-2.5 py-1 bg-muted rounded-full text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                    {msg.response.intent}
                                  </div>
                                )}
                              </div>
                              {/* Row 2: Source mix breakdown */}
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span className="text-xs text-muted-foreground font-medium">Sources:</span>
                                {ragCount > 0 ? (
                                  <div className="flex items-center gap-1 px-2 py-0.5 bg-blue-500/10 border border-blue-500/20 rounded-full text-xs font-semibold text-blue-700 dark:text-blue-400">
                                    <Library className="w-3 h-3" />
                                    KB {ragPct}%
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-1 px-2 py-0.5 bg-muted border border-border rounded-full text-xs font-medium text-muted-foreground/60">
                                    <Library className="w-3 h-3" />
                                    KB 0%
                                  </div>
                                )}
                                {webCount > 0 ? (
                                  <div className="flex items-center gap-1 px-2 py-0.5 bg-orange-500/10 border border-orange-500/20 rounded-full text-xs font-semibold text-orange-700 dark:text-orange-400">
                                    <Globe className="w-3 h-3" />
                                    Web {webPct}%
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-1 px-2 py-0.5 bg-muted border border-border rounded-full text-xs font-medium text-muted-foreground/60">
                                    <Globe className="w-3 h-3" />
                                    Web 0%
                                  </div>
                                )}
                                <div className="flex items-center gap-1 px-2 py-0.5 bg-violet-500/10 border border-violet-500/20 rounded-full text-xs font-semibold text-violet-700 dark:text-violet-400">
                                  <Sparkles className="w-3 h-3" />
                                  OpenAI ✓
                                </div>
                              </div>
                            </div>
                          );
                        })()}
                        {msg.response?.confidence.label.toLowerCase() === "low" && (
                          <div className="bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400 px-4 py-3 rounded-xl text-sm flex items-start gap-2.5">
                            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                            <p><strong>Note:</strong> I couldn't fully verify this from official sources. Contact the university directly for accuracy.</p>
                          </div>
                        )}
                        <div className="prose prose-sm sm:prose-base max-w-none text-foreground prose-a:text-primary prose-headings:font-display overflow-x-auto">
                          <ReactMarkdown
                            components={{
                              a: ({ href, children }) => (
                                <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                                  {children}
                                </a>
                              ),
                            }}
                          >
                            {msg.content}
                          </ReactMarkdown>
                        </div>
                        {msg.response?.entities && msg.response.entities.length > 0 && (
                          <div className="pt-3 border-t border-border">
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Detected Context</p>
                            <div className="flex flex-wrap gap-2">
                              {msg.response.entities.map((entity, idx) => (
                                <div key={idx} className="bg-secondary px-3 py-1 rounded-lg text-xs border border-border flex items-center gap-1.5">
                                  <span className="text-muted-foreground">{entity.type}:</span>
                                  <span className="font-medium text-secondary-foreground">{entity.value}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        {msg.response?.citations && msg.response.citations.length > 0 && (
                          <div className="pt-4 border-t border-border">
                            <h4 className="font-display font-semibold text-base sm:text-lg mb-3 text-foreground flex items-center gap-2">
                              <Library className="w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground" />
                              Sources
                            </h4>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              {msg.response.citations.map((cite, idx) => (
                                <CitationCard key={idx} title={cite.documentTitle} url={cite.sourceUrl} excerpt={cite.excerpt} score={cite.relevanceScore} />
                              ))}
                            </div>
                          </div>
                        )}
                        {msg.response?.webSearchUsed && msg.response.webCitations && msg.response.webCitations.length > 0 && (
                          <div className="pt-4 border-t border-border">
                            <h4 className="font-display font-semibold text-base sm:text-lg mb-3 text-foreground flex items-center gap-2">
                              <Globe className="w-4 h-4 sm:w-5 sm:h-5 text-orange-500" />
                              Web Sources
                            </h4>
                            <div className="flex flex-col gap-2">
                              {msg.response.webCitations.map((wc, idx) => (
                                <a
                                  key={idx}
                                  href={wc.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="group flex flex-col gap-1 bg-orange-500/5 hover:bg-orange-500/10 border border-orange-500/20 rounded-xl p-3 transition-colors"
                                >
                                  <span className="text-sm font-semibold text-foreground group-hover:text-orange-600 dark:group-hover:text-orange-400 line-clamp-1 transition-colors">
                                    {wc.title}
                                  </span>
                                  <span className="text-xs text-muted-foreground line-clamp-2">{wc.snippet}</span>
                                  <span className="text-xs text-orange-600/60 dark:text-orange-400/60 truncate mt-0.5">{wc.url}</span>
                                </a>
                              ))}
                            </div>
                          </div>
                        )}
                        {/* Guest search counter after last message */}
                        {msg.response?.guest && !isAuthenticated && (
                          <div className="pt-3 border-t border-border flex items-center justify-between gap-3 flex-wrap">
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <div className="flex gap-1">
                                {Array.from({ length: msg.response.guest.limit ?? guestLimit }).map((_, i) => (
                                  <div key={i} className={`w-2 h-2 rounded-full ${i < (msg.response?.guest?.used ?? 0) ? "bg-primary" : "bg-muted-foreground/30"}`} />
                                ))}
                              </div>
                              <span>{msg.response.guest.used}/{msg.response.guest.limit} free searches used</span>
                            </div>
                            {(msg.response.guest.remaining ?? 1) === 0 && (
                              <button
                                onClick={() => setShowAuthModal(true)}
                                className="flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
                              >
                                <LogIn className="w-3.5 h-3.5" /> Sign in for unlimited
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>

            {isPending && (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-start gap-2 sm:gap-3 w-full"
              >
                <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center shrink-0">
                  <Bot className="w-4 h-4 text-primary-foreground" />
                </div>
                <div className="bg-card border border-border px-5 py-4 rounded-3xl rounded-tl-sm shadow-lg flex items-center gap-3">
                  <Sparkles className="w-4 h-4 text-primary animate-pulse" />
                  <span className="text-sm text-muted-foreground">Searching official university records...</span>
                  <div className="flex gap-1 ml-1">
                    {[0, 1, 2].map((i) => (
                      <div key={i} className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                    ))}
                  </div>
                </div>
              </motion.div>
            )}
            <div ref={bottomRef} />
          </div>
        )}

        {/* Limit Reached Banner */}
        {limitReached && !isAuthenticated && isEmpty && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex-1 flex items-center justify-center"
          >
            <div className="max-w-md w-full bg-card border border-border rounded-3xl p-8 text-center shadow-xl mx-4">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-5">
                <GraduationCap className="w-8 h-8 text-primary" />
              </div>
              <h3 className="font-display font-bold text-xl text-foreground mb-2">You've used your free searches</h3>
              <p className="text-muted-foreground text-sm mb-6">
                Register for free to get unlimited searches and access your full search history.
              </p>
              <div className="flex flex-col gap-3">
                <button
                  onClick={() => setShowAuthModal(true)}
                  className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold py-3 rounded-2xl transition-all shadow-md hover:shadow-primary/20"
                >
                  Register Free — Unlimited Access
                </button>
                <button
                  onClick={() => setShowAuthModal(true)}
                  className="w-full bg-muted hover:bg-muted/70 text-foreground font-medium py-3 rounded-2xl transition-all text-sm"
                >
                  Already have an account? Sign In
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {/* Input Footer */}
        <div className="fixed bottom-0 left-0 w-full bg-gradient-to-t from-background via-background/95 to-transparent pt-12 pb-6 px-4 z-20">
          <div className="max-w-4xl mx-auto">
            <form onSubmit={handleSubmit} className="relative group shadow-2xl shadow-primary/5 rounded-2xl">
              <input
                ref={inputRef}
                type="text"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder={limitReached && !isAuthenticated ? "Sign in to continue searching..." : messages.length > 0 ? "Ask a follow-up question..." : "Ask about admissions, fees, courses..."}
                disabled={isPending || (limitReached && !isAuthenticated)}
                className={`w-full bg-card border-2 border-border focus:border-primary focus:ring-4 focus:ring-primary/10 rounded-2xl py-3.5 sm:py-4 pl-4 sm:pl-6 text-sm sm:text-base text-foreground placeholder:text-muted-foreground transition-all duration-300 outline-none disabled:opacity-70 ${webSearchEnabled ? "pr-28 sm:pr-32" : "pr-14"}`}
              />
              <div className="absolute right-2 top-2 bottom-2 flex items-center gap-1.5">
                {webSearchEnabled && (
                  <button
                    type="button"
                    title={sessionWebSearch ? "Web search ON — click to turn off" : "Web search OFF — click to turn on"}
                    onClick={() => setSessionWebSearch(v => !v)}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-semibold transition-all h-full border ${
                      sessionWebSearch
                        ? "bg-orange-500/15 text-orange-600 dark:text-orange-400 border-orange-500/20 hover:bg-orange-500/25"
                        : "bg-muted text-muted-foreground border-border hover:border-orange-400/40 hover:text-orange-500"
                    }`}
                  >
                    <Globe className="w-3.5 h-3.5 shrink-0" />
                    <span className="hidden sm:inline">Web</span>
                  </button>
                )}
                <button
                  type={limitReached && !isAuthenticated ? "button" : "submit"}
                  onClick={limitReached && !isAuthenticated ? () => setShowAuthModal(true) : undefined}
                  disabled={(!question.trim() || isPending) && !(limitReached && !isAuthenticated)}
                  className="aspect-square h-full bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl flex items-center justify-center transition-all duration-200 disabled:opacity-50 shadow-md hover:-translate-y-0.5 active:translate-y-0"
                >
                  {isPending ? <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" /> : limitReached && !isAuthenticated ? <LogIn className="w-4 h-4 sm:w-5 sm:h-5" /> : <Send className="w-4 h-4 sm:w-5 sm:h-5" />}
                </button>
              </div>
            </form>
            <p className="text-center text-xs text-muted-foreground mt-2">
              Answers grounded in official ADYPU sources
              {!isAuthenticated && <> · <button onClick={() => setShowAuthModal(true)} className="text-primary hover:underline">Sign in for unlimited</button></>}
            </p>
          </div>
        </div>
      </div>

      {/* History Drawer */}
      <AnimatePresence>
        {historyOpen && isAuthenticated && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/40 z-40"
              onClick={() => setHistoryOpen(false)}
            />
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", stiffness: 340, damping: 34 }}
              className="fixed right-0 top-0 bottom-0 w-full max-w-sm bg-card border-l border-border z-50 flex flex-col shadow-2xl"
            >
              <div className="flex items-center justify-between px-5 py-4 border-b border-border">
                <div className="flex items-center gap-2">
                  <History className="w-5 h-5 text-primary" />
                  <h3 className="font-display font-bold text-lg">Search History</h3>
                </div>
                <div className="flex items-center gap-2">
                  {history.length > 0 && (
                    <button
                      onClick={clearAllHistory}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Clear All
                    </button>
                  )}
                  <button onClick={() => setHistoryOpen(false)} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
                    <X className="w-5 h-5 text-muted-foreground" />
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto">
                {historyLoading ? (
                  <div className="flex items-center justify-center h-32">
                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                  </div>
                ) : history.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-48 text-center px-6">
                    <Clock className="w-10 h-10 text-muted-foreground/40 mb-3" />
                    <p className="font-medium text-muted-foreground">No history yet</p>
                    <p className="text-xs text-muted-foreground/60 mt-1">Your searches will appear here</p>
                  </div>
                ) : (
                  <div className="p-3 flex flex-col gap-2">
                    {history.map((item) => (
                      <div
                        key={item.id}
                        className="group relative bg-background border border-border rounded-2xl p-4 hover:border-primary/40 transition-all cursor-pointer"
                        onClick={() => {
                          setHistoryOpen(false);
                          sendMessage(item.question);
                        }}
                      >
                        <div className="flex items-start gap-3 pr-8">
                          <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                            <GraduationCap className="w-3.5 h-3.5 text-primary" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-foreground line-clamp-2">{item.question}</p>
                            {item.answer && (
                              <p className="text-xs text-muted-foreground line-clamp-1 mt-1">{item.answer}</p>
                            )}
                            <div className="flex items-center gap-2 mt-2">
                              <span className="text-xs text-muted-foreground/60">
                                {new Date(item.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                              </span>
                              {item.confidence.label && (
                                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${item.confidence.label === "high" ? "bg-green-500/10 text-green-600" : item.confidence.label === "medium" ? "bg-amber-500/10 text-amber-600" : "bg-red-500/10 text-red-600"}`}>
                                  {item.confidence.label}
                                </span>
                              )}
                            </div>
                          </div>
                          <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0 mt-1 group-hover:text-primary transition-colors" />
                        </div>
                        <button
                          onClick={(e) => { e.stopPropagation(); deleteHistoryItem(item.id); }}
                          className="absolute top-3 right-3 p-1 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-all"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <AuthModal open={showAuthModal} onClose={() => setShowAuthModal(false)} />
    </PublicLayout>
  );
}
