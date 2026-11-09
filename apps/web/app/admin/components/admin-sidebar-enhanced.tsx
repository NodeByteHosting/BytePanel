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
  RefreshCw,
  ScrollText,
  Server,
  Settings,
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
import { useBranding } from "@/providers/branding";

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
  RefreshCw,
  ScrollText,
  Server,
  Settings,
  Users,
};

const getIcon = (iconName: string): LucideIcon =>
  ICON_MAP[iconName] || LayoutDashboard;

export const AdminSidebarEnhanced = ({
  user,
  navItems,
}: AdminSidebarEnhancedProps) => {
  const pathname = usePathname();
  const router = useRouter();
  const { panelName } = useBranding();

  const handleSignOut = async () => {
    await signOut();
    router.push("/");
    router.refresh();
  };

  return (
    <SharedSidebar
      user={user}
      headerTitle={panelName}
      headerSubtitle="Admin Panel"
      headerHref="/"
      showAdminLink={false}
      onSignOut={handleSignOut}
    >
      <SidebarGroup className="border-border/40 border-b px-0 py-3">
        <SidebarGroupLabel className="text-muted-foreground flex h-9 items-center px-4 text-xs font-semibold">
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
                          <Lock className="ml-auto size-3 shrink-0 opacity-40" />
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
