import { PlusCircle } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { requireAdmin } from "@/lib/session";

import { PageBody, PageHeader } from "../../dashboard/components/page-header";
import { ServersTable } from "./servers-table";

const AdminServersPage = async () => {
  await requireAdmin();
  return (
    <>
      <PageHeader
        title="Servers"
        actions={
          <Button asChild size="sm">
            <Link href="/admin/servers/new">
              <PlusCircle />
              Create server
            </Link>
          </Button>
        }
      />
      <PageBody>
        <ServersTable />
      </PageBody>
    </>
  );
};

export default AdminServersPage;
