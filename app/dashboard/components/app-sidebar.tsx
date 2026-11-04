"use client";

import {
  ChevronsUpDown,
  LayoutDashboard,
  LogOut,
  Plus,
  Server,
  Shield,
  User,
  CreditCard,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import { BrandLogo } from "@/components/brand-logo";
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
import { cn } from "@/lib/utils";
import { useBranding } from "@/providers/branding";

// Panel-side health only; live power state comes from the node on the
// server page.
export type SidebarHealth = "ready" | "pending" | "issue";

export interface SidebarServer {
  id: string;
  name: string;
  gameName: string | null;
  gameImage: string | null;
  health: SidebarHealth;
}

export interface SidebarUser {
  name: string | null;
  email: string;
  hasImage: boolean;
  role: string;
  superAdmin: boolean;
}

const statusDot: Record<SidebarHealth, string> = {
  issue: "bg-red-500",
  pending: "bg-amber-500",
  ready: "bg-emerald-500",
};

const StatPill = ({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: "emerald" | "amber" | "muted";
}) => {
  const styles = {
    amber:
      "bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400",
    emerald:
      "bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400",
    muted: "bg-muted/60 border-border/40 text-muted-foreground",
  };
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-0.5 rounded-lg border px-2 py-1.5",
        styles[color]
      )}
    >
      <span className="text-sm leading-none font-bold">{value}</span>
      <span className="text-[10px] opacity-80">{label}</span>
    </div>
  );
};

