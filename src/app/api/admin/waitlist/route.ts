import { connection } from "next/server";
import { NotFoundError } from "@/lib/errors";
import { route } from "@/lib/http";
import { getAdminActor } from "@/modules/auth/session";
import { exportWaitlistCsv } from "@/modules/waitlist/waitlist.service";

/** Spreadsheet download of the early-access list. Admins only; everyone else gets 404. */
export const GET = route(async () => {
  await connection();
  const actor = await getAdminActor();
  if (!actor) throw new NotFoundError();
  const csv = await exportWaitlistCsv(actor);
  const date = new Date().toISOString().slice(0, 10);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="shaadifund-waitlist-${date}.csv"`,
      "Cache-Control": "no-store",
    },
  });
});
