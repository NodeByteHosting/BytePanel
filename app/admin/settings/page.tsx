import { API_URL } from "@/lib/env";
import { requireSuperAdmin } from "@/lib/session";
import { getPanelSettings } from "@/lib/settings";

import { PageBody, PageHeader } from "../../dashboard/components/page-header";
import { BillingForm, BrandingForm } from "./settings-client";

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
              landingPage: settings.landingPage,
              logoUrl: settings.logoUrl ?? "",
              panelName: settings.panelName,
              supportUrl: settings.supportUrl ?? "",
              websiteUrl: settings.websiteUrl ?? "",
            }}
          />
          <BillingForm
            apiBaseUrl={`${API_URL}/api/application`}
            apiKeyHint={settings.billingApiKeyHint}
            initial={{
              billingMode: settings.billingMode,
              storeUrl: settings.storeUrl ?? "",
            }}
          />
        </div>
      </PageBody>
    </>
  );
};

export default AdminSettingsPage;
