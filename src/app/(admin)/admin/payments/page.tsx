import { NotFoundMessage } from "@/components/not-found-message";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { formatDateTime } from "@/lib/format";
import { formatPaise } from "@/lib/money";
import { getPayments } from "@/modules/admin/admin.service";
import { getAdminActor } from "@/modules/auth/session";
import {
  AdminFrame,
  AdminHeading,
  Badge,
  EmptyRow,
  FilterLinks,
  OlderLink,
  Table,
  Td,
} from "../admin-ui";

type Props = { searchParams: Promise<{ status?: string; cursor?: string }> };

export const metadata: Metadata = { title: "Payments" };

const STATUS_FILTERS = [
  { value: null, label: "All" },
  { value: "CAPTURED", label: "Captured" },
  { value: "FAILED", label: "Failed" },
  { value: "CREATED", label: "Not completed" },
  { value: "REFUNDED", label: "Refunded" },
];

async function Payments({ searchParams }: Props) {
  const actor = await getAdminActor();
  if (!actor) return <NotFoundMessage />;
  const { status, cursor } = await searchParams;
  const page = await getPayments(actor, { status }, cursor);
  const older = page.nextCursor
    ? `/admin/payments?${status ? `status=${status}&` : ""}cursor=${page.nextCursor}`
    : null;

  return (
    <AdminFrame>
      <AdminHeading title="Payments" />
      <div className="mb-4">
        <FilterLinks
          base="/admin/payments"
          param="status"
          current={status}
          options={STATUS_FILTERS}
        />
      </div>
      <Table head={["When", "Status", "Mode", "Guest", "Wedding and dream", "Paid", ""]}>
        {page.items.length === 0 ? (
          <EmptyRow columns={7}>No payments match.</EmptyRow>
        ) : (
          page.items.map((payment) => (
            <tr key={payment.id}>
              <Td className="whitespace-nowrap">{formatDateTime(payment.createdAt)}</Td>
              <Td>
                <Badge>{payment.status}</Badge>
              </Td>
              <Td>
                {payment.provider} · {payment.mode}
              </Td>
              <Td>
                <span className="block font-medium">{payment.contribution.guestName}</span>
                <span className="text-muted-foreground">{payment.contribution.guestEmail}</span>
              </Td>
              <Td>
                <span className="block">{payment.contribution.wedding.slug}</span>
                <span className="text-muted-foreground">{payment.contribution.dream.title}</span>
              </Td>
              <Td className="tabular-nums">{formatPaise(payment.amountPaise)}</Td>
              <Td>
                <Link
                  href={`/admin/payments/${payment.id}`}
                  className="underline underline-offset-4"
                >
                  Details
                </Link>
              </Td>
            </tr>
          ))
        )}
      </Table>
      <OlderLink href={older} />
    </AdminFrame>
  );
}

export default function AdminPaymentsPage({ searchParams }: Props) {
  return (
    <Suspense fallback={<div className="flex-1" aria-busy="true" />}>
      <Payments searchParams={searchParams} />
    </Suspense>
  );
}
