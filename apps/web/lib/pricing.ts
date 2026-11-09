/**
 * Billing constants shared by the Stripe checkout and webhook flows.
 * Plan prices themselves live on the Plan model.
 */

/**
 * Format a price in pence to a GBP display string.
 */
export const formatNodeBytePrice = (pence: number): string =>
  new Intl.NumberFormat("en-GB", {
    currency: "GBP",
    maximumFractionDigits: 2,
    style: "currency",
  }).format(pence / 100);

// ---------------------------------------------------------------------------
// Add-on pricing
// ---------------------------------------------------------------------------

export interface AddonConfig {
  /** How many units are included free in every base plan */
  freeAllowance: number;
  /** GBP pence per additional unit per month */
  pricePerExtraUnitCents: number;
  /** Human-readable label for billing lines */
  label: string;
}

/**
 * Default add-on allowances and pricing.
 * Snapshots and backups are per-slot; databases are per managed DB instance.
 */
export const ADDON_DEFAULTS: Record<
  "snapshot" | "backup" | "database",
  AddonConfig
> = {
  backup: {
    freeAllowance: 1,
    label: "Automated Backup",
    // £1.49/mo per extra backup slot
    pricePerExtraUnitCents: 149,
  },
  database: {
    freeAllowance: 1,
    label: "Managed Database",
    // £2.99/mo per extra DB instance
    pricePerExtraUnitCents: 299,
  },
  snapshot: {
    freeAllowance: 2,
    label: "Server Snapshot",
    // £0.99/mo per extra snapshot slot
    pricePerExtraUnitCents: 99,
  },
};

// ---------------------------------------------------------------------------
// Suspension policy
// ---------------------------------------------------------------------------

/**
 * Number of calendar days a subscription can remain past_due before the
 * server is automatically suspended.
 */
export const SUSPENSION_GRACE_DAYS = 3;
