import type { Metadata } from "next";
import { Suspense } from "react";
import { NotFoundMessage } from "@/components/not-found-message";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/format";
import { getAdminActor } from "@/modules/auth/session";
import { WAITLIST_ROLE_LABELS, WAITLIST_ROLES } from "@/modules/waitlist/waitlist.schema";
import { getWaitlist } from "@/modules/waitlist/waitlist.service";
import { AdminFrame, AdminHeading, EmptyRow, OlderLink, Table, Td } from "../admin-ui";

type Props = { searchParams: Promise<{ cursor?: string }> };

export const metadata: Metadata = { title: "Waitlist" };

async function Waitlist({ searchParams }: Props) {
  const actor = await getAdminActor();
  if (!actor) return <NotFoundMessage />;
  const { cursor } = await searchParams;
  const page = await getWaitlist(actor, cursor);

  return (
    <AdminFrame>
      <AdminHeading title="Waitlist">
        {page.total > 0 ? (
          <Button asChild variant="outline">
            {/* A plain link: the file is a download, not a page. */}
            <a href="/api/admin/waitlist" download>
              Download spreadsheet (CSV)
            </a>
          </Button>
        ) : null}
      </AdminHeading>

      <dl className="mb-8 grid gap-4 sm:grid-cols-5">
        <div className="bg-card rounded-lg border p-4">
          <dt className="text-muted-foreground text-sm">Everyone</dt>
          <dd className="font-heading mt-1 text-3xl" data-testid="waitlist-total">
            {page.total}
          </dd>
        </div>
        {WAITLIST_ROLES.map((role) => (
          <div key={role} className="bg-card rounded-lg border p-4">
            <dt className="text-muted-foreground text-sm">{WAITLIST_ROLE_LABELS[role]}</dt>
            <dd className="font-heading mt-1 text-3xl">{page.byRole[role] ?? 0}</dd>
          </div>
        ))}
      </dl>

      <Table head={["Joined", "Email", "Name", "Who", "Wedding month", "City", "Source"]}>
        {page.items.length === 0 ? (
          <EmptyRow columns={7}>Nobody has joined yet.</EmptyRow>
        ) : (
          page.items.map((entry) => (
            <tr key={entry.id}>
              <Td className="whitespace-nowrap">{formatDateTime(entry.createdAt)}</Td>
              <Td className="break-all">{entry.email}</Td>
              <Td>{entry.name ?? ""}</Td>
              <Td>{WAITLIST_ROLE_LABELS[entry.role]}</Td>
              <Td>{entry.weddingMonth ?? ""}</Td>
              <Td>{entry.city ?? ""}</Td>
              <Td>{entry.source}</Td>
            </tr>
          ))
        )}
      </Table>
      <OlderLink href={page.nextCursor ? `/admin/waitlist?cursor=${page.nextCursor}` : null} />
    </AdminFrame>
  );
}

export default function AdminWaitlistPage({ searchParams }: Props) {
  return (
    <Suspense fallback={<div className="flex-1" aria-busy="true" />}>
      <Waitlist searchParams={searchParams} />
    </Suspense>
  );
}
