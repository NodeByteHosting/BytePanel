"use client";
import { ImageUpIcon, KeyRoundIcon, TrashIcon } from "lucide-react";
import { useRef, useState } from "react";

import { Logo } from "@/components/logo";
import { Panel, PanelCard } from "@/components/panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  BILLING_PROVIDER_INFO,
  BILLING_PROVIDERS,
} from "@/lib/billing-providers";
import type { BillingProvider } from "@/lib/billing-providers";
import { CURRENCIES } from "@/lib/billing/money";
import type { Currency } from "@/lib/billing/money";

import {
  generateApiKey,
  removeLogo,
  revokeApiKey,
  saveBilling,
  saveBranding,
  uploadLogo,
} from "../actions/settings";
import type { BillingInput, BrandingInput } from "../actions/settings";
import { useAction } from "../components/use-action";
import { CopyBlock } from "../nodes/[id]/node-client";

const UPLOADED_LOGO = "/api/branding/logo?";

const Field = ({
  id,
  label,
  hint,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  children: React.ReactNode;
}) => (
  <div className="flex flex-col gap-1.5">
    <Label htmlFor={id}>{label}</Label>
    {children}
    {hint && <span className="text-muted-foreground text-xs">{hint}</span>}
  </div>
);

type BrandingValues = Required<BrandingInput>;

