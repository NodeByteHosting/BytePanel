/**
 * NodeByte hosting pricing — applied on top of Hetzner base costs.
 *
 * We fetch real-time Hetzner prices for the server types we offer, then apply
 * a markup to cover infrastructure overhead, support, and profit margin.
 *
 * Markup strategy:
 *  - Shared CPU (cx/cpx series): 40% markup
 *  - Dedicated CPU (ccx series): 35% markup
 *  - Minimum price floor: £4.99/mo (prevents near-zero prices on tiny types)
 *
 * Prices are always presented in GBP to users. Hetzner EUR prices are
 * converted at the time of catalog fetch.
 */

// EUR → GBP conversion rate (updated periodically; replace with live rate API
// for production). We bake in a small buffer to handle FX fluctuation.
export const EUR_TO_GBP_RATE = 0.86;

// Markup percentages by CPU type
const MARKUP: Record<"shared" | "dedicated", number> = {
  dedicated: 0.35,
  shared: 0.4,
};

// Minimum NodeByte price per month (GBP pence) to protect margin on small VMs
// £4.99
export const MIN_PRICE_CENTS = 499;

/**
 * Apply the NodeByte markup to a Hetzner base price (EUR/month).
 * Returns the NodeByte price in GBP pence.
 */
export const applyMarkup = (
  hetznerPriceEur: number,
  cpuType: "shared" | "dedicated"
): number => {
  const gbp = hetznerPriceEur * EUR_TO_GBP_RATE;
  const markup = MARKUP[cpuType];
  const withMarkup = gbp * (1 + markup);
  // Round to nearest £0.50 for clean pricing
  const rounded = Math.ceil((withMarkup * 100) / 50) * 50;
  return Math.max(rounded, MIN_PRICE_CENTS);
};

export const applyHourlyMarkupMilliCents = (
  hetznerHourlyPriceEur: number,
  cpuType: "shared" | "dedicated"
): number => {
  const gbp = hetznerHourlyPriceEur * EUR_TO_GBP_RATE;
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

/**
 * Compute the monthly cost in GBP pence for a given add-on quantity.
 * Units up to freeAllowance are free; extras are billed at pricePerExtraUnitCents.
 */
export const computeAddonCents = (
  type: "snapshot" | "backup" | "database",
  quantity: number
): number => {
  const cfg = ADDON_DEFAULTS[type];
  const billableQty = Math.max(0, quantity - cfg.freeAllowance);
  return billableQty * cfg.pricePerExtraUnitCents;
};

// ---------------------------------------------------------------------------
// Suspension policy
// ---------------------------------------------------------------------------

/**
 * Number of calendar days a subscription can remain past_due before the
 * server is automatically suspended.
 */
export const SUSPENSION_GRACE_DAYS = 3;

/**
 * Game-level recommendations (not hard requirements).
 * Users can choose any server spec — these are shown as suggestions only.
 */
export interface GameRecommendation {
  // recommended vCPUs
  cpu: number;
  // recommended GB RAM
  memory: number;
  // recommended GB disk
  disk: number;
  // optional note, e.g. "Great for vanilla servers"
  label?: string;
}

export const GAME_RECOMMENDATIONS: Record<string, GameRecommendation> = {
  cs2: { cpu: 2, disk: 60, label: "Competitive 64-tick servers", memory: 4 },
  dontstarvetogether: { cpu: 1, disk: 5, label: "Up to ~6 players", memory: 2 },
  enshrouded: { cpu: 2, disk: 20, memory: 4 },
  l4d2: { cpu: 2, disk: 30, label: "Default 8-player lobbies", memory: 4 },
  minecraft: {
    cpu: 2,
    disk: 10,
    label: "Up to 10 players on vanilla",
    memory: 4,
  },
  palworld: { cpu: 4, disk: 20, label: "Up to 16 players", memory: 8 },
  rust: { cpu: 4, disk: 30, label: "100-player servers", memory: 8 },
  satisfactory: { cpu: 4, disk: 20, label: "1-4 players", memory: 6 },
  terraria: { cpu: 1, disk: 5, label: "Up to 8 players", memory: 2 },
  valheim: { cpu: 2, disk: 10, label: "Up to 10 players", memory: 4 },
  vrising: { cpu: 2, disk: 15, label: "Up to 40 players", memory: 4 },
};
