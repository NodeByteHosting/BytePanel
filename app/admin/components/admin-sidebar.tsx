"use client";

import {
  ArrowLeftIcon,
  ChevronsUpDown,
  DollarSign,
  HardDrive,
  LayoutDashboard,
  Lock,
  LogOut,
  Mail,
  Monitor,
  ScrollText,
  Server,
  User,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import { Logo } from "@/components/logo";
import { ModeToggle } from "@/components/mode-toggle";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { signOut } from "@/lib/auth-client";

export interface AdminSidebarUser {
  name: string | null;
  email: string;
  hasImage: boolean;
  role: string;
  superAdmin: boolean;
}

interface NavItem {
  href: string;
  icon: React.ElementType;
  label: string;
  superAdminOnly?: boolean;
  matchExact?: boolean;
}

const NAV: NavItem[] = [
  {
    href: "/admin",
    icon: LayoutDashboard,
    label: "Overview",
    matchExact: true,
  },
  { href: "/admin/users", icon: Users, label: "Users" },
  { href: "/admin/servers", icon: Server, label: "Servers" },
  {
    href: "/admin/subscriptions",
    icon: DollarSign,
    label: "Subscriptions",
    superAdminOnly: true,
  },
  {
    href: "/admin/audit",
    icon: ScrollText,
    label: "Audit Log",
  },
  {
    href: "/admin/email",
    icon: Mail,
    label: "Email",
  },
  {
    href: "/admin/sessions",
    icon: Monitor,
    label: "Sessions",
    superAdminOnly: true,
  },
  {
    href: "/admin/snapshot",
    icon: HardDrive,
    label: "Baking",
    superAdminOnly: true,
  },
];

export const AdminSidebar = ({ user }: { user: AdminSidebarUser }) => {
  const pathname = usePathname();
  const router = useRouter();

  const initial = (user.name ?? user.email ?? "?").charAt(0).toUpperCase();

  return (
    <Sidebar collapsible="offcanvas" className="border-none">
      <SidebarHeader className="px-4 py-3">
        <Link
          href="/admin"
          className="flex items-center gap-2.5 rounded-lg transition-opacity hover:opacity-80"
        >
          <Logo className="h-5 w-auto text-sidebar-foreground" />
          <div className="flex flex-col group-data-[collapsible=icon]:hidden">
            <span className="text-sm font-semibold tracking-tight text-sidebar-foreground">
              NodeByte
            </span>
            <span className="text-xs leading-none text-muted-foreground">
              Admin Panel
            </span>
          </div>
        </Link>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Admin</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV.map(
                ({ href, icon: Icon, label, superAdminOnly, matchExact }) => {
                  if (superAdminOnly && !user.superAdmin) {
                    return null;
                  }
                  const isActive = matchExact
                    ? pathname === href
                    : pathname.startsWith(href);
                  return (
                    <SidebarMenuItem key={href}>
                      <SidebarMenuButton
                        asChild
                        isActive={isActive}
                        tooltip={label}
                      >
                        <Link href={href}>
                          <Icon />
                          <span className="flex-1">{label}</span>
                          {superAdminOnly && (
                            <Lock className="size-3 shrink-0 opacity-40" />
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

        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild tooltip="Back to dashboard">
                  <Link href="/dashboard">
                    <ArrowLeftIcon />
                    <span>Back to dashboard</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <div className="flex items-center justify-between rounded-lg border border-border/50 bg-card/30 px-2.5 py-2 backdrop-blur-sm group-data-[collapsible=icon]:justify-center">
              <span className="text-xs text-muted-foreground group-data-[collapsible=icon]:hidden">
                Theme
              </span>
              <ModeToggle />
            </div>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton size="lg" tooltip={user.email}>
                  <Avatar className="size-8 rounded-lg">
                    {user.hasImage ? (
                      <AvatarImage
                        src="/api/account/avatar"
                        alt={user.name ?? user.email}
                        className="rounded-lg"
                      />
                    ) : null}
                    <AvatarFallback className="rounded-lg bg-sidebar-accent text-sidebar-accent-foreground">
                      {initial}
                    </AvatarFallback>
                  </Avatar>
                  <div className="grid flex-1 text-left leading-tight">
                    <span className="truncate text-sm font-medium">
                      {user.name ?? user.email}
                    </span>
                    {user.name ? (
                      <span className="truncate text-xs text-muted-foreground">
                        {user.email}
                      </span>
                    ) : null}
                  </div>
                  <ChevronsUpDown className="ml-auto" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                side="top"
                align="end"
                className="w-(--radix-dropdown-menu-trigger-width) min-w-56"
              >
                <DropdownMenuLabel className="font-normal">
                  <div className="grid text-left leading-tight">
                    <span className="flex items-center gap-2 truncate text-sm font-medium">
                      {user.name ?? user.email}
                      {user.superAdmin && (
                        <Badge
                          variant="secondary"
                          className="px-1 py-0 text-[10px]"
                        >
                          Super Admin
                        </Badge>
                      )}
                      {!user.superAdmin && user.role === "admin" && (
                        <Badge
                          variant="secondary"
                          className="px-1 py-0 text-[10px]"
                        >
                          Admin
                        </Badge>
                      )}
                    </span>
                    <span className="truncate text-xs text-muted-foreground">
                      {user.email}
                    </span>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/dashboard/account">
                    <User />
                    Account
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onSelect={async () => {
                    await signOut();
                    router.push("/");
                    router.refresh();
                  }}
                >
                  <LogOut />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
};
