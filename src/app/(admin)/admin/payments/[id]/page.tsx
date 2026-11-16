import { NotFoundMessage } from "@/components/not-found-message";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { formatDateTime } from "@/lib/format";
import { formatPaise } from "@/lib/money";
import { getPayment } from "@/modules/admin/admin.service";
import { getAdminActor } from "@/modules/auth/session";
import { AdminFrame, AdminHeading, Badge, EmptyRow, Table, Td } from "../../admin-ui";
import { RefundButton } from "./refund-button";

type Props = { params: Promise<{ id: string }> };

export const metadata: Metadata = { title: "Payment" };

async function Payment({ params }: Props) {
  const actor = await getAdminActor();
  if (!actor) return <NotFoundMessage />;
  const { id } = await params;
  const payment = await getPayment(actor, id);
  if (!payment) return <NotFoundMessage />;
  const { contribution } = payment;

  const facts: [string, string][] = [
    ["Guest", `${contribution.guestName} (${contribution.guestEmail})`],
    ["Wedding", contribution.wedding.slug],
    ["Dream", contribution.dream.title],
    ["Gift", formatPaise(contribution.amountPaise)],
    ["Total paid", formatPaise(payment.amountPaise)],
    ["Refunded", formatPaise(payment.refundedPaise)],
    ["Provider and mode", `${payment.provider} · ${payment.mode}`],
    ["Method", payment.method ?? "Not known"],
    ["Provider order", payment.providerOrderId],
    ["Provider payment", payment.providerPaymentId ?? "None yet"],
    ["Started", formatDateTime(payment.createdAt)],
    ["Captured", payment.capturedAt ? formatDateTime(payment.capturedAt) : "Not captured"],
  ];
  if (payment.failureReason) {
    facts.push(["Last failure", `${payment.failureCode ?? ""} ${payment.failureReason}`.trim()]);
  }

  return (
    <AdminFrame>
      <Link
        href="/admin/payments"
        className="text-muted-foreground text-sm underline-offset-4 hover:underline"
      >
        All payments
      </Link>
      <div className="mt-3">
        <AdminHeading title="Payment" />
      </div>
      <div className="mb-6 flex flex-wrap items-center gap-4">
        <Badge>{payment.status}</Badge>
        {payment.status === "CAPTURED" ? (
          <RefundButton paymentId={payment.id} amount={formatPaise(payment.amountPaise)} />
        ) : null}
      </div>

      <dl className="bg-card grid divide-y rounded-lg border text-sm sm:grid-cols-2 sm:divide-y-0">
        {facts.map(([term, value]) => (
          <div key={term} className="flex justify-between gap-6 px-4 py-3 sm:border-b">
            <dt className="text-muted-foreground shrink-0">{term}</dt>
            <dd className="text-right break-all">{value}</dd>
          </div>
        ))}
      </dl>

      <h2 className="text-h3 mt-10 mb-4">Status history</h2>
      <Table head={["When", "From", "To", "Source", "Note"]}>
        {payment.transitions.map((transition) => (
          <tr key={transition.id}>
            <Td className="whitespace-nowrap">{formatDateTime(transition.createdAt)}</Td>
            <Td>{transition.fromStatus ?? "New"}</Td>
            <Td>
              <Badge>{transition.toStatus}</Badge>
            </Td>
            <Td>{transition.source}</Td>
            <Td>{transition.note ?? ""}</Td>
          </tr>
        ))}
      </Table>

      <h2 className="text-h3 mt-10 mb-4">Webhook events</h2>
      <Table head={["Received", "Event", "Result", "Error"]}>
        {payment.events.length === 0 ? (
          <EmptyRow columns={4}>No webhook events for this payment.</EmptyRow>
        ) : (
          payment.events.map((event) => (
            <tr key={event.id}>
              <Td className="whitespace-nowrap">{formatDateTime(event.receivedAt)}</Td>
              <Td>{event.eventType}</Td>
              <Td>
                <Badge>{event.status}</Badge>
              </Td>
              <Td>{event.error ?? ""}</Td>
            </tr>
          ))
        )}
      </Table>

      <h2 className="text-h3 mt-10 mb-4">Refunds</h2>
      <Table head={["When", "Amount", "Status", "Reason", "Provider refund"]}>
        {payment.refunds.length === 0 ? (
          <EmptyRow columns={5}>No refunds.</EmptyRow>
        ) : (
          payment.refunds.map((refund) => (
            <tr key={refund.id}>
              <Td className="whitespace-nowrap">{formatDateTime(refund.createdAt)}</Td>
              <Td className="tabular-nums">{formatPaise(refund.amountPaise)}</Td>
              <Td>
                <Badge>{refund.status}</Badge>
              </Td>
              <Td>{refund.reason}</Td>
              <Td className="break-all">{refund.providerRefundId ?? ""}</Td>
            </tr>
          ))
        )}
      </Table>
    </AdminFrame>
  );
}

export default function AdminPaymentPage({ params }: Props) {
  return (
    <Suspense fallback={<div className="flex-1" aria-busy="true" />}>
      <Payment params={params} />
    </Suspense>
  );
}
