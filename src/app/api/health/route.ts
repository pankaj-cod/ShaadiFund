import { connection } from "next/server";
import { getDb } from "@/lib/db";
import { getEnv } from "@/lib/env";
import { ok, route } from "@/lib/http";

/** Liveness and database check for uptime monitoring and deploy verification. */
export const GET = route(async () => {
  await connection();
  await getDb().$queryRaw`SELECT 1`;
  return ok({ status: "ok", paymentsMode: getEnv().PAYMENTS_MODE });
});
