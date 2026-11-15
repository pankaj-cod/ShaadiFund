import "server-only";
import { getDb, type Db } from "@/lib/db";

const coupleSelect = {
  id: true,
  partnerOneName: true,
  partnerTwoName: true,
  onboardingStep: true,
  onboardingCompletedAt: true,
} as const;

export async function findCoupleByUserId(userId: string, db: Db = getDb()) {
  return db.couple.findFirst({ where: { members: { some: { userId } } }, select: coupleSelect });
}

export async function createCoupleForUser(userId: string, db: Db = getDb()) {
  return db.couple.create({
    data: { members: { create: { userId, role: "OWNER" } } },
    select: coupleSelect,
  });
}

export async function updateCouple(
  id: string,
  data: {
    partnerOneName?: string;
    partnerTwoName?: string;
    onboardingStep?: number;
    onboardingCompletedAt?: Date;
  },
  db: Db = getDb(),
) {
  return db.couple.update({ where: { id }, data, select: coupleSelect });
}

export type CoupleRecord = NonNullable<Awaited<ReturnType<typeof findCoupleByUserId>>>;

/** Email addresses of everyone in a couple, for notifications. */
export async function findCoupleEmails(coupleId: string, db: Db = getDb()): Promise<string[]> {
  const members = await db.coupleMember.findMany({
    where: { coupleId },
    select: { user: { select: { email: true } } },
  });
  return members.map((member) => member.user.email);
}
