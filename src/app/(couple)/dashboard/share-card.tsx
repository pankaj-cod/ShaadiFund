"use client";

import { Check, Copy, ExternalLink, Loader2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { publishWeddingAction, unpublishWeddingAction } from "@/app/(couple)/actions";
import { FormMessage } from "@/components/forms/field";
import { Button } from "@/components/ui/button";
import type { WeddingDTO } from "@/modules/wedding/wedding.types";

const STATUS_COPY: Record<WeddingDTO["status"], { label: string; detail: string }> = {
  DRAFT: { label: "Draft", detail: "Only you can see your page." },
  PUBLISHED: { label: "Live", detail: "Anyone with the link can see your page." },
  UNPUBLISHED: { label: "Hidden", detail: "Your page is hidden from guests." },
  SUSPENDED: { label: "Paused", detail: "VowFund has paused this page. Please contact support." },
};

export function ShareCard({ wedding, appUrl }: { wedding: WeddingDTO; appUrl: string }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const url = `${appUrl}/wedding/${wedding.slug}`;
  const live = wedding.status === "PUBLISHED";
  const status = STATUS_COPY[wedding.status];

  async function toggle() {
    setPending(true);
    setError(null);
    const result = live ? await unpublishWeddingAction() : await publishWeddingAction();
    setPending(false);
    if (!result.ok) setError(result.message);
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("We could not copy the link. Please select and copy it yourself.");
    }
  }

  return (
    <section className="bg-card shadow-soft rounded-xl border p-6" aria-labelledby="share-heading">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="share-heading" className="text-h3">
          Your wedding page
        </h2>
        <span
          className={`rounded-full px-3 py-1 text-xs font-semibold ${
            live ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"
          }`}
        >
          {status.label}
        </span>
      </div>
      <p className="text-muted-foreground mt-1 text-sm">{status.detail}</p>

      <p
        className="bg-muted mt-5 rounded-md px-3.5 py-2.5 text-sm break-all"
        data-testid="share-url"
      >
        {url}
      </p>

      <div className="mt-4 flex flex-wrap gap-3">
        <Button type="button" variant="outline" onClick={copy}>
          {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
          {copied ? "Copied" : "Copy link"}
        </Button>
        <Button asChild variant="outline">
          <Link href={live ? `/wedding/${wedding.slug}` : "/dashboard/preview"} target="_blank">
            <ExternalLink aria-hidden="true" />
            {live ? "View page" : "Preview"}
          </Link>
        </Button>
        {wedding.status !== "SUSPENDED" ? (
          <Button
            type="button"
            variant={live ? "ghost" : "default"}
            disabled={pending}
            onClick={toggle}
          >
            {pending ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
            {live ? "Unpublish" : "Publish"}
          </Button>
        ) : null}
      </div>
      {error ? (
        <div className="mt-4">
          <FormMessage tone="error">{error}</FormMessage>
        </div>
      ) : null}
    </section>
  );
}
