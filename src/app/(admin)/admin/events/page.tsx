import { NotFoundMessage } from "@/components/not-found-message";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { formatDateTime } from "@/lib/format";
import { getPaymentEvents } from "@/modules/admin/admin.service";
import { getAdminActor } from "@/modules/auth/session";
import { AdminFrame, AdminHeading, Badge, EmptyRow, FilterLinks, Table, Td } from "../admin-ui";

type Props = { searchParams: Promise<{ status?: string }> };

export const metadata: Metadata = { title: "Webhook events" };

async function Events({ searchParams }: Props) {
  const actor = await getAdminActor();
  if (!actor) return <NotFoundMessage />;
  const { status } = await searchParams;
  const events = await getPaymentEvents(actor, { status });

  return (
    <AdminFrame>
      <AdminHeading title="Webhook events" />
      <div className="mb-4">
        <FilterLinks
          base="/admin/events"
          param="status"
          current={status}
          options={[
            { value: null, label: "All" },
            { value: "FAILED", label: "Failed" },
            { value: "PROCESSED", label: "Processed" },
            { value: "IGNORED", label: "Ignored" },
            { value: "RECEIVED", label: "Stuck" },
          ]}
        />
      </div>
      <Table head={["Received", "Provider", "Event", "Result", "Error", "Payment"]}>
        {events.length === 0 ? (
          <EmptyRow columns={6}>No webhook events match.</EmptyRow>
        ) : (
          events.map((event) => (
            <tr key={event.id}>
              <Td className="whitespace-nowrap">{formatDateTime(event.receivedAt)}</Td>
              <Td>{event.provider}</Td>
              <Td>
                <span className="block">{event.eventType}</span>
                <span className="text-muted-foreground text-xs break-all">
                  {event.providerEventId}
                </span>
              </Td>
              <Td>
                <Badge>{event.status}</Badge>
              </Td>
              <Td>{event.error ?? ""}</Td>
              <Td>
                {event.paymentId ? (
                  <Link
                    href={`/admin/payments/${event.paymentId}`}
                    className="underline underline-offset-4"
                  >
                    Open
                  </Link>
                ) : (
                  ""
                )}
              </Td>
            </tr>
          ))
        )}
      </Table>
      <p className="text-muted-foreground mt-4 text-sm">
        Showing the latest 100. A failed event is retried by the provider, and the scheduled
        reconciliation job independently recovers any payment that was actually made.
      </p>
    </AdminFrame>
  );
}

export default function AdminEventsPage({ searchParams }: Props) {
  return (
    <Suspense fallback={<div className="flex-1" aria-busy="true" />}>
      <Events searchParams={searchParams} />
    </Suspense>
  );
}
