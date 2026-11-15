"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const POLL_MS = 2500;
const GIVE_UP_AFTER = 24;

/** Waits for the provider's confirmation, then reloads the page into its final state. */
export function GiftPending({ contributionId, token }: { contributionId: string; token: string }) {
  const router = useRouter();
  const [gaveUp, setGaveUp] = useState(false);

  useEffect(() => {
    let attempts = 0;
    const timer = setInterval(async () => {
      attempts += 1;
      try {
        const response = await fetch(
          `/api/contributions/${contributionId}/status?token=${encodeURIComponent(token)}`,
          { cache: "no-store" },
        );
        const json = (await response.json()) as { data?: { status: string } };
        if (json.data && json.data.status !== "PENDING") {
          clearInterval(timer);
          router.refresh();
          return;
        }
      } catch {
        // A dropped request is fine; the next tick tries again.
      }
      if (attempts >= GIVE_UP_AFTER) {
        clearInterval(timer);
        setGaveUp(true);
      }
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [contributionId, token, router]);

  return (
    <div role="status" className="text-center">
      {gaveUp ? null : (
        <Loader2 className="text-gold-ink mx-auto size-8 animate-spin" aria-hidden="true" />
      )}
      <h1 className="text-h2 mt-5">
        {gaveUp ? "We have not received confirmation yet" : "Confirming your payment…"}
      </h1>
      <p className="text-muted-foreground mx-auto mt-3 max-w-sm">
        {gaveUp
          ? "If you completed the payment, it will appear here once the bank confirms it. You can safely close this page; we will email you. If you did not pay, nothing was charged."
          : "This usually takes a few seconds. Please keep this page open."}
      </p>
    </div>
  );
}
