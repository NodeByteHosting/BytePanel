import { redirect } from "next/navigation";

import { bytepayEnabled } from "@/lib/env";
import { isStaff, requireUser } from "@/lib/session";

import { PageBody } from "../../components/page-header";
import { PasswordPanel } from "../components/password-panel";

const PasswordPage = async () => {
  const user = await requireUser();
  if (bytepayEnabled && !isStaff(user)) {
    redirect("/dashboard/account");
  }

  return (
    <PageBody>
      <PasswordPanel />
    </PageBody>
  );
};

export default PasswordPage;
