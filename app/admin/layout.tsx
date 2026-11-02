import { Suspense } from "react";
import type { ReactNode } from "react";

import { SidebarProvider } from "@/components/ui/sidebar";
import { requireAdmin } from "@/lib/session";

import { AdminContainer } from "./components/admin-container";
import { AdminSidebarEnhanced } from "./components/admin-sidebar-enhanced";
import { ADMIN_NAV_ITEMS } from "./config/nav";
import { UpdateBanner } from "./updates/update-banner";

const AdminLayout = async ({ children }: { children: ReactNode }) => {
  const user = await requireAdmin();

  return (
    <SidebarProvider className="bg-sidebar h-svh">
      <AdminSidebarEnhanced
        user={{
          email: user.email,
          hasImage: Boolean(user.image),
          name: user.name ?? null,
          role: (user as { role?: string }).role ?? "user",
          superAdmin: (user as { superAdmin?: boolean }).superAdmin ?? false,
        }}
        navItems={[...ADMIN_NAV_ITEMS]}
      />
      <AdminContainer>
        {/* Streams in after the page so slow or offline nodes never block it. */}
        <Suspense fallback={null}>
          <UpdateBanner />
        </Suspense>
        {children}
      </AdminContainer>
    </SidebarProvider>
  );
};

export default AdminLayout;
