"use client";

import {
  ArrowLeftIcon,
  DollarSign,
  Egg,
  HardDrive,
  LayoutDashboard,
  Lock,
  Mail,
  MapPin,
  Monitor,
  Package,
  ScrollText,
  Server,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import { SharedSidebar } from "@/components/ui/shared-sidebar";
import type { SidebarUserConfig } from "@/components/ui/shared-sidebar";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { signOut } from "@/lib/auth-client";

interface AdminSidebarEnhancedProps {
  user: SidebarUserConfig;
  navItems: {
    href: string;
    icon: string;
    label: string;
    superAdminOnly?: boolean;
    matchExact?: boolean;
  }[];
}

const ICON_MAP: Record<string, LucideIcon> = {
  DollarSign,
  Egg,
  HardDrive,
  LayoutDashboard,
  Mail,
  MapPin,
  Monitor,
  Package,
  ScrollText,
  Server,
  Users,
};

export const AdminSidebarEnhanced = ({
  user,
  navItems,
}: AdminSidebarEnhancedProps) => {
  const pathname = usePathname();
  const router = useRouter();

  const handleSignOut = async () => {
    await signOut();
    router.push("/");
    router.refresh();
  };

  const getIcon = (iconName: string): LucideIcon =>
    ICON_MAP[iconName] || LayoutDashboard;

  return (
    <SharedSidebar
      user={user}
      headerTitle="NodeByte"
      headerSubtitle="Admin Panel"
      headerHref="/"
      showAdminLink={false}
      onSignOut={handleSignOut}
    >
      {/* Admin Navigation */}
      <SidebarGroup className="border-b border-border/40 px-0 py-3">
        <SidebarGroupLabel className="px-4 h-9 flex items-center text-xs font-semibold text-muted-foreground">
          Admin
        </SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu className="gap-1">
            {navItems.map(
              ({ href, icon: iconName, label, superAdminOnly, matchExact }) => {
                if (superAdminOnly && !user.superAdmin) {
                  return null;
                }
                const Icon = getIcon(iconName);
                const isActive = matchExact
                  ? pathname === href
                  : pathname.startsWith(href);
                return (
                  <SidebarMenuItem key={href}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      className="mx-2"
                      tooltip={label}
                    >
                      <Link href={href}>
                        <Icon className="h-4 w-4" />
                        <span>{label}</span>
                        {superAdminOnly && (
                          <Lock className="size-3 shrink-0 opacity-40 ml-auto" />
                        )}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              }
            )}
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>

      {/* Back to Dashboard */}
      <SidebarGroup className="px-0 py-2">
        <SidebarGroupContent>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                className="mx-2"
                tooltip="Back to dashboard"
              >
                <Link href="/dashboard">
                  <ArrowLeftIcon className="h-4 w-4" />
                  <span>Back to Dashboard</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    </SharedSidebar>
  );
};
