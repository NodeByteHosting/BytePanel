export const BILLING_PROVIDERS = [
  "bytepay",
  "whmcs",
  "blesta",
  "paymenter",
  "builtin",
] as const;

export type BillingProvider = (typeof BILLING_PROVIDERS)[number];

export const BILLING_PROVIDER_INFO: Record<
  BillingProvider,
  { description: string; external: boolean; label: string; setup: string }
> = {
  blesta: {
    description: "Sell servers in Blesta. Customers order and pay there.",
    external: true,
    label: "Blesta",
    setup:
      "Copy integrations/blesta from the BytePanel repo into Blesta, then add a server with the API URL and key below.",
  },
  builtin: {
    description:
      "Sell servers inside BytePanel and take payments with Stripe or PayPal.",
    external: false,
    label: "Built-in (Stripe and PayPal)",
    setup:
      "Customers sign up, order and pay in the panel. Give plans a monthly price, then set up Stripe, PayPal or both below.",
  },
  bytepay: {
    description:
      "Sell servers in BytePay. Customers sign in to the panel with their BytePay account.",
    external: true,
    label: "BytePay",
    setup:
      "Add a BytePanel server in BytePay with the API URL and key below, then set the BYTEPAY_* variables for sign-in.",
  },
  paymenter: {
    description: "Sell servers in Paymenter. Customers order and pay there.",
    external: true,
    label: "Paymenter",
    setup:
      "Copy integrations/paymenter from the BytePanel repo into Paymenter, then add a server with the API URL and key below.",
  },
  whmcs: {
    description: "Sell servers in WHMCS. Customers order and pay there.",
    external: true,
    label: "WHMCS",
    setup:
      "Copy integrations/whmcs from the BytePanel repo into WHMCS, then add a server with the API URL and key below.",
  },
};
