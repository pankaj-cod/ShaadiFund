import { Suspense } from "react";
import { PageSkeleton } from "@/components/couple/app-shell";
import { formatPaise } from "@/lib/money";
import { getMetrics } from "@/modules/admin/admin.service";
import { requireAdminOrNotFound } from "@/modules/auth/session";
import { DREAM_CATEGORY_LABELS, type DreamCategory } from "@/modules/dream/dream.schema";
import { AdminHeading, EmptyRow, FilterLinks, Table, Td } from "./admin-ui";

type Props = { searchParams: Promise<{ mode?: string }> };

const percent = (value: number | null) =>
  value === null ? "No data yet" : `${(value * 100).toFixed(1)}%`;

async function Overview({ searchParams }: Props) {
  const actor = await requireAdminOrNotFound();
  const { mode: rawMode } = await searchParams;
  const mode = rawMode === "TEST" || rawMode === "LIVE" ? rawMode : null;
  const metrics = await getMetrics(actor, mode);

  const cards: [string, string, string][] = [
    ["Couples", String(metrics.couples), "Accounts that have started a wedding"],
    ["Published weddings", String(metrics.publishedWeddings), "Pages guests can see now"],
    ["Guests", String(metrics.guests), "Distinct people with a confirmed gift"],
    ["Successful contributions", String(metrics.contributions), "Confirmed and not refunded"],
    ["Contribution volume", formatPaise(metrics.volumePaise), "Gift amounts, excluding fees"],
    ["Platform fees", formatPaise(metrics.feesPaise), "Charged on confirmed gifts"],
    [
      "Checkout conversion",
      percent(metrics.checkoutConversion),
      `${metrics.contributions} of ${metrics.checkouts} checkouts started`,
    ],
    [
      "Payment success rate",
      percent(metrics.paymentSuccessRate),
      "Captured against captured plus failed",
    ],
    [
      "Page visitors",
      String(metrics.visitors),
      "Distinct daily visitors to wedding pages, all modes",
    ],
  ];

  return (
    <>
      <AdminHeading title="Overview">
        <FilterLinks
          base="/admin"
          param="mode"
          current={mode ?? undefined}
          options={[
            { value: null, label: "All payments" },
            { value: "TEST", label: "Demo and test" },
            { value: "LIVE", label: "Live" },
          ]}
        />
      </AdminHeading>

      <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map(([label, value, detail]) => (
          <div key={label} className="bg-card rounded-lg border p-5">
            <dt className="text-muted-foreground text-sm">{label}</dt>
            <dd className="font-heading mt-1 text-3xl" data-metric={label}>
              {value}
            </dd>
            <dd className="text-muted-foreground mt-1 text-xs">{detail}</dd>
          </div>
        ))}
      </dl>

      <h2 className="text-h3 mt-12 mb-4">Popular wishlist categories</h2>
      <Table head={["Category", "Confirmed gifts", "Volume"]}>
        {metrics.categories.length === 0 ? (
          <EmptyRow columns={3}>No confirmed gifts yet.</EmptyRow>
        ) : (
          metrics.categories.map((row) => (
            <tr key={row.category}>
              <Td>{DREAM_CATEGORY_LABELS[row.category as DreamCategory] ?? row.category}</Td>
              <Td className="tabular-nums">{row.gifts}</Td>
              <Td className="tabular-nums">{formatPaise(row.paise)}</Td>
            </tr>
          ))
        )}
      </Table>
    </>
  );
}

export default function AdminOverviewPage({ searchParams }: Props) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Overview searchParams={searchParams} />
    </Suspense>
  );
}
