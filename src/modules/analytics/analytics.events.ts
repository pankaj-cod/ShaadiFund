/** Every product event we record. Names are stable: dashboards depend on them. */
export const ANALYTICS_EVENTS = [
  "user_registered",
  "wedding_created",
  "wishlist_created",
  "onboarding_completed",
  "wedding_published",
  "wedding_page_viewed",
  "dream_selected",
  "checkout_initiated",
  "guest_message_submitted",
  "contribution_succeeded",
  "payment_failed",
  "waitlist_joined",
] as const;
export type AnalyticsEvent = (typeof ANALYTICS_EVENTS)[number];

/** The only events a browser may report. Everything else is recorded by the server itself. */
export const BROWSER_EVENTS = ["wedding_page_viewed", "dream_selected"] as const;
export type BrowserEvent = (typeof BROWSER_EVENTS)[number];
