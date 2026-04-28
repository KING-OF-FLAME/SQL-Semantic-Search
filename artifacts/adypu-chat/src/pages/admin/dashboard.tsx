import { useEffect } from "react";
import { AdminLayout } from "@/components/layout/admin-layout";
import { useAdminStats, useAdminStartCrawl, useAdminRecrawlStale, useAdminCancelCrawl } from "@/hooks/use-admin-api";
import { FileText, Layers, AlertCircle, Globe, Play, RefreshCw, Loader2, XCircle, Clock, CheckCircle, Search } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { formatDate } from "@/lib/utils";

function StatusBadge({ status }: { status: string }) {
  if (status === "completed") return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-green-500/10 text-green-600">
      <CheckCircle className="w-3 h-3" /> COMPLETED
    </span>
  );
  if (status === "failed") return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-500/10 text-red-600">
      <XCircle className="w-3 h-3" /> FAILED
    </span>
  );
  if (status === "running") return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-600 animate-pulse">
      <Loader2 className="w-3 h-3 animate-spin" /> RUNNING
    </span>
  );
  if (status === "discovering") return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-purple-500/10 text-purple-600 animate-pulse">
      <Search className="w-3 h-3 animate-pulse" /> DISCOVERING
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-yellow-500/10 text-yellow-600">
      <Clock className="w-3 h-3" /> PENDING
    </span>
  );
}

function formatEta(seconds: number): string {
  if (seconds < 60) return `~${Math.ceil(seconds)}s`;
  const mins = Math.ceil(seconds / 60);
  if (mins < 60) return `~${mins} min`;
  const hrs = Math.floor(mins / 60);
  const remMins = mins % 60;
  return `~${hrs}h ${remMins}m`;
}

