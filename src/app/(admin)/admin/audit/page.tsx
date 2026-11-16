import { NotFoundMessage } from "@/components/not-found-message";
import type { Metadata } from "next";
import { Suspense } from "react";
import { formatDateTime } from "@/lib/format";
import { getAuditLogs } from "@/modules/admin/admin.service";
import { getAdminActor } from "@/modules/auth/session";
import { AdminFrame, AdminHeading, EmptyRow, OlderLink, Table, Td } from "../admin-ui";

type Props = { searchParams: Promise<{ cursor?: string }> };

export const metadata: Metadata = { title: "Audit log" };

async function Audit({ searchParams }: Props) {
  const actor = await getAdminActor();
  if (!actor) return <NotFoundMessage />;
  const { cursor } = await searchParams;
  const page = await getAuditLogs(actor, cursor);

  return (
    <AdminFrame>
      <AdminHeading title="Audit log" />
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
    </AdminFrame>
  );
}

export default function AdminAuditPage({ searchParams }: Props) {
  return (
    <Suspense fallback={<div className="flex-1" aria-busy="true" />}>
      <Audit searchParams={searchParams} />
    </Suspense>
  );
}
