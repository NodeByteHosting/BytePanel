import { redirect } from "next/navigation";

import { prisma } from "@/lib/db";
import { isStaff, requireUser } from "@/lib/session";
import { customersUseBytepay, getPanelSettings } from "@/lib/settings";

import { PageBody } from "../../components/page-header";
import { PasskeysPanel } from "../components/passkeys-panel";
import { TwoFactorPanel } from "../components/two-factor-panel";

const PasskeysPage = async () => {
  const user = await requireUser();
  const { billingProvider } = await getPanelSettings();
  if (customersUseBytepay(billingProvider) && !isStaff(user)) {
    redirect("/dashboard/account");
  }

  const credential = await prisma.account.findFirst({
    select: { id: true },
    where: {
      password: { not: null },
      providerId: "credential",
      userId: user.id,
    },
  });

  return (
    <PageBody>
      <PasskeysPanel />
      <br />
      <TwoFactorPanel
        enabled={
          (user as { twoFactorEnabled?: boolean }).twoFactorEnabled ?? false
        }
        hasPassword={credential !== null}
      />
    </PageBody>
  );
};

export default PasskeysPage;
