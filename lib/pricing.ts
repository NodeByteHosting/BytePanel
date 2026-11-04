/**
 * Billing constants shared by the Stripe checkout and webhook flows.
 * Plan prices themselves live on the Plan model.
 */

// ---------------------------------------------------------------------------
// Provider markup (used by lib/providers for Hetzner catalog pricing)
// ---------------------------------------------------------------------------

// EUR → GBP conversion rate, with a small buffer for FX fluctuation.
const EUR_TO_GBP_RATE = 0.86;

const MARKUP: Record<"shared" | "dedicated", number> = {
  dedicated: 0.35,
  shared: 0.4,
};

// £4.99 floor so tiny server types don't price near zero
const MIN_PRICE_CENTS = 499;

/**
 * Apply the NodeByte markup to a provider base price (EUR/month).
 * Returns the price in GBP pence, rounded up to the nearest £0.50.
 */
export const applyMarkup = (
  basePriceEur: number,
  cpuType: "shared" | "dedicated"
): number => {
  const withMarkup = basePriceEur * EUR_TO_GBP_RATE * (1 + MARKUP[cpuType]);
  const rounded = Math.ceil((withMarkup * 100) / 50) * 50;
  return Math.max(rounded, MIN_PRICE_CENTS);
};

export const applyHourlyMarkupMilliCents = (
  baseHourlyPriceEur: number,
  cpuType: "shared" | "dedicated"
): number => {
  const gbp = baseHourlyPriceEur * EUR_TO_GBP_RATE;
  return Math.max(0, Math.round(gbp * (1 + MARKUP[cpuType]) * 100_000));
};

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
