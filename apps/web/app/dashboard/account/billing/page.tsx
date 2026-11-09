import { requireUser } from "@/lib/session";
import { getPanelSettings } from "@/lib/settings";

import { ExternalStoreNotice } from "../../components/external-store-notice";
import { PageBody } from "../../components/page-header";

const BillingPage = async () => {
  await requireUser();
  const settings = await getPanelSettings();
  return (
    <PageBody constrained>
      <ExternalStoreNotice
        description="Invoices, payment methods and cancellations are managed in our store."
        storeUrl={settings.storeUrl}
        title="Billing is managed in our store"
      />
    </PageBody>
  );
};

export default BillingPage;
