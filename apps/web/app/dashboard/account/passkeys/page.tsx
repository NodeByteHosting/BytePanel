import { redirect } from "next/navigation";

import { isStaff, requireUser } from "@/lib/session";
import { customersUseBytepay, getPanelSettings } from "@/lib/settings";

import { PageBody } from "../../components/page-header";
import { PasskeysPanel } from "../components/passkeys-panel";

const PasskeysPage = async () => {
  const user = await requireUser();
  const { billingProvider } = await getPanelSettings();
  if (customersUseBytepay(billingProvider) && !isStaff(user)) {
    redirect("/dashboard/account");
  }

  return (
    <PageBody>
      <PasskeysPanel />
    </PageBody>
  );
};

export default PasskeysPage;
