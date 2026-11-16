import type { Metadata } from "next";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/couple/app-shell";
import { formatDateTime } from "@/lib/format";
import { getAuditLogs } from "@/modules/admin/admin.service";
import { requireAdminOrNotFound } from "@/modules/auth/session";
import { AdminHeading, EmptyRow, OlderLink, Table, Td } from "../admin-ui";

type Props = { searchParams: Promise<{ cursor?: string }> };

export const metadata: Metadata = { title: "Audit log" };

async function Audit({ searchParams }: Props) {
  const actor = await requireAdminOrNotFound();
  const { cursor } = await searchParams;
  const page = await getAuditLogs(actor, cursor);

  return (
    <>
      <Table head={["When", "Who", "Action", "On", "Details"]}>
        {page.items.length === 0 ? (
          <EmptyRow columns={5}>Nothing recorded yet.</EmptyRow>
        ) : (
          page.items.map((entry) => (
            <tr key={entry.id}>
              <Td className="whitespace-nowrap">{formatDateTime(entry.createdAt)}</Td>
              <Td>{entry.actor?.email ?? entry.actorType}</Td>
              <Td className="font-medium">{entry.action}</Td>
              <Td>
                <span className="block">{entry.entityType}</span>
                <span className="text-muted-foreground text-xs break-all">{entry.entityId}</span>
              </Td>
              <Td className="text-xs break-all">
                {entry.metadata ? JSON.stringify(entry.metadata) : ""}
              </Td>
            </tr>
          ))
        )}
      </Table>
      <OlderLink href={page.nextCursor ? `/admin/audit?cursor=${page.nextCursor}` : null} />
    </>
  );
}

export default function AdminAuditPage({ searchParams }: Props) {
  return (
    <>
      <AdminHeading title="Audit log" />
      <Suspense fallback={<PageSkeleton />}>
        <Audit searchParams={searchParams} />
      </Suspense>
    </>
  );
}
