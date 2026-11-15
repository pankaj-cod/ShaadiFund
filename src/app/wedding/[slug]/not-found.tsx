import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function WeddingNotFound() {
  return (
    <main className="flex flex-1 items-center justify-center px-6 py-24 text-center">
      <div className="max-w-prose">
        <p className="eyebrow">VowFund</p>
        <h1 className="text-h1 mt-5">We could not find that wedding page</h1>
        <p className="text-muted-foreground mt-4">
          The link may be mistyped, or the couple may not have published their page yet. Please
          check the link they sent you.
        </p>
        <Button asChild size="lg" variant="outline" className="mt-8">
          <Link href="/">Go to VowFund</Link>
        </Button>
      </div>
    </main>
  );
}
