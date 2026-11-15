"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { FormMessage } from "@/components/forms/field";
import { Button } from "@/components/ui/button";

interface Callback {
  providerOrderId: string;
  providerPaymentId: string;
  signature: string;
}

/** Stands in for the payment provider's own checkout window in demo mode. */
export function MockCheckout({
  contributionId,
  token,
  total,
}: {
  contributionId: string;
  token: string;
  total: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState<"captured" | "failed" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function pay(outcome: "captured" | "failed") {
    setPending(outcome);
    setError(null);
    try {
      // 1. The "provider" takes the payment and returns a signed result to the browser.
      const paid = await fetch("/api/mock-provider/pay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contributionId, token, outcome }),
      });
      const paidJson = (await paid.json()) as { data?: Callback; error?: { message: string } };
      if (!paid.ok || !paidJson.data) throw new Error(paidJson.error?.message);

      // 2. Our server verifies that result. The browser's word alone is never enough.
      const verified = await fetch(`/api/contributions/${contributionId}/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, ...paidJson.data }),
      });
      if (!verified.ok) {
        const json = (await verified.json().catch(() => null)) as {
          error?: { message: string };
        } | null;
        throw new Error(json?.error?.message);
      }
      router.push(`/gift/${token}`);
    } catch (caught) {
      setError(
        caught instanceof Error && caught.message
          ? caught.message
          : "Something went wrong with the demo payment. Please try again.",
      );
      setPending(null);
    }
  }

  return (
    <div className="grid gap-4">
      <Button
        size="lg"
        className="h-12 text-base"
        disabled={pending !== null}
        onClick={() => pay("captured")}
      >
        {pending === "captured" ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
        Simulate a successful payment of {total}
      </Button>
      <Button size="lg" variant="outline" disabled={pending !== null} onClick={() => pay("failed")}>
        {pending === "failed" ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
        Simulate a failed payment
      </Button>
      {error ? <FormMessage tone="error">{error}</FormMessage> : null}
    </div>
  );
}
