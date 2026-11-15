-- Integrity rules Prisma's schema language cannot express.
-- Money is integer paise; these keep impossible financial states out of the database
-- even if application code has a bug.

ALTER TABLE "Dream"
  ADD CONSTRAINT "Dream_targetPaise_positive" CHECK ("targetPaise" > 0),
  ADD CONSTRAINT "Dream_fundedPaise_nonneg" CHECK ("fundedPaise" >= 0),
  ADD CONSTRAINT "Dream_contributionCount_nonneg" CHECK ("contributionCount" >= 0);

ALTER TABLE "Contribution"
  ADD CONSTRAINT "Contribution_amountPaise_positive" CHECK ("amountPaise" > 0),
  ADD CONSTRAINT "Contribution_platformFeePaise_nonneg" CHECK ("platformFeePaise" >= 0),
  ADD CONSTRAINT "Contribution_totalPaise_sum" CHECK ("totalPaise" = "amountPaise" + "platformFeePaise");

ALTER TABLE "Payment"
  ADD CONSTRAINT "Payment_amountPaise_positive" CHECK ("amountPaise" > 0),
  ADD CONSTRAINT "Payment_refundedPaise_range" CHECK ("refundedPaise" >= 0 AND "refundedPaise" <= "amountPaise");

ALTER TABLE "Refund"
  ADD CONSTRAINT "Refund_amountPaise_positive" CHECK ("amountPaise" > 0);

ALTER TABLE "SettlementRecord"
  ADD CONSTRAINT "SettlementRecord_amountPaise_positive" CHECK ("amountPaise" > 0);

ALTER TABLE "Wedding"
  ADD CONSTRAINT "Wedding_slug_format" CHECK ("slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND char_length("slug") BETWEEN 3 AND 60);

ALTER TABLE "MediaAsset"
  ADD CONSTRAINT "MediaAsset_bytes_positive" CHECK ("bytes" > 0);

ALTER TABLE "Notification"
  ADD CONSTRAINT "Notification_attempts_nonneg" CHECK ("attempts" >= 0);
