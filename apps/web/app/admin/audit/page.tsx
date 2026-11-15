import { requireAdmin } from "@/lib/session";

import { PageBody, PageHeader } from "../../dashboard/components/page-header";
import { AuditLogTable } from "./audit-log-table";

const AdminAuditPage = async () => {
  await requireAdmin();
  return (
    <>
      <PageHeader title="Audit Log" />
      <PageBody>
        <AuditLogTable />
      </PageBody>
    </>
  );
};

export default AdminAuditPage;
