import DOMPurify from "isomorphic-dompurify";
import { FileText, ExternalLink } from "lucide-react";

interface CitationCardProps {
  title: string;
  url: string;
  excerpt: string;
  score: number;
}

export function CitationCard({ title, url, excerpt, score }: CitationCardProps) {
  // Sanitize the excerpt which might contain HTML highlights from search
  const cleanExcerpt = DOMPurify.sanitize(excerpt);

  return (
    <div className="group relative bg-card hover:bg-muted/30 border border-border/50 hover:border-border rounded-xl p-4 transition-all duration-300 shadow-sm hover:shadow-md">
      <div className="flex items-start justify-between gap-4 mb-2">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <div className="p-1.5 rounded-md bg-primary/10 text-primary">
            <FileText className="w-4 h-4" />
          </div>
          <h4 className="line-clamp-1">{title}</h4>
        </div>
        <div className="text-xs font-medium text-muted-foreground whitespace-nowrap bg-background border border-border px-2 py-0.5 rounded-full">
          Score: {score.toFixed(2)}
        </div>
      </div>
      
      <div 
        className="text-sm text-muted-foreground mb-3 prose prose-sm prose-p:my-1 prose-strong:text-foreground line-clamp-3"
        dangerouslySetInnerHTML={{ __html: cleanExcerpt }}
      />
      
      <a 
        href={url} 
        target="_blank" 
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
      >
        <span>View Source</span>
        <ExternalLink className="w-3 h-3" />
      </a>
    </div>
  );
}
