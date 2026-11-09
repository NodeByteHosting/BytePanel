import { requireUser } from "@/lib/session";
import { getPanelSettings } from "@/lib/settings";

import { ExternalStoreNotice } from "../components/external-store-notice";
import { PageBody, PageHeader } from "../components/page-header";

const NewServerPage = async () => {
  await requireUser();
  const settings = await getPanelSettings();
  return (
    <>
      <PageHeader title="New server" />
      <PageBody>
        <ExternalStoreNotice
          description="New servers are ordered through our store. Once your order is complete, the server appears here."
          storeUrl={settings.storeUrl}
          title="Order from our store"
        />
      </PageBody>
    </>
  );
};

export default NewServerPage;
