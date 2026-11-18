-- CreateEnum
CREATE TYPE "WaitlistRole" AS ENUM ('COUPLE', 'GUEST', 'PLANNER', 'OTHER');

-- CreateTable
CREATE TABLE "WaitlistEntry" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "role" "WaitlistRole" NOT NULL,
    "weddingMonth" TEXT,
    "city" TEXT,
    "source" TEXT NOT NULL DEFAULT 'home',
    "consentAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WaitlistEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WaitlistEntry_email_key" ON "WaitlistEntry"("email");

-- CreateIndex
CREATE INDEX "WaitlistEntry_createdAt_idx" ON "WaitlistEntry"("createdAt");

-- CreateIndex
CREATE INDEX "WaitlistEntry_role_createdAt_idx" ON "WaitlistEntry"("role", "createdAt");

