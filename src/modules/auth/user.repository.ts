import "server-only";
import { getDb, type Db } from "@/lib/db";

/** The user's role, read from the database every time it matters. */
export async function findUserRole(
  userId: string,
  db: Db = getDb(),
): Promise<"COUPLE" | "ADMIN" | null> {
  const user = await db.user.findUnique({ where: { id: userId }, select: { role: true } });
  return user?.role ?? null;
}
