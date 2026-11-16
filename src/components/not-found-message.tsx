import Link from "next/link";
import { Button } from "@/components/ui/button";

/**
 * A "not found" screen rendered as ordinary content.
 *
 * Pages that discover something is missing after they have started streaming
 * return this instead of calling notFound(). The response status is 200 either
 * way once streaming has begun, and interrupting a render with notFound()
 * triggers a React development-mode error ("cannot have a negative time stamp").
 */
export function NotFoundMessage({
  title = "This page could not be found.",
  detail,
  homeLabel = "Go to VowFund",
}: {
  title?: string;
  detail?: string;
  homeLabel?: string;
}) {
  return (
    <div className="flex flex-1 items-center justify-center px-6 py-24 text-center">
      <div className="max-w-prose">
        <p className="eyebrow">VowFund</p>
        <h1 className="text-h1 mt-5">{title}</h1>
        {detail ? <p className="text-muted-foreground mt-4">{detail}</p> : null}
        <Button asChild size="lg" variant="outline" className="mt-8">
          <Link href="/">{homeLabel}</Link>
        </Button>
      </div>
    </div>
  );
}

export function WeddingNotFound() {
  return (
    <NotFoundMessage
      title="We could not find that wedding page"
      detail="The link may be mistyped, or the couple may not have published their page yet. Please check the link they sent you."
    />
  );
}