export const AppSidebar = ({
  servers,
  user,
}: {
  servers: SidebarServer[];
  user: SidebarUser;
}) => {
  const pathname = usePathname();
  const router = useRouter();
  const { panelName } = useBranding();

  const initial = (user.name ?? user.email ?? "?").charAt(0).toUpperCase();
  const isAdmin = user.superAdmin || user.role === "admin";

  const readyCount = servers.filter((s) => s.health === "ready").length;
  const pendingCount = servers.filter((s) => s.health === "pending").length;
  const issueCount = servers.filter((s) => s.health === "issue").length;

  return (
    <Sidebar collapsible="offcanvas" className="border-none">
      {/* Header */}
      <SidebarHeader className="border-sidebar-border border-b px-4 py-3.5">
        <Link
          href="/"
          className="flex items-center gap-2.5 rounded-lg transition-opacity hover:opacity-80"
        >
          <BrandLogo className="text-sidebar-foreground h-5 w-auto" />
          <div className="flex flex-col leading-tight group-data-[collapsible=icon]:hidden">
            <span className="text-sidebar-foreground text-sm font-bold tracking-tight">
              {panelName}
            </span>
            <span className="text-muted-foreground text-[11px]">
              Game Servers
            </span>
          </div>
        </Link>
      </SidebarHeader>

      <SidebarContent className="gap-0 px-0">
        {/* Nav links */}
        <SidebarGroup className="border-sidebar-border border-b px-2 py-2">
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={pathname === "/dashboard"}
                  tooltip="Dashboard"
                >
                  <Link href="/dashboard">
                    <LayoutDashboard className="h-4 w-4" />
                    <span>Dashboard</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={pathname === "/dashboard/new"}
                  tooltip="New Server"
                  className="text-primary dark:text-primary"
                >
                  <Link href="/dashboard/new">
                    <Plus className="h-4 w-4" />
                    <span>New Server</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Stats strip */}
        {servers.length > 0 && (
          <div className="border-sidebar-border border-b px-3 py-3">
            <div className="grid grid-cols-3 gap-1.5 text-xs">
              <StatPill label="Ready" value={readyCount} color="emerald" />
              <StatPill label="Issues" value={issueCount} color="amber" />
              <StatPill label="Pending" value={pendingCount} color="muted" />
            </div>
          </div>
        )}

        {/* Servers list */}
        <SidebarGroup className="flex-1 overflow-hidden px-0 py-2">
          <SidebarGroupLabel className="text-muted-foreground/70 flex h-8 items-center px-3 text-[11px] font-semibold tracking-wider uppercase">
            <Server className="mr-1.5 h-3 w-3" />
            Servers
            {servers.length > 0 && (
              <Badge
                variant="secondary"
                className="ml-auto h-4 px-1.5 text-[10px]"
              >
                {servers.length}
              </Badge>
            )}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-0.5">
              {servers.length === 0 ? (
                <div className="px-3 py-8 text-center">
                  <Server className="text-muted-foreground/30 mx-auto mb-2 h-7 w-7" />
                  <p className="text-muted-foreground text-xs">
                    No servers yet
                  </p>
                  <Link href="/dashboard/new">
                    <span className="text-primary mt-1.5 inline-block text-xs hover:underline">
                      Create one →
                    </span>
                  </Link>
                </div>
              ) : (
                servers.map((server) => {
                  const href = `/dashboard/${server.id}`;
                  const dotColor = statusDot[server.health];
                  const isActive = pathname.startsWith(href);

                  return (
                    <SidebarMenuItem key={server.id}>
                      <SidebarMenuButton
                        asChild
                        isActive={isActive}
                        tooltip={server.name}
                        className="mx-1"
                      >
                        <Link href={href} className="flex items-center gap-2.5">
                          <div className="ring-border/50 relative h-7 w-7 shrink-0 overflow-hidden rounded-md ring-1">
                            {server.gameImage ? (
                              <Image
                                src={server.gameImage}
                                alt={server.gameName ?? server.name}
                                width={28}
                                height={28}
                                className="object-cover"
                              />
                            ) : (
                              <div className="bg-muted flex h-full w-full items-center justify-center">
                                <Server className="text-muted-foreground h-3.5 w-3.5" />
                              </div>
                            )}
                            {/* Status dot overlay */}
                            <span
                              className={cn(
                                "ring-sidebar absolute right-0.5 bottom-0.5 h-1.5 w-1.5 rounded-full ring-1",
                                dotColor
                              )}
                            />
                          </div>
                          <div className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
                            <p className="truncate text-sm font-medium">
                              {server.name}
                            </p>
                            <p className="text-muted-foreground truncate text-[11px]">
                              {server.gameName ?? "Unknown game"}
                            </p>
                          </div>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {/* Footer */}
      <SidebarFooter className="border-sidebar-border gap-1 border-t px-2 py-2">
        {/* Theme + User */}
        <div className="flex items-center justify-between px-2 py-1">
          <span className="text-muted-foreground text-xs group-data-[collapsible=icon]:hidden">
            Theme
          </span>
          <ModeToggle />
        </div>

        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton
                  size="lg"
                  tooltip={user.email}
                  className="rounded-lg"
                >
                  <Avatar className="h-8 w-8 rounded-lg">
                    {user.hasImage && (
                      <AvatarImage
                        src="/api/account/avatar"
                        alt={user.name ?? user.email}
                        className="rounded-lg"
                      />
                    )}
                    <AvatarFallback className="bg-primary/10 text-primary rounded-lg text-sm font-semibold">
                      {initial}
                    </AvatarFallback>
                  </Avatar>
                  <div className="grid flex-1 text-left leading-tight group-data-[collapsible=icon]:hidden">
                    <span className="truncate text-sm font-semibold">
                      {user.name ?? "Account"}
                    </span>
                    <span className="text-muted-foreground truncate text-xs">
                      {user.email}
                    </span>
                  </div>
                  <ChevronsUpDown className="ml-auto h-4 w-4 opacity-40 group-data-[collapsible=icon]:hidden" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="top" align="end" className="w-56">
                <DropdownMenuLabel className="py-2 font-normal">
                  <div className="flex items-center gap-2">
                    <Avatar className="h-8 w-8 rounded-lg">
                      {user.hasImage && (
                        <AvatarImage
                          src="/api/account/avatar"
                          alt={user.name ?? user.email}
                          className="rounded-lg"
                        />
                      )}
                      <AvatarFallback className="bg-primary/10 text-primary rounded-lg text-sm font-semibold">
                        {initial}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">
                        {user.name ?? "Account"}
                      </p>
                      <p className="text-muted-foreground truncate text-xs">
                        {user.email}
                      </p>
                    </div>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/dashboard/account" className="cursor-pointer">
                    <User className="mr-2 h-4 w-4" />
                    Profile
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link
                    href="/dashboard/account/billing"
                    className="cursor-pointer"
                  >
                    <CreditCard className="mr-2 h-4 w-4" />
                    Billing
                  </Link>
                </DropdownMenuItem>
                {isAdmin && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                      <Link href="/admin" className="cursor-pointer">
                        <Shield className="mr-2 h-4 w-4" />
                        Admin Panel
                      </Link>
                    </DropdownMenuItem>
                  </>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={async () => {
                    await signOut();
                    router.push("/");
                    router.refresh();
                  }}
                  className="text-destructive focus:text-destructive cursor-pointer"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
};
