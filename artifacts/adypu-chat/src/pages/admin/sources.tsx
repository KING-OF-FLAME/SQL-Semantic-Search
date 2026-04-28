import { useState } from "react";
import { AdminLayout } from "@/components/layout/admin-layout";
import { useAdminSources, useAdminAddSource, useAdminRemoveSource, useAdminToggleSource, useAdminApi } from "@/hooks/use-admin-api";
import { Globe, Plus, Trash2, Loader2, Link as LinkIcon, ToggleLeft, ToggleRight, ExternalLink, FileSearch, CheckCircle2, Upload } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { formatDate } from "@/lib/utils";

type SitemapResult = {
  success: boolean;
  totalUrls: number;
  domainsFound: number;
  sourcesAdded: number;
  sourcesSkipped: number;
  sitemapsProcessed: number;
};

export default function AdminSources() {
  const { data, isLoading } = useAdminSources();
  const { mutate: addSource, isPending: isAdding } = useAdminAddSource();
  const { mutate: removeSource, isPending: isRemoving } = useAdminRemoveSource();
  const { mutate: toggleSource, isPending: isToggling } = useAdminToggleSource();
  const { adminFetch } = useAdminApi();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [domain, setDomain] = useState("");
  const [urlPattern, setUrlPattern] = useState("");
  const [seedUrl, setSeedUrl] = useState("");
  const [sitemapUrl, setSitemapUrl] = useState("");
  const [sitemapResult, setSitemapResult] = useState<SitemapResult | null>(null);

  const { mutate: importSitemap, isPending: isImporting } = useMutation({
    mutationFn: async () => {
      if (!sitemapUrl) throw new Error("Please enter a sitemap URL");
      const res = await adminFetch("/admin/crawl/import-sitemap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sitemapUrl }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? "Import failed");
      return data as SitemapResult;
    },
    onSuccess: (result) => {
      setSitemapResult(result);
      toast({
        title: "Sitemap Imported",
        description: `Found ${result.totalUrls} URLs across ${result.domainsFound} domains. Added ${result.sourcesAdded} new source${result.sourcesAdded !== 1 ? "s" : ""}.`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/sources"] });
    },
    onError: (err) => {
      setSitemapResult(null);
      toast({ title: "Import Failed", description: err.message, variant: "destructive" });
    },
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["/api/admin/sources"] });

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!domain || !urlPattern) return;
    addSource({ data: { domain, urlPattern, seedUrl } }, {
      onSuccess: () => {
        toast({ title: "Source Added", description: `${domain} is now available for crawling.` });
        setDomain(""); setUrlPattern(""); setSeedUrl("");
        invalidate();
      },
      onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" })
    });
  };

  const handleToggle = (id: number, currentlyActive: boolean) => {
    toggleSource(id, {
      onSuccess: () => {
        toast({ title: currentlyActive ? "Source Deactivated" : "Source Activated", description: currentlyActive ? "This source will be skipped in future crawls." : "This source will be included in future crawls." });
        invalidate();
      },
      onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" })
    });
  };

  const handleRemove = (id: number, domain: string) => {
    if (!confirm(`Remove "${domain}" from allowed sources?`)) return;
    removeSource({ id }, {
      onSuccess: () => {
        toast({ title: "Source Removed" });
        invalidate();
      },
      onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" })
    });
  };

  return (
    <AdminLayout>
      <div className="space-y-6">

        {/* Sitemap Import */}
        <div className="bg-card border border-border p-5 sm:p-6 rounded-2xl shadow-sm">
          <div className="flex items-center gap-3 mb-5">
            <div className="p-2 bg-blue-500/10 text-blue-600 rounded-lg">
              <FileSearch className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-display font-bold text-lg sm:text-xl text-foreground">Import from Sitemap</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Paste a sitemap.xml URL — all domains will be auto-detected and added as crawl sources</p>
            </div>
          </div>

          <div className="flex gap-3 flex-col sm:flex-row">
            <input
              value={sitemapUrl}
              onChange={e => { setSitemapUrl(e.target.value); setSitemapResult(null); }}
              placeholder="https://adypu.edu.in/sitemap.xml"
              className="flex-1 bg-background border border-border rounded-xl py-2.5 px-3 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
            />
            <button
              onClick={() => importSitemap()}
              disabled={isImporting || !sitemapUrl.trim()}
              className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl text-sm font-medium flex items-center gap-2 transition-all disabled:opacity-50 shadow-md shadow-blue-600/20 whitespace-nowrap"
            >
              {isImporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              {isImporting ? "Scanning..." : "Import Sitemap"}
            </button>
          </div>

          {sitemapResult && (
            <div className="mt-4 p-4 bg-green-500/5 border border-green-500/20 rounded-xl flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5 shrink-0" />
              <div className="text-sm space-y-1">
                <p className="font-semibold text-green-700">Sitemap imported successfully</p>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-muted-foreground text-xs mt-1">
                  <span>📄 <strong>{sitemapResult.totalUrls}</strong> URLs found</span>
                  <span>🌐 <strong>{sitemapResult.domainsFound}</strong> domain{sitemapResult.domainsFound !== 1 ? "s" : ""} detected</span>
                  <span>✅ <strong>{sitemapResult.sourcesAdded}</strong> source{sitemapResult.sourcesAdded !== 1 ? "s" : ""} added</span>
                  {sitemapResult.sourcesSkipped > 0 && <span>⏭️ <strong>{sitemapResult.sourcesSkipped}</strong> already existed</span>}
                  {sitemapResult.sitemapsProcessed > 1 && <span>🗺️ <strong>{sitemapResult.sitemapsProcessed}</strong> sitemaps processed</span>}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Add Source Form */}
        <div className="bg-card border border-border p-5 sm:p-6 rounded-2xl shadow-sm">
          <div className="flex items-center gap-3 mb-5">
            <div className="p-2 bg-primary/10 text-primary rounded-lg">
              <Plus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-display font-bold text-lg sm:text-xl text-foreground">Add New Source</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Only pages matching the URL pattern will be crawled</p>
            </div>
          </div>
          
          <form onSubmit={handleAdd} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground mb-1.5 block">Domain <span className="text-destructive">*</span></label>
                <input 
                  value={domain} onChange={e => setDomain(e.target.value)}
                  placeholder="adypu.edu.in"
                  className="w-full bg-background border border-border rounded-xl py-2.5 px-3 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground mb-1.5 block">URL Pattern <span className="text-destructive">*</span></label>
                <input 
                  value={urlPattern} onChange={e => setUrlPattern(e.target.value)}
                  placeholder="https://adypu.edu.in/*"
                  className="w-full bg-background border border-border rounded-xl py-2.5 px-3 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground mb-1.5 block">Seed URL <span className="text-muted-foreground text-xs font-normal">(optional)</span></label>
                <input 
                  value={seedUrl} onChange={e => setSeedUrl(e.target.value)}
                  placeholder="https://adypu.edu.in"
                  className="w-full bg-background border border-border rounded-xl py-2.5 px-3 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                />
              </div>
            </div>
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={isAdding || !domain || !urlPattern}
                className="bg-primary hover:bg-primary/90 text-primary-foreground px-5 py-2.5 rounded-xl text-sm font-medium flex items-center gap-2 transition-all disabled:opacity-50 shadow-md shadow-primary/20"
              >
                {isAdding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                Add Source
              </button>
            </div>
          </form>
        </div>

        {/* Sources List */}
        <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
          <div className="p-5 sm:p-6 border-b border-border flex items-center gap-3">
            <Globe className="w-5 h-5 text-muted-foreground" />
            <h3 className="font-display font-bold text-lg text-foreground">Allowed Crawl Sources</h3>
            <span className="ml-auto text-xs font-medium text-muted-foreground bg-muted rounded-full px-2.5 py-1">
              {data?.sources?.filter(s => s.isActive).length ?? 0} active
            </span>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/50 text-muted-foreground font-medium">
                <tr>
                  <th className="px-4 sm:px-6 py-4 whitespace-nowrap">Domain</th>
                  <th className="px-4 sm:px-6 py-4 whitespace-nowrap hidden md:table-cell">URL Pattern</th>
                  <th className="px-4 sm:px-6 py-4 whitespace-nowrap">Status</th>
                  <th className="px-4 sm:px-6 py-4 whitespace-nowrap hidden lg:table-cell">Added</th>
                  <th className="px-4 sm:px-6 py-4 text-right whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {isLoading ? (
                  <tr><td colSpan={5} className="p-10 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" /></td></tr>
                ) : data?.sources?.length === 0 ? (
                  <tr><td colSpan={5} className="px-6 py-12 text-center text-muted-foreground">No sources configured yet.</td></tr>
                ) : (
                  data?.sources?.map((source) => (
                    <tr key={source.id} className="hover:bg-muted/30 transition-colors group">
                      <td className="px-4 sm:px-6 py-4">
                        <div className="flex items-center gap-2">
                          <LinkIcon className="w-4 h-4 text-muted-foreground shrink-0" />
                          <div>
                            <span className="font-semibold text-sm">{source.domain}</span>
                            {source.seedUrl && (
                              <a href={source.seedUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary mt-0.5 transition-colors">
                                <ExternalLink className="w-2.5 h-2.5" />
                                {source.seedUrl}
                              </a>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 sm:px-6 py-4 hidden md:table-cell">
                        <code className="text-xs bg-muted px-2 py-1 rounded text-muted-foreground">{source.urlPattern}</code>
                      </td>
                      <td className="px-4 sm:px-6 py-4">
                        <button
                          onClick={() => handleToggle(source.id, source.isActive)}
                          disabled={isToggling}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold transition-all hover:scale-105 ${
                            source.isActive 
                              ? 'bg-green-500/10 text-green-600 hover:bg-green-500/20' 
                              : 'bg-muted text-muted-foreground hover:bg-muted/70'
                          }`}
                          title={source.isActive ? "Click to deactivate" : "Click to activate"}
                        >
                          {isToggling 
                            ? <Loader2 className="w-3 h-3 animate-spin" /> 
                            : source.isActive 
                              ? <ToggleRight className="w-3.5 h-3.5" /> 
                              : <ToggleLeft className="w-3.5 h-3.5" />
                          }
                          {source.isActive ? 'Active' : 'Inactive'}
                        </button>
                      </td>
                      <td className="px-4 sm:px-6 py-4 text-muted-foreground text-xs whitespace-nowrap hidden lg:table-cell">
                        {formatDate(source.createdAt)}
                      </td>
                      <td className="px-4 sm:px-6 py-4 text-right">
                        <button
                          onClick={() => handleRemove(source.id, source.domain)}
                          disabled={isRemoving}
                          className="p-1.5 text-destructive/60 hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                          title="Remove source"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </AdminLayout>
  );
}