export const BrandingForm = ({ initial }: { initial: BrandingValues }) => {
  const { pending, run } = useAction();
  const [v, setV] = useState(initial);
  const fileRef = useRef<HTMLInputElement>(null);
  const set = <K extends keyof BrandingValues>(
    key: K,
    value: BrandingValues[K]
  ) => setV((prev) => ({ ...prev, [key]: value }));
  const uploaded = initial.logoUrl.startsWith(UPLOADED_LOGO);

  const onUpload = async (file: File | undefined) => {
    if (!file) {
      return;
    }
    const form = new FormData();
    form.set("file", file);
    const result = await run(() => uploadLogo(form), "Logo uploaded");
    if (fileRef.current) {
      fileRef.current.value = "";
    }
    if (result?.ok) {
      window.location.reload();
    }
  };

  return (
    <Panel title="Branding">
      <PanelCard className="flex flex-col gap-4 p-4">
        <div className="flex items-center gap-4">
          <div className="bg-muted flex h-16 w-40 shrink-0 items-center justify-center rounded-lg p-2">
            {v.logoUrl ? (
              // oxlint-disable-next-line nextjs/no-img-element
              <img
                alt="Logo preview"
                className="max-h-full max-w-full object-contain"
                src={v.logoUrl}
              />
            ) : (
              <Logo className="text-foreground h-8 w-auto" />
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <input
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              className="hidden"
              ref={fileRef}
              type="file"
              onChange={(e) => onUpload(e.target.files?.[0])}
            />
            <Button
              disabled={pending}
              size="sm"
              variant="outline"
              onClick={() => fileRef.current?.click()}
            >
              <ImageUpIcon />
              Upload logo
            </Button>
            {initial.logoUrl && (
              <Button
                disabled={pending}
                size="sm"
                variant="ghost"
                onClick={async () => {
                  const result = await run(removeLogo, "Logo removed");
                  if (result?.ok) {
                    set("logoUrl", "");
                  }
                }}
              >
                <TrashIcon />
                Use default logo
              </Button>
            )}
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <Field
            hint="Shown in the sidebar, sign-in page, page titles and emails."
            id="panel-name"
            label="Panel name"
          >
            <Input
              id="panel-name"
              maxLength={40}
              value={v.panelName}
              onChange={(e) => set("panelName", e.target.value)}
            />
          </Field>
          <Field
            hint={
              uploaded
                ? "Using the uploaded logo. Enter a URL to use a hosted image instead."
                : "PNG, JPEG, WebP or SVG. Upload one, or link to a hosted image."
            }
            id="logo-url"
            label="Logo URL"
          >
            <Input
              id="logo-url"
              placeholder="https://example.com/logo.svg"
              value={v.logoUrl}
              onChange={(e) => set("logoUrl", e.target.value)}
            />
          </Field>
          <Field
            hint="Linked from the navigation and email footers."
            id="website-url"
            label="Website URL"
          >
            <Input
              id="website-url"
              placeholder="https://example.com"
              value={v.websiteUrl}
              onChange={(e) => set("websiteUrl", e.target.value)}
            />
          </Field>
          <Field
            hint="Where customers go for help (contact page, Discord, ticket system)."
            id="support-url"
            label="Support URL"
          >
            <Input
              id="support-url"
              placeholder="https://example.com/contact"
              value={v.supportUrl}
              onChange={(e) => set("supportUrl", e.target.value)}
            />
          </Field>
        </div>

        <div className="flex justify-end">
          <Button
            disabled={pending || !v.panelName.trim()}
            onClick={() => run(() => saveBranding(v), "Branding saved")}
          >
            Save branding
          </Button>
        </div>
      </PanelCard>
    </Panel>
  );
};

export type BillingValues = Required<BillingInput>;

interface PaymentSetup {
  enabled: boolean;
  webhookUrl: string;
}

const PAYMENT_SETUP = {
  paypal: {
    env: "PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET, PAYPAL_WEBHOOK_ID (and PAYPAL_SANDBOX=true for testing)",
    events:
      "BILLING.SUBSCRIPTION.ACTIVATED, .CANCELLED, .EXPIRED, .SUSPENDED, .RE-ACTIVATED, .PAYMENT.FAILED and PAYMENT.SALE.COMPLETED",
    label: "PayPal",
  },
  stripe: {
    env: "STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET",
    events:
      "checkout.session.completed, invoice.paid, invoice.payment_failed, customer.subscription.updated and customer.subscription.deleted",
    label: "Stripe",
  },
} as const;

const PaymentStatus = ({
  provider,
  setup,
}: {
  provider: keyof typeof PAYMENT_SETUP;
  setup: PaymentSetup;
}) => (
  <div className="border-border/60 flex flex-col gap-2 rounded-xl border p-3">
    <span className="flex items-center gap-2 text-sm font-medium">
      {PAYMENT_SETUP[provider].label}
      {setup.enabled ? (
        <Badge variant="outline">ready</Badge>
      ) : (
        <Badge variant="secondary">not set up</Badge>
      )}
    </span>
    <p className="text-muted-foreground text-xs">
      Set {PAYMENT_SETUP[provider].env}. Add this webhook and subscribe to{" "}
      {PAYMENT_SETUP[provider].events}.
    </p>
    <CopyBlock value={setup.webhookUrl} />
  </div>
);

export const BillingForm = ({
  apiBaseUrl,
  apiKeyHint,
  initial,
  payments,
}: {
  apiBaseUrl: string;
  apiKeyHint: string | null;
  initial: BillingValues;
  payments: { paypal: PaymentSetup; stripe: PaymentSetup };
}) => {
  const { pending, run } = useAction();
  const [v, setV] = useState(initial);
  const [newKey, setNewKey] = useState<string | null>(null);

  return (
    <Panel title="Billing">
      <PanelCard className="flex flex-col gap-4 p-4">
        <RadioGroup
          className="grid gap-2 md:grid-cols-2"
          onValueChange={(value) =>
            setV((prev) => ({
              ...prev,
              billingProvider: value as BillingProvider,
            }))
          }
          value={v.billingProvider}
        >
          {BILLING_PROVIDERS.map((provider) => (
            <Label
              className="border-border/60 has-data-[state=checked]:border-link flex cursor-pointer items-start gap-3 rounded-xl border p-3 font-normal"
              htmlFor={`billing-${provider}`}
              key={provider}
            >
              <RadioGroupItem
                className="mt-0.5"
                id={`billing-${provider}`}
                value={provider}
              />
              <span className="flex flex-col gap-0.5">
                <span className="text-sm font-medium">
                  {BILLING_PROVIDER_INFO[provider].label}
                </span>
                <span className="text-muted-foreground text-xs">
                  {BILLING_PROVIDER_INFO[provider].description}
                </span>
              </span>
            </Label>
          ))}
        </RadioGroup>

        <p className="text-muted-foreground text-xs">
          {BILLING_PROVIDER_INFO[v.billingProvider].setup}
        </p>

        {BILLING_PROVIDER_INFO[v.billingProvider].external && (
          <Field
            hint="Customers are sent here from “New server” and “Billing” in the dashboard."
            id="store-url"
            label="Store URL"
          >
            <Input
              id="store-url"
              placeholder="https://billing.example.com/store"
              value={v.storeUrl}
              onChange={(e) =>
                setV((prev) => ({ ...prev, storeUrl: e.target.value }))
              }
            />
          </Field>
        )}

        {v.billingProvider === "builtin" && (
          <>
            <Field
              hint="Plan prices are charged in this currency. Changing it applies to new orders only."
              id="currency"
              label="Currency"
            >
              <Select
                onValueChange={(value) =>
                  setV((prev) => ({ ...prev, currency: value as Currency }))
                }
                value={v.currency}
              >
                <SelectTrigger className="w-40" id="currency">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map((currency) => (
                    <SelectItem key={currency} value={currency}>
                      {currency}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <div className="grid gap-2 md:grid-cols-2">
              <PaymentStatus provider="stripe" setup={payments.stripe} />
              <PaymentStatus provider="paypal" setup={payments.paypal} />
            </div>
          </>
        )}

        <div className="flex justify-end">
          <Button
            disabled={pending}
            onClick={() => run(() => saveBilling(v), "Billing settings saved")}
          >
            Save billing
          </Button>
        </div>
      </PanelCard>

      <PanelCard className="flex flex-col gap-4 p-4">
        <div className="flex flex-col gap-1">
          <h3 className="flex items-center gap-2 text-sm font-medium">
            <KeyRoundIcon className="size-4" />
            Billing API
            {apiKeyHint ? (
              <Badge variant="outline">
                <span className="font-mono">{apiKeyHint}…</span>
              </Badge>
            ) : (
              <Badge variant="secondary">no key</Badge>
            )}
          </h3>
          <p className="text-muted-foreground text-xs">
            Your billing system creates, suspends, upgrades and terminates
            servers through this API. Use plan and game IDs from{" "}
            <code>GET /catalog</code> when configuring products.
          </p>
        </div>
        <Field id="api-url" label="API URL">
          <CopyBlock value={apiBaseUrl} />
        </Field>
        {newKey && (
          <Field
            hint="Copy it now. It won't be shown again."
            id="api-key"
            label="API key"
          >
            <CopyBlock secret value={newKey} />
          </Field>
        )}
        <div className="flex flex-wrap justify-end gap-2">
          {apiKeyHint && (
            <Button
              disabled={pending}
              variant="ghost"
              onClick={async () => {
                const result = await run(revokeApiKey, "API key revoked");
                if (result?.ok) {
                  setNewKey(null);
                }
              }}
            >
              Revoke key
            </Button>
          )}
          <Button
            disabled={pending}
            variant={apiKeyHint ? "outline" : "default"}
            onClick={async () => {
              const result = await run(
                generateApiKey,
                apiKeyHint ? "API key regenerated" : "API key created"
              );
              if (result?.ok) {
                setNewKey(result.data.key);
              }
            }}
          >
            {apiKeyHint ? "Regenerate key" : "Generate key"}
          </Button>
        </div>
      </PanelCard>
    </Panel>
  );
};
