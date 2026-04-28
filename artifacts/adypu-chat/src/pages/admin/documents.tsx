import { useState } from "react";
import { AdminLayout } from "@/components/layout/admin-layout";
import { useAdminDocuments, useAdminDeleteDocument } from "@/hooks/use-admin-api";
import { FileText, Search, Loader2, ExternalLink, Trash2, RefreshCw } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

export default function AdminDocuments() {
  const [page, setPage] = useState(1);
  const [sourceFilter, setSourceFilter] = useState("");
  const { data, isLoading, refetch, isFetching } = useAdminDocuments({ 
    page, 
    limit: 15,
    source: sourceFilter || undefined
  });
  const { mutate: deleteDoc, isPending: isDeleting } = useAdminDeleteDocument();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["/api/admin/documents"] });

  const handleDelete = (id: number, title: string) => {
    if (!confirm(`Delete "${title || "this document"}"? All its chunks will be removed.`)) return;
    deleteDoc(id, {
      onSuccess: () => {
        toast({ title: "Deleted", description: "Document and its chunks have been removed." });
        invalidate();
      },
      onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" }),
    });
  };

  const totalPages = data ? Math.ceil(data.total / data.limit) : 1;

  return (
    <AdminLayout>
      <div className="space-y-5">
        
        {/* Filters Row */}
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
          <div className="relative flex-1 sm:max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input 
              type="text"
              placeholder="Filter by domain..."
              value={sourceFilter}
              onChange={(e) => { setSourceFilter(e.target.value); setPage(1); }}
              className="w-full pl-9 pr-4 py-2.5 bg-card border border-border rounded-xl focus:border-primary outline-none transition-colors text-sm"
            />
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground bg-card border border-border rounded-xl px-4 py-2.5">
            {isLoading || isFetching ? (
              <Loader2 className="w-4 h-4 animate-spin text-primary" />
            ) : (
              <FileText className="w-4 h-4" />
            )}
            <span>{data?.total ?? 0} documents</span>
          </div>
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="flex items-center gap-2 px-4 py-2.5 bg-secondary text-secondary-foreground rounded-xl text-sm font-medium hover:bg-secondary/80 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isFetching ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>

        {/* Table */}
        <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/50 text-muted-foreground font-medium whitespace-nowrap">
                <tr>
                  <th className="px-4 sm:px-6 py-4">Document Title</th>
                  <th className="px-4 sm:px-6 py-4 hidden sm:table-cell">Type</th>
                  <th className="px-4 sm:px-6 py-4">Chunks</th>
                  <th className="px-4 sm:px-6 py-4 hidden md:table-cell">Last Updated</th>
                  <th className="px-4 sm:px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {isLoading ? (
                  <tr><td colSpan={5} className="p-12 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" /></td></tr>
                ) : data?.documents?.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-16 text-center text-muted-foreground">
                      <FileText className="w-10 h-10 mx-auto mb-3 opacity-30" />
                      <p className="font-medium">No documents indexed yet</p>
                      <p className="text-xs mt-1">Go to Dashboard and start a crawl to begin indexing.</p>
                    </td>
                  </tr>
                ) : (
                  data?.documents?.map((doc) => (
                    <tr key={doc.id} className="hover:bg-muted/30 transition-colors group">
                      <td className="px-4 sm:px-6 py-3.5 max-w-xs">
                        <div className="flex items-center gap-2.5">
                          <FileText className="w-4 h-4 text-primary shrink-0" />
                          <span className="font-medium text-foreground truncate block text-sm">{doc.title || 'Untitled Document'}</span>
                        </div>
                        <p className="text-xs text-muted-foreground truncate mt-0.5 pl-6 hidden sm:block">{doc.sourceUrl}</p>
                      </td>
                      <td className="px-4 sm:px-6 py-3.5 hidden sm:table-cell">
                        <span className="px-2 py-1 bg-secondary rounded-md text-xs font-medium text-secondary-foreground">
                          {doc.contentType}
                        </span>
                      </td>
                      <td className="px-4 sm:px-6 py-3.5">
                        <span className="inline-flex items-center justify-center min-w-[2rem] h-7 px-2 rounded-full bg-primary/10 text-primary font-bold text-xs">
                          {doc.chunkCount}
                        </span>
                      </td>
                      <td className="px-4 sm:px-6 py-3.5 text-muted-foreground text-xs whitespace-nowrap hidden md:table-cell">
                        {formatDate(doc.updatedAt || doc.createdAt)}
                      </td>
                      <td className="px-4 sm:px-6 py-3.5">
                        <div className="flex items-center justify-end gap-1">
                          <a 
                            href={doc.sourceUrl} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="p-1.5 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
                            title="Open original URL"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </a>
                          <button
                            onClick={() => handleDelete(doc.id, doc.title)}
                            disabled={isDeleting}
                            className="p-1.5 text-destructive/60 hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                            title="Delete document"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          
          {/* Pagination */}
          {data && data.total > data.limit && (
            <div className="p-4 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-3 bg-card">
              <span className="text-sm text-muted-foreground text-center sm:text-left">
                Page {page} of {totalPages} · {data.total} total documents
              </span>
              <div className="flex gap-2">
                <button 
                  disabled={page === 1}
                  onClick={() => setPage(1)}
                  className="px-3 py-1.5 border border-border rounded-lg text-xs font-medium hover:bg-muted disabled:opacity-50 transition-colors"
                >First</button>
                <button 
                  disabled={page === 1}
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  className="px-4 py-1.5 border border-border rounded-lg text-sm font-medium hover:bg-muted disabled:opacity-50 transition-colors"
                >Previous</button>
                <button 
                  disabled={page >= totalPages}
                  onClick={() => setPage(p => p + 1)}
                  className="px-4 py-1.5 border border-border rounded-lg text-sm font-medium hover:bg-muted disabled:opacity-50 transition-colors"
                >Next</button>
                <button 
                  disabled={page >= totalPages}
                  onClick={() => setPage(totalPages)}
                  className="px-3 py-1.5 border border-border rounded-lg text-xs font-medium hover:bg-muted disabled:opacity-50 transition-colors"
                >Last</button>
              </div>
            </div>
          )}
        </div>

      </div>
    </AdminLayout>
  );
}
