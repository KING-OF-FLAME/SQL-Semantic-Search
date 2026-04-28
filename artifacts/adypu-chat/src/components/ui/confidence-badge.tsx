import { cn } from "@/lib/utils";
import { CheckCircle2, AlertTriangle, AlertCircle } from "lucide-react";

interface ConfidenceBadgeProps {
  label: string;
  score: number;
  className?: string;
}

export function ConfidenceBadge({ label, score, className }: ConfidenceBadgeProps) {
  const isHigh = label.toLowerCase() === "high";
  const isMedium = label.toLowerCase() === "medium";
  const isLow = label.toLowerCase() === "low";

  return (
    <div 
      className={cn(
        "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border",
        isHigh && "bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20",
        isMedium && "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/20",
        isLow && "bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20",
        className
      )}
    >
      {isHigh && <CheckCircle2 className="w-3.5 h-3.5" />}
      {isMedium && <AlertTriangle className="w-3.5 h-3.5" />}
      {isLow && <AlertCircle className="w-3.5 h-3.5" />}
      <span>{label} Confidence</span>
      <span className="opacity-70 ml-1">({Math.round(score * 100)}%)</span>
    </div>
  );
}
