import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AppShell, PageSkeleton } from "@/components/couple/app-shell";
import { SignOutButton } from "@/components/couple/sign-out-button";
import { Button } from "@/components/ui/button";
import { NotFoundError } from "@/lib/errors";
import { formatPaise } from "@/lib/money";
import { requireActorOrRedirect } from "@/modules/auth/session";
import { listGifts } from "@/modules/contribution/gifts.service";
import { GiftList } from "./gift-list";

type Props = { searchParams: Promise<{ cursor?: string }> };

export const metadata: Metadata = { title: "Gifts and messages" };

async function Gifts({ searchParams }: Props) {
  const actor = await requireActorOrRedirect();
  const { cursor } = await searchParams;
  let page;
  try {
    page = await listGifts(actor, cursor);
  } catch (error) {
    if (error instanceof NotFoundError) redirect("/onboarding");
    throw error;
  }

  return (
    <>
      <dl className="bg-card shadow-soft grid grid-cols-2 divide-x rounded-xl border">
        <div className="p-6">
          <dt className="text-muted-foreground text-sm">Received so far</dt>
          <dd className="font-heading text-h2 mt-1" data-testid="gifts-total">
            {formatPaise(page.summary.totalPaise)}
          </dd>
        </div>
        <div className="p-6">
          <dt className="text-muted-foreground text-sm">Gifts</dt>
          <dd className="font-heading text-h2 mt-1">{page.summary.count}</dd>
        </div>
      </dl>

      <div className="mt-8">
        {page.gifts.length > 0 ? (
          <GiftList gifts={page.gifts} />
        ) : (
          <div className="bg-card rounded-xl border border-dashed p-10 text-center">
            <p className="font-heading text-h3 italic">
              {cursor ? "No more gifts" : "No gifts yet"}
            </p>
            <p className="text-muted-foreground mx-auto mt-2 max-w-sm">
              {cursor
                ? "You have reached the end of the list."
                : "When a guest contributes, their gift and message will appear here."}
            </p>
          </div>
        )}
      </div>

      {page.nextCursor ? (
        <div className="mt-8 text-center">
          <Button asChild variant="outline">
            <Link href={`/dashboard/gifts?cursor=${page.nextCursor}`}>Older gifts</Link>
          </Button>
        </div>
      ) : null}
    </>
  );
}

export default function GiftsPage({ searchParams }: Props) {
  return (
    <AppShell actions={<SignOutButton />} width="wide">
      <div className="mx-auto max-w-3xl">
        <Link
          href="/dashboard"
          className="text-muted-foreground text-sm underline-offset-4 hover:underline"
        >
          Back to dashboard
        </Link>
        <h1 className="text-h1 mt-4 mb-8">Gifts and messages</h1>
        <Suspense fallback={<PageSkeleton />}>
          <Gifts searchParams={searchParams} />
        </Suspense>
      </div>
    </AppShell>
  );
}
