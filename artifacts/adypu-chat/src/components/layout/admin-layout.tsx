import { ReactNode, useState } from "react";
import { Link, useLocation } from "wouter";
import { 
  LayoutDashboard, 
  Database, 
  Globe, 
  MessageSquareWarning, 
  LogOut,
  ChevronRight,
  ShieldAlert,
  Menu,
  X,
  Users,
  Settings,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/sources", label: "Crawl Sources", icon: Globe },
  { href: "/admin/documents", label: "Documents", icon: Database },
  { href: "/admin/review", label: "Low Confidence", icon: MessageSquareWarning },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/settings", label: "Settings", icon: Settings },
];

export function AdminLayout({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const { logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const navContent = (
    <>
      <div className="h-16 flex items-center px-6 border-b border-border shrink-0">
        <Link href="/" className="flex items-center gap-3" onClick={() => setSidebarOpen(false)}>
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center shadow-md">
            <ShieldAlert className="w-4 h-4 text-primary-foreground" />
          </div>
          <span className="font-display font-bold text-lg">Admin Portal</span>
        </Link>
        {/* Close button on mobile */}
        <button
          className="ml-auto lg:hidden p-1 rounded-lg text-muted-foreground hover:bg-muted"
          onClick={() => setSidebarOpen(false)}
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
        {NAV_ITEMS.map((item) => {
          const isActive = location === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setSidebarOpen(false)}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200",
                isActive
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Icon className={cn("w-5 h-5 shrink-0", isActive ? "text-primary" : "")} />
              {item.label}
              {isActive && <ChevronRight className="w-4 h-4 ml-auto opacity-50" />}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-border shrink-0">
        <button
          onClick={() => { logout(); setSidebarOpen(false); }}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-destructive/80 hover:text-destructive hover:bg-destructive/10 transition-colors"
        >
          <LogOut className="w-5 h-5" />
          Sign Out
        </button>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-muted/30 flex text-foreground">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex w-64 bg-card border-r border-border flex-col shrink-0 sticky top-0 h-screen">
        {navContent}
      </aside>

      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Mobile Sidebar Drawer */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-72 bg-card border-r border-border flex flex-col lg:hidden transition-transform duration-300 ease-in-out",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {navContent}
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="h-16 bg-card/50 backdrop-blur border-b border-border sticky top-0 z-30 flex items-center px-4 sm:px-8 gap-4">
          {/* Mobile menu button */}
          <button
            className="lg:hidden p-2 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="w-5 h-5" />
          </button>
          <h2 className="font-display font-semibold text-lg sm:text-xl text-foreground flex-1">
            {NAV_ITEMS.find((i) => i.href === location)?.label ?? "Admin"}
          </h2>
          {/* ADYPU Logo — top right */}
          <Link href="/">
            <img
              src="/images/logo-horizontal.png"
              alt="Ajeenkya DY Patil University"
              className="h-9 w-auto object-contain opacity-90 hover:opacity-100 transition-opacity"
            />
          </Link>
        </header>
        <div className="p-4 sm:p-6 lg:p-8 flex-1 max-w-6xl mx-auto w-full">
          {children}
        </div>
      </main>
    </div>
  );
}
