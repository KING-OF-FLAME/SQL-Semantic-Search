import { ReactNode, useState, useRef, useEffect } from "react";
import { Link } from "wouter";
import { ShieldCheck, Moon, Sun, User, LogOut, History, ChevronDown } from "lucide-react";
import { usePublicAuth } from "@/hooks/use-public-auth";
import { AuthModal } from "@/components/ui/auth-modal";

interface PublicLayoutProps {
  children: ReactNode;
  onOpenHistory?: () => void;
  noFooter?: boolean;
}

export function PublicLayout({ children, onOpenHistory, noFooter = false }: PublicLayoutProps) {
  const [isDark, setIsDark] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [authTab, setAuthTab] = useState<"login" | "register">("login");
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);
  const { isAuthenticated, user, logout } = usePublicAuth();

  useEffect(() => {
    if (document.documentElement.classList.contains("dark")) {
      setIsDark(true);
    }
  }, []);

  // Close profile dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const toggleTheme = () => {
    const root = document.documentElement;
    if (root.classList.contains("dark")) {
      root.classList.remove("dark");
      setIsDark(false);
    } else {
      root.classList.add("dark");
      setIsDark(true);
    }
  };

  const openLogin = () => { setAuthTab("login"); setAuthOpen(true); };
  const openRegister = () => { setAuthTab("register"); setAuthOpen(true); };

  return (
    <div className="min-h-screen flex flex-col bg-background relative overflow-hidden">
      {/* Decorative background */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-primary/5 blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-accent/5 blur-[120px]" />
      </div>

      <header className="sticky top-0 z-40 w-full backdrop-blur-xl bg-background/80 border-b border-border/50">
        <div className="container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          {/* Brand */}
          <Link href="/" className="flex items-center group">
            <img
              src={`${import.meta.env.BASE_URL}images/logo-horizontal.png`}
              alt="Ajeenkya DY Patil University"
              className="h-10 w-auto object-contain group-hover:opacity-90 transition-opacity"
            />
          </Link>

          {/* Right actions */}
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={toggleTheme}
              className="p-2 rounded-full text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              aria-label="Toggle theme"
            >
              {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>

            {/* Admin link */}
            <Link
              href="/admin/login"
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              Admin
            </Link>

            {/* Auth area */}
            {!isAuthenticated ? (
              <button
                onClick={openLogin}
                className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-semibold rounded-xl transition-all duration-200 shadow-md hover:shadow-primary/25 hover:-translate-y-0.5 active:translate-y-0"
              >
                <User className="w-4 h-4" />
                <span>Sign In</span>
              </button>
            ) : (
              <div className="relative" ref={profileRef}>
                <button
                  onClick={() => setProfileOpen((v) => !v)}
                  className="flex items-center gap-2 px-3 py-1.5 bg-muted hover:bg-muted/80 border border-border rounded-xl text-sm font-medium text-foreground transition-all"
                >
                  <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                    <User className="w-3.5 h-3.5 text-primary-foreground" />
                  </div>
                  <span className="max-w-[80px] truncate hidden sm:block">{user?.username}</span>
                  <ChevronDown className={`w-3.5 h-3.5 text-muted-foreground transition-transform ${profileOpen ? "rotate-180" : ""}`} />
                </button>

                {profileOpen && (
                  <div className="absolute right-0 top-full mt-2 w-52 bg-card border border-border rounded-2xl shadow-xl py-1.5 z-50 overflow-hidden">
                    <div className="px-4 py-2.5 border-b border-border">
                      <p className="text-sm font-semibold text-foreground truncate">{user?.username}</p>
                      <p className="text-xs text-muted-foreground capitalize">{user?.role}</p>
                    </div>
                    {onOpenHistory && (
                      <button
                        onClick={() => { setProfileOpen(false); onOpenHistory(); }}
                        className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-foreground hover:bg-muted transition-colors"
                      >
                        <History className="w-4 h-4 text-muted-foreground" />
                        Search History
                      </button>
                    )}
                    <button
                      onClick={() => { setProfileOpen(false); logout(); }}
                      className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-destructive hover:bg-destructive/10 transition-colors"
                    >
                      <LogOut className="w-4 h-4" />
                      Sign Out
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>

      {!noFooter && (
        <footer className="py-6 text-center text-sm text-muted-foreground relative z-10">
          <p>
            Grounded strictly in official Ajeenkya DY Patil University sources.{" "}
            {!isAuthenticated && (
              <button onClick={openRegister} className="text-primary hover:underline font-medium">
                Register free
              </button>
            )}{" "}
            {!isAuthenticated && "to save your search history."}
          </p>
        </footer>
      )}

      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} defaultTab={authTab} />
    </div>
  );
}
