"use client";

import { useEffect } from "react";
import type { BrowserEvent } from "@/modules/analytics/analytics.events";

/** Reports one page view. Sends no cookies-based identity and nothing about the visitor. */
export function TrackView({
  name,
  slug,
  dreamId,
}: {
  name: BrowserEvent;
  slug: string;
  dreamId?: string;
}) {
  useEffect(() => {
    void fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, slug, dreamId }),
      keepalive: true,
    }).catch(() => {
      // A lost analytics event is not worth telling the visitor about.
    });
  }, [name, slug, dreamId]);
  return null;
}
