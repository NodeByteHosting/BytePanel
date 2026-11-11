import { redirect } from "next/navigation";

import { isStaff, requireUser } from "@/lib/session";
import { customersUseBytepay, getPanelSettings } from "@/lib/settings";

import { PageBody } from "../../components/page-header";
import { PasswordPanel } from "../components/password-panel";

const PasswordPage = async () => {
  const user = await requireUser();
  const { billingProvider } = await getPanelSettings();
  if (customersUseBytepay(billingProvider) && !isStaff(user)) {
    redirect("/dashboard/account");
  }

  return (
    <PageBody>
      <PasswordPanel />
    </PageBody>
  );
};

export default PasswordPage;
