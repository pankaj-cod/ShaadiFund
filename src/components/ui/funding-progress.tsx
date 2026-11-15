import { cn } from "@/lib/utils";
import { formatPaise, fundingPercent } from "@/lib/money";

interface FundingProgressProps {
  fundedPaise: number;
  targetPaise: number;
  /** Used by screen readers, e.g. the dream's title. */
  label: string;
  className?: string;
}

/** Progress towards a dream. The bar caps at 100%; the amounts always show the truth. */
export function FundingProgress({
  fundedPaise,
  targetPaise,
  label,
  className,
}: FundingProgressProps) {
  const percent = fundingPercent(fundedPaise, targetPaise);

  return (
    <div className={cn("space-y-2", className)}>
      <div
        role="progressbar"
        aria-label={`Funding progress for ${label}`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        aria-valuetext={`${formatPaise(fundedPaise)} of ${formatPaise(targetPaise)}`}
        className="bg-accent h-1.5 w-full overflow-hidden rounded-full"
      >
        <div
          className="bg-gold h-full rounded-full transition-[width] duration-700 ease-out"
          style={{ width: `${percent}%` }}
        />
      </div>
      <div className="flex items-baseline justify-between gap-4 text-sm">
        <span className="text-foreground font-medium">
          {formatPaise(fundedPaise)}{" "}
          <span className="text-muted-foreground font-normal">of {formatPaise(targetPaise)}</span>
        </span>
        <span className="text-muted-foreground tabular-nums">{percent}%</span>
      </div>
    </div>
  );
}
