import { requireSuperAdmin } from "@/lib/session";

import { PageBody, PageHeader } from "../../dashboard/components/page-header";
import { SessionsTable } from "./sessions-table";

const AdminSessionsPage = async () => {
  await requireSuperAdmin();
  return (
    <>
      <PageHeader title="Active Sessions" />
      <PageBody>
        <SessionsTable />
      </PageBody>
    </>
  );
};

export default AdminSessionsPage;
