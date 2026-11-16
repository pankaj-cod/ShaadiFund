import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { UnauthenticatedError } from "@/lib/errors";
import { getAuth } from "./auth";
import { findUserRole } from "./user.repository";

/** The signed-in person performing an action. Passed to every service function. */
export interface Actor {
  userId: string;
  email: string;
}

/** The current signed-in user, or null. Reads the session cookie, so call inside Suspense. */
export async function getActor(): Promise<Actor | null> {
  const session = await getAuth().api.getSession({ headers: await headers() });
  if (!session) return null;
  return { userId: session.user.id, email: session.user.email };
}

/** For pages: sends visitors who are not signed in to the sign-in screen. */
export async function requireActorOrRedirect(): Promise<Actor> {
  const actor = await getActor();
  if (!actor) redirect("/sign-in");
  return actor;
}

/** For server actions and API routes: fails with a 401-style error. */
export async function requireActor(): Promise<Actor> {
  const actor = await getActor();
  if (!actor) throw new UnauthenticatedError();
  return actor;
}

/**
 * For admin pages: the signed-in admin, or null. A page that gets null shows the
 * ordinary "not found" message, so the admin area's existence is not
 * advertised. The admin services check the role again on every call.
 */
export async function getAdminActor(): Promise<Actor | null> {
  const actor = await getActor();
  if (!actor || (await findUserRole(actor.userId)) !== "ADMIN") return null;
  return actor;
}
