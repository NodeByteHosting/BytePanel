import type { ReactNode } from "react";

import { isStaff, requireUser } from "@/lib/session";
import { customersUseBytepay, getPanelSettings } from "@/lib/settings";

import { PageHeader } from "../components/page-header";
import { AccountTabs } from "./components/account-tabs";

const AccountLayout = async ({ children }: { children: ReactNode }) => {
  const user = await requireUser();
  const { billingProvider } = await getPanelSettings();
  return (
    <>
      <PageHeader flush title="Account">
        <AccountTabs
          showSecurity={!customersUseBytepay(billingProvider) || isStaff(user)}
        />
      </PageHeader>
      {children}
    </>
  );
};

export default AccountLayout;
