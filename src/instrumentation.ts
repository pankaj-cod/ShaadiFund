import { getEnv } from "@/lib/env";

/** Runs once when the server starts: fail fast on a bad environment. */
export function register(): void {
  getEnv();
}
