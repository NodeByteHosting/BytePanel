import { API_URL, paypalEnabled, stripeEnabled } from "@/lib/env";
import { requireSuperAdmin } from "@/lib/session";
import { getPanelSettings } from "@/lib/settings";

import { PageBody, PageHeader } from "../../dashboard/components/page-header";
import { BillingForm, BrandingForm } from "./settings-client";
import type { BillingValues } from "./settings-client";

const AdminSettingsPage = async () => {
  await requireSuperAdmin();
  const settings = await getPanelSettings();

  return (
    <>
      <PageHeader title="Settings" />
      <PageBody>
        <div className="flex flex-col gap-8">
          <BrandingForm
            initial={{
              logoUrl: settings.logoUrl ?? "",
              panelName: settings.panelName,
              supportUrl: settings.supportUrl ?? "",
              websiteUrl: settings.websiteUrl ?? "",
            }}
          />
          <BillingForm
            apiBaseUrl={`${API_URL}/api/application`}
            apiKeyHint={settings.billingApiKeyHint}
            payments={{
              paypal: {
                enabled: paypalEnabled,
                webhookUrl: `${API_URL}/api/webhooks/paypal`,
              },
              stripe: {
                enabled: stripeEnabled,
                webhookUrl: `${API_URL}/api/webhooks/stripe`,
              },
            }}
            initial={{
              billingProvider: settings.billingProvider,
              currency: settings.currency as BillingValues["currency"],
              storeUrl: settings.storeUrl ?? "",
            }}
          />
        </div>
      </PageBody>
    </>
  );
};

export default AdminSettingsPage;
