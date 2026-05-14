import { requireAdmin } from "@/lib/session";

import { PageBody, PageHeader } from "../../dashboard/components/page-header";
import { UsersTable } from "./users-table";

const AdminUsersPage = async () => {
  await requireAdmin();
  return (
    <>
      <PageHeader title="Users" />
      <PageBody>
        <UsersTable />
      </PageBody>
    </>
  );
};

export default AdminUsersPage;
