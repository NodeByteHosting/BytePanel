import type { ReactNode } from "react";

import { bytepayEnabled } from "@/lib/env";
import { isStaff, requireUser } from "@/lib/session";

import { PageHeader } from "../components/page-header";
import { AccountTabs } from "./components/account-tabs";

const AccountLayout = async ({ children }: { children: ReactNode }) => {
  const user = await requireUser();
  return (
    <>
      <PageHeader flush title="Account">
        <AccountTabs showSecurity={!bytepayEnabled || isStaff(user)} />
      </PageHeader>
      {children}
    </>
  );
};

export default AccountLayout;
