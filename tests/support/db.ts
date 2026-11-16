import { PrismaPg } from "@prisma/adapter-pg";
import { config } from "dotenv";
import { PrismaClient } from "@/generated/prisma/client";

config({ path: [".env.local", ".env"], quiet: true });

export const hasDatabase = Boolean(process.env.DATABASE_URL);

export function createTestDb(): PrismaClient {
  return new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL ?? "" }),
  });
}

/** Removes every row created for users whose email ends with the given suffix. */
export async function deleteTestUsers(db: PrismaClient, emailSuffix: string): Promise<void> {
  const users = await db.user.findMany({
    where: { email: { endsWith: emailSuffix } },
    select: { id: true, membership: { select: { coupleId: true } } },
  });
  const userIds = users.map((user) => user.id);
  const coupleIds = users.flatMap((user) => (user.membership ? [user.membership.coupleId] : []));

  const weddingIds = (
    await db.wedding.findMany({ where: { coupleId: { in: coupleIds } }, select: { id: true } })
  ).map((wedding) => wedding.id);
  await db.analyticsEvent.deleteMany({ where: { weddingId: { in: weddingIds } } });
  const inWeddings = { wedding: { coupleId: { in: coupleIds } } };
  const inPayments = { payment: { contribution: inWeddings } };
  await db.paymentStatusTransition.deleteMany({ where: inPayments });
  await db.paymentEvent.deleteMany({ where: inPayments });
  await db.refund.deleteMany({ where: inPayments });
  await db.payment.deleteMany({ where: { contribution: inWeddings } });
  await db.guestMessage.deleteMany({ where: inWeddings });
  await db.contribution.deleteMany({ where: inWeddings });
  await db.notification.deleteMany({ where: { recipient: { endsWith: emailSuffix } } });
  await db.dream.deleteMany({ where: inWeddings });
  await db.wedding.deleteMany({ where: { coupleId: { in: coupleIds } } });
  await db.couple.deleteMany({ where: { id: { in: coupleIds } } });
  await db.auditLog.deleteMany({ where: { actorUserId: { in: userIds } } });
  await db.verification.deleteMany({ where: { identifier: { endsWith: emailSuffix } } });
  await db.user.deleteMany({ where: { id: { in: userIds } } });
}
