import { NotFoundMessage } from "@/components/not-found-message";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { coupleNames, formatDateTime } from "@/lib/format";
import { formatPaise } from "@/lib/money";
import { getCouples } from "@/modules/admin/admin.service";
import { getAdminActor } from "@/modules/auth/session";
import { AdminFrame, AdminHeading, Badge, EmptyRow, OlderLink, Table, Td } from "../admin-ui";
import { WeddingActions } from "./wedding-actions";

type Props = { searchParams: Promise<{ cursor?: string }> };

export const metadata: Metadata = { title: "Couples" };

async function Couples({ searchParams }: Props) {
  const actor = await getAdminActor();
  if (!actor) return <NotFoundMessage />;
  const { cursor } = await searchParams;
  const page = await getCouples(actor, cursor);

  return (
    <AdminFrame>
      <AdminHeading title="Couples" />
      <Table head={["Couple", "Sign-in email", "Page", "Dreams", "Raised", "Joined", ""]}>
        {page.items.length === 0 ? (
          <EmptyRow columns={7}>No couples yet.</EmptyRow>
        ) : (
          page.items.map((couple) => (
            <tr key={couple.id}>
              <Td className="font-medium">
                {coupleNames(couple.partnerOneName, couple.partnerTwoName)}
              </Td>
              <Td>{couple.emails.join(", ")}</Td>
              <Td>
                {couple.wedding ? (
                  <span className="grid gap-1">
                    <Badge>{couple.wedding.status}</Badge>
                    {couple.wedding.status === "PUBLISHED" ? (
                      <Link
                        href={`/wedding/${couple.wedding.slug}`}
                        className="underline underline-offset-4"
                      >
                        {couple.wedding.slug}
                      </Link>
                    ) : (
                      <span className="text-muted-foreground">{couple.wedding.slug}</span>
                    )}
                  </span>
                ) : (
                  <span className="text-muted-foreground">Not started</span>
                )}
              </Td>
              <Td className="tabular-nums">{couple.wedding?.dreamCount ?? 0}</Td>
              <Td className="tabular-nums">{formatPaise(couple.wedding?.raisedPaise ?? 0)}</Td>
              <Td className="whitespace-nowrap">{formatDateTime(couple.createdAt)}</Td>
              <Td>
                {couple.wedding ? (
                  <WeddingActions
                    weddingId={couple.wedding.id}
                    suspended={couple.wedding.status === "SUSPENDED"}
                  />
                ) : null}
              </Td>
            </tr>
          ))
        )}
      </Table>
      <OlderLink href={page.nextCursor ? `/admin/couples?cursor=${page.nextCursor}` : null} />
    </AdminFrame>
  );
}

export default function AdminCouplesPage({ searchParams }: Props) {
  return (
    <Suspense fallback={<div className="flex-1" aria-busy="true" />}>
      <Couples searchParams={searchParams} />
    </Suspense>
  );
}
