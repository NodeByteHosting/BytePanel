import { redirect } from "next/navigation";

import { bytepayEnabled } from "@/lib/env";
import { isStaff, requireUser } from "@/lib/session";

import { PageBody } from "../../components/page-header";
import { PasskeysPanel } from "../components/passkeys-panel";

const PasskeysPage = async () => {
  const user = await requireUser();
  if (bytepayEnabled && !isStaff(user)) {
    redirect("/dashboard/account");
  }

  return (
    <PageBody>
      <PasskeysPanel />
    </PageBody>
  );
};

export default PasskeysPage;
