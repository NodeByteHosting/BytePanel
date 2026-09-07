ALTER TABLE "subscriptions"
  ADD COLUMN "hourlyRateMilliCents" INTEGER,
  ADD COLUMN "usageBillingStartedAt" TIMESTAMP(3),
  ADD COLUMN "usageLastBilledAt" TIMESTAMP(3);

CREATE TABLE "usage_invoices" (
  "id" TEXT NOT NULL,
  "subscriptionId" TEXT NOT NULL,
  "periodStart" TIMESTAMP(3) NOT NULL,
  "periodEnd" TIMESTAMP(3) NOT NULL,
  "amountCents" INTEGER NOT NULL,
  "stripeInvoiceId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "usage_invoices_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "usage_invoices_stripeInvoiceId_key" ON "usage_invoices"("stripeInvoiceId");
CREATE UNIQUE INDEX "usage_invoices_subscriptionId_periodStart_key" ON "usage_invoices"("subscriptionId", "periodStart");
CREATE INDEX "usage_invoices_subscriptionId_idx" ON "usage_invoices"("subscriptionId");

ALTER TABLE "usage_invoices"
  ADD CONSTRAINT "usage_invoices_subscriptionId_fkey"
  FOREIGN KEY ("subscriptionId") REFERENCES "subscriptions"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;