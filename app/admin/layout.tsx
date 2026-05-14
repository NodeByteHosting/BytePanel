import type { ReactNode } from "react";

import { SidebarProvider } from "@/components/ui/sidebar";
import { requireAdmin } from "@/lib/session";

import { AdminContainer } from "./components/admin-container";
import { AdminSidebar } from "./components/admin-sidebar";

const AdminLayout = async ({ children }: { children: ReactNode }) => {
  const user = await requireAdmin();

  return (
    <SidebarProvider className="bg-sidebar">
      <AdminSidebar
        user={{
          email: user.email,
          hasImage: Boolean(user.image),
          name: user.name ?? null,
          role: (user as { role?: string }).role ?? "user",
          superAdmin: (user as { superAdmin?: boolean }).superAdmin ?? false,
        }}
      />
      <AdminContainer>{children}</AdminContainer>
    </SidebarProvider>
  );
};

export default AdminLayout;
