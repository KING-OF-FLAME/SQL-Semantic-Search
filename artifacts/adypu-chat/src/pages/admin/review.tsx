import { useState } from "react";
import { AdminLayout } from "@/components/layout/admin-layout";
import { useAdminLowConfidenceQuestions } from "@/hooks/use-admin-api";
import { MessageSquareWarning, Loader2, Tag } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { ConfidenceBadge } from "@/components/ui/confidence-badge";

export default function AdminReview() {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useAdminLowConfidenceQuestions({ page, limit: 15 });

  return (
    <AdminLayout>
      <div className="space-y-6">
        
        <div className="bg-orange-500/10 border border-orange-500/20 text-orange-700 dark:text-orange-400 p-4 rounded-xl flex items-start gap-3">
          <MessageSquareWarning className="w-5 h-5 shrink-0 mt-0.5" />
          <div>
            <h4 className="font-semibold">Review Required</h4>
            <p className="text-sm mt-1 opacity-90">
              These queries resulted in low confidence scores. You may need to add new documents to the crawl sources to cover these topics, or update existing pages on the university website.
            </p>
          </div>
        </div>

        <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/50 text-muted-foreground font-medium whitespace-nowrap">
                <tr>
                  <th className="px-6 py-4">User Query</th>
                  <th className="px-6 py-4">Detected Intent</th>
                  <th className="px-6 py-4">Confidence</th>
                  <th className="px-6 py-4">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {isLoading ? (
                  <tr><td colSpan={4} className="p-12 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" /></td></tr>
                ) : data?.questions?.length === 0 ? (
                  <tr><td colSpan={4} className="px-6 py-12 text-center text-muted-foreground">Great! No low-confidence queries found.</td></tr>
                ) : (
                  data?.questions?.map((q) => (
                    <tr key={q.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-6 py-4 max-w-md">
                        <p className="font-medium text-foreground truncate" title={q.question}>{q.question}</p>
                      </td>
                      <td className="px-6 py-4">
                        {q.intent ? (
                          <div className="flex items-center gap-1.5 text-muted-foreground bg-muted px-2.5 py-1 rounded-md w-fit text-xs font-semibold uppercase">
                            <Tag className="w-3 h-3" />
                            {q.intent}
                          </div>
                        ) : (
                          <span className="text-muted-foreground italic">Unknown</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <ConfidenceBadge label={q.confidenceLabel} score={q.confidenceScore} />
                      </td>
                      <td className="px-6 py-4 text-muted-foreground whitespace-nowrap">
                        {formatDate(q.createdAt)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          
          {/* Pagination */}
          {data && data.total > data.limit && (
            <div className="p-4 border-t border-border flex items-center justify-between bg-card mt-auto">
              <span className="text-sm text-muted-foreground">
                Showing {(page - 1) * data.limit + 1} to Math.min(page * data.limit, data.total) of {data.total}
              </span>
              <div className="flex gap-2">
                <button 
                  disabled={page === 1}
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  className="px-4 py-2 border border-border rounded-lg text-sm font-medium hover:bg-muted disabled:opacity-50 transition-colors"
                >
                  Previous
                </button>
                <button 
                  disabled={page * data.limit >= data.total}
                  onClick={() => setPage(p => p + 1)}
                  className="px-4 py-2 border border-border rounded-lg text-sm font-medium hover:bg-muted disabled:opacity-50 transition-colors"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>

      </div>
    </AdminLayout>
  );
}
