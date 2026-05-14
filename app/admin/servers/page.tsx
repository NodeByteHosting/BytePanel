import { requireAdmin } from "@/lib/session";

import { PageBody, PageHeader } from "../../dashboard/components/page-header";
import { CreateServerDialog } from "./create-server-dialog";
import { ServersTable } from "./servers-table";

const AdminServersPage = async () => {
  await requireAdmin();
  return (
    <>
      <PageHeader title="Servers" actions={<CreateServerDialog />} />
      <PageBody>
        <ServersTable />
      </PageBody>
    </>
  );
};

export default AdminServersPage;