export default function AdminDashboard() {
  const { data: stats, isLoading, error, refetch } = useAdminStats();
  const { mutate: startCrawl, isPending: isStarting } = useAdminStartCrawl();
  const { mutate: recrawl, isPending: isRecrawling } = useAdminRecrawlStale();
  const { mutate: cancelCrawl, isPending: isCancelling } = useAdminCancelCrawl();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const invalidateStats = () => queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
  const hasActiveJob = !!stats?.activeJob;

  // Poll every 5 seconds while a job is running
  useEffect(() => {
    if (!hasActiveJob) return;
    const interval = setInterval(() => { refetch(); }, 5000);
    return () => clearInterval(interval);
  }, [hasActiveJob, refetch]);

  const handleStartCrawl = () => {
    startCrawl({ data: { maxDepth: 3 } }, {
      onSuccess: () => {
        toast({ title: "Crawl Started", description: "Discovering pages…" });
        invalidateStats();
      },
      onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" })
    });
  };

  const handleRecrawl = () => {
    recrawl(undefined, {
      onSuccess: () => {
        toast({ title: "Recrawl Started", description: "Stale pages are being refreshed." });
        invalidateStats();
      },
      onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" })
    });
  };

  const handleCancel = () => {
    cancelCrawl(undefined, {
      onSuccess: () => {
        toast({ title: "Crawl Cancelled", description: "All running jobs have been stopped." });
        invalidateStats();
      },
      onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" })
    });
  };

  if (isLoading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </AdminLayout>
    );
  }

  if (error || !stats) {
    return (
      <AdminLayout>
        <div className="p-6 bg-destructive/10 text-destructive rounded-xl border border-destructive/20">
          Failed to load dashboard. Please check your login and try again.
        </div>
      </AdminLayout>
    );
  }

  const activeJob = stats.activeJob;
  const isDiscovering = activeJob?.status === "discovering";
  const totalForProgress = activeJob?.totalPagesDiscovered && activeJob.totalPagesDiscovered > 0
    ? activeJob.totalPagesDiscovered
    : activeJob?.pagesFound ?? 0;
  const progressPct = !isDiscovering && totalForProgress > 0
    ? Math.min(100, Math.round((activeJob!.pagesProcessed / totalForProgress) * 100))
    : 0;

  // ETA calculation
  let etaStr = "";
  if (!isDiscovering && activeJob?.startedAt && activeJob.pagesProcessed > 0 && totalForProgress > activeJob.pagesProcessed) {
    const elapsedMs = Date.now() - new Date(activeJob.startedAt).getTime();
    const msPerPage = elapsedMs / activeJob.pagesProcessed;
    const remaining = totalForProgress - activeJob.pagesProcessed;
    etaStr = formatEta((remaining * msPerPage) / 1000);
  }

  const statCards = [
    { title: "Indexed Documents", value: stats.totalDocuments, icon: FileText, color: "text-blue-500", bg: "bg-blue-500/10" },
    { title: "Vector Chunks", value: stats.totalChunks, icon: Layers, color: "text-purple-500", bg: "bg-purple-500/10" },
    { title: "Inactive Pages", value: stats.failedPages, icon: AlertCircle, color: "text-red-500", bg: "bg-red-500/10" },
    { title: "Active Sources", value: stats.totalSources, icon: Globe, color: "text-green-500", bg: "bg-green-500/10" },
  ];

  return (
    <AdminLayout>
      <div className="space-y-6">

        {/* Active Job Banner */}
        {activeJob && (
          <div className={`border rounded-2xl p-5 ${isDiscovering ? "bg-purple-500/10 border-purple-500/20" : "bg-blue-500/10 border-blue-500/20"}`}>
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  {isDiscovering
                    ? <Search className="w-4 h-4 text-purple-500 animate-pulse shrink-0" />
                    : <Loader2 className="w-4 h-4 text-blue-500 animate-spin shrink-0" />
                  }
                  <span className={`font-semibold ${isDiscovering ? "text-purple-700 dark:text-purple-400" : "text-blue-700 dark:text-blue-400"}`}>
                    {isDiscovering
                      ? `Discovering pages… — Job #${activeJob.id}`
                      : `Crawl in Progress — Job #${activeJob.id}`
                    }
                  </span>
                </div>

                {isDiscovering ? (
                  <div>
                    <div className="w-full bg-purple-200/40 rounded-full h-2.5 mb-2 overflow-hidden">
                      <div className="bg-purple-500 h-2.5 rounded-full animate-[pulse_1s_ease-in-out_infinite] w-full opacity-60" />
                    </div>
                    <p className="text-sm text-purple-600 dark:text-purple-300">
                      Scanning sitemaps to find all pages… this takes a few seconds.
                    </p>
                  </div>
                ) : (
                  <div>
                    <div className="w-full bg-blue-200/40 rounded-full h-2.5 mb-2">
                      <div
                        className="bg-blue-500 h-2.5 rounded-full transition-all duration-500"
                        style={{ width: `${Math.max(2, progressPct)}%` }}
                      />
                    </div>
                    <p className="text-sm text-blue-600 dark:text-blue-300">
                      <span className="font-semibold">{activeJob.pagesProcessed.toLocaleString()}</span>
                      {" of "}
                      <span className="font-semibold">{totalForProgress > 0 ? totalForProgress.toLocaleString() : "?"}</span>
                      {" pages indexed "}
                      <span className="opacity-75">({progressPct}%)</span>
                      {etaStr && <span className="ml-2 font-medium">· {etaStr} remaining</span>}
                      {activeJob.pagesFailed > 0 && (
                        <span className="text-red-500 ml-2">· {activeJob.pagesFailed} failed</span>
                      )}
                    </p>
                  </div>
                )}
              </div>
              <button
                onClick={handleCancel}
                disabled={isCancelling}
                className="shrink-0 flex items-center gap-2 px-4 py-2 bg-red-500/10 text-red-600 border border-red-500/20 hover:bg-red-500/20 rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
              >
                {isCancelling ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Actions Row */}
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between bg-card p-5 sm:p-6 rounded-2xl border border-border shadow-sm">
          <div>
            <h3 className="font-display font-bold text-lg sm:text-xl text-foreground">Pipeline Controls</h3>
            <p className="text-sm text-muted-foreground mt-0.5">Start or refresh the content indexing pipeline</p>
          </div>
          <div className="flex flex-wrap gap-3 w-full sm:w-auto">
            <button
              onClick={handleRecrawl}
              disabled={isRecrawling || isStarting || hasActiveJob}
              className="flex-1 sm:flex-none px-4 py-2.5 bg-secondary text-secondary-foreground font-medium rounded-xl flex items-center justify-center gap-2 hover:bg-secondary/80 transition-colors disabled:opacity-50"
            >
              {isRecrawling ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              Recrawl Stale
            </button>
            <button
              onClick={handleStartCrawl}
              disabled={isStarting || isRecrawling || hasActiveJob}
              className="flex-1 sm:flex-none px-5 py-2.5 bg-primary text-primary-foreground font-semibold rounded-xl flex items-center justify-center gap-2 hover:-translate-y-0.5 transition-all shadow-lg shadow-primary/20 disabled:opacity-50 disabled:hover:translate-y-0"
            >
              {isStarting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
              Start Full Crawl
            </button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {statCards.map((card, idx) => {
            const Icon = card.icon;
            return (
              <div key={idx} className="bg-card border border-border p-4 sm:p-6 rounded-2xl shadow-sm flex items-start gap-3 sm:gap-4">
                <div className={`p-2.5 sm:p-3 rounded-xl ${card.bg} ${card.color} shrink-0`}>
                  <Icon className="w-5 h-5 sm:w-6 sm:h-6" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs sm:text-sm font-medium text-muted-foreground leading-tight">{card.title}</p>
                  <p className="text-xl sm:text-2xl font-bold text-foreground mt-1">{Number(card.value).toLocaleString()}</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Low Confidence Alert */}
        {stats.lowConfidenceCount > 0 && (
          <div className="flex items-center gap-4 bg-yellow-500/10 border border-yellow-500/20 rounded-2xl p-4 sm:p-5">
            <AlertCircle className="w-5 h-5 text-yellow-600 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-yellow-700 dark:text-yellow-400 text-sm sm:text-base">
                {stats.lowConfidenceCount} low-confidence {stats.lowConfidenceCount === 1 ? "query" : "queries"} detected
              </p>
              <p className="text-xs sm:text-sm text-yellow-600 dark:text-yellow-500 mt-0.5">
                Review these questions — the knowledge base may need more content.
              </p>
            </div>
            <a href="/admin/review" className="shrink-0 text-xs sm:text-sm font-semibold text-yellow-700 dark:text-yellow-400 hover:underline">
              Review →
            </a>
          </div>
        )}

        {/* Recent Jobs Table */}
        <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
          <div className="p-5 sm:p-6 border-b border-border flex items-center justify-between">
            <h3 className="font-display font-bold text-lg text-foreground">Recent Crawl Jobs</h3>
            {hasActiveJob && (
              <span className="text-xs text-blue-500 font-medium animate-pulse">Live — refreshing every 5s</span>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/50 text-muted-foreground font-medium">
                <tr>
                  <th className="px-4 sm:px-6 py-4 whitespace-nowrap">Job ID</th>
                  <th className="px-4 sm:px-6 py-4 whitespace-nowrap">Status</th>
                  <th className="px-4 sm:px-6 py-4 whitespace-nowrap hidden sm:table-cell">Started</th>
                  <th className="px-4 sm:px-6 py-4 whitespace-nowrap hidden md:table-cell">Completed</th>
                  <th className="px-4 sm:px-6 py-4 whitespace-nowrap">Pages</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {stats.recentJobs && stats.recentJobs.length > 0 ? (
                  stats.recentJobs.map((job) => (
                    <tr key={job.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 sm:px-6 py-4 font-mono text-xs sm:text-sm">#{job.id}</td>
                      <td className="px-4 sm:px-6 py-4"><StatusBadge status={job.status} /></td>
                      <td className="px-4 sm:px-6 py-4 text-muted-foreground text-xs sm:text-sm whitespace-nowrap hidden sm:table-cell">{formatDate(job.startedAt)}</td>
                      <td className="px-4 sm:px-6 py-4 text-muted-foreground text-xs sm:text-sm whitespace-nowrap hidden md:table-cell">{job.completedAt ? formatDate(job.completedAt) : "—"}</td>
                      <td className="px-4 sm:px-6 py-4 text-sm">
                        <span className="font-medium">{job.pagesProcessed.toLocaleString()}</span>
                        <span className="text-muted-foreground"> / {(job.totalPagesDiscovered || job.pagesFound || 0).toLocaleString()}</span>
                        {job.pagesFailed > 0 && <span className="text-destructive ml-1 text-xs">({job.pagesFailed} failed)</span>}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-muted-foreground">
                      No crawl jobs yet. Click "Start Full Crawl" to index ADYPU sources.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </AdminLayout>
  );
}
