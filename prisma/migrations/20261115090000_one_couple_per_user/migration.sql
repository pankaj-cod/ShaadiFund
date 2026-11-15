
-- DropIndex
DROP INDEX "CoupleMember_coupleId_userId_key";

-- DropIndex
DROP INDEX "CoupleMember_userId_idx";

-- CreateIndex
CREATE INDEX "CoupleMember_coupleId_idx" ON "CoupleMember"("coupleId");

-- CreateIndex
CREATE UNIQUE INDEX "CoupleMember_userId_key" ON "CoupleMember"("userId");

