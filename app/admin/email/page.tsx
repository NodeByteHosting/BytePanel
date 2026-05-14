import { requireAdmin } from "@/lib/session";

import { PageBody, PageHeader } from "../../dashboard/components/page-header";
import { EmailPanel } from "./email-panel";

const AdminEmailPage = async () => {
  await requireAdmin();
  return (
    <>
      <PageHeader title="Email" />
      <PageBody>
        <EmailPanel />
      </PageBody>
    </>
  );
};

export default AdminEmailPage;
