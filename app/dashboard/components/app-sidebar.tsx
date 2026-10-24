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
import { cn } from "@/lib/utils";

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
      <span className="text-sm font-bold leading-none">{value}</span>
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

  const initial = (user.name ?? user.email ?? "?").charAt(0).toUpperCase();
  const isAdmin = user.superAdmin || user.role === "admin";

  const readyCount = servers.filter((s) => s.health === "ready").length;
  const pendingCount = servers.filter((s) => s.health === "pending").length;
  const issueCount = servers.filter((s) => s.health === "issue").length;

  return (
    <Sidebar collapsible="offcanvas" className="border-none">
      {/* Header */}
      <SidebarHeader className="border-b border-sidebar-border px-4 py-3.5">
        <Link
          href="/"
          className="flex items-center gap-2.5 rounded-lg transition-opacity hover:opacity-80"
        >
          <Logo className="h-5 w-auto text-sidebar-foreground" />
          <div className="flex flex-col leading-tight group-data-[collapsible=icon]:hidden">
            <span className="text-sm font-bold tracking-tight text-sidebar-foreground">
              NodeByte
            </span>
            <span className="text-[11px] text-muted-foreground">
              Game Servers
            </span>
          </div>
        </Link>
      </SidebarHeader>

      <SidebarContent className="px-0 gap-0">
        {/* Nav links */}
        <SidebarGroup className="border-b border-sidebar-border px-2 py-2">
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
          <div className="px-3 py-3 border-b border-sidebar-border">
            <div className="grid grid-cols-3 gap-1.5 text-xs">
              <StatPill label="Ready" value={readyCount} color="emerald" />
              <StatPill label="Issues" value={issueCount} color="amber" />
              <StatPill label="Pending" value={pendingCount} color="muted" />
            </div>
          </div>
        )}

        {/* Servers list */}
        <SidebarGroup className="flex-1 overflow-hidden px-0 py-2">
          <SidebarGroupLabel className="px-3 h-8 flex items-center text-[11px] font-semibold text-muted-foreground/70 uppercase tracking-wider">
            <Server className="h-3 w-3 mr-1.5" />
            Servers
            {servers.length > 0 && (
              <Badge
                variant="secondary"
                className="ml-auto text-[10px] px-1.5 h-4"
              >
                {servers.length}
              </Badge>
            )}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-0.5">
              {servers.length === 0 ? (
                <div className="px-3 py-8 text-center">
                  <Server className="h-7 w-7 mx-auto mb-2 text-muted-foreground/30" />
                  <p className="text-xs text-muted-foreground">
                    No servers yet
                  </p>
                  <Link href="/dashboard/new">
                    <span className="text-xs text-primary hover:underline mt-1.5 inline-block">
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
                          <div className="relative h-7 w-7 rounded-md overflow-hidden ring-1 ring-border/50 shrink-0">
                            {server.gameImage ? (
                              <Image
                                src={server.gameImage}
                                alt={server.gameName ?? server.name}
                                width={28}
                                height={28}
                                className="object-cover"
                              />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center bg-muted">
                                <Server className="h-3.5 w-3.5 text-muted-foreground" />
                              </div>
                            )}
                            {/* Status dot overlay */}
                            <span
                              className={cn(
                                "absolute bottom-0.5 right-0.5 h-1.5 w-1.5 rounded-full ring-1 ring-sidebar",
                                dotColor
                              )}
                            />
                          </div>
                          <div className="flex-1 min-w-0 group-data-[collapsible=icon]:hidden">
                            <p className="text-sm font-medium truncate">
                              {server.name}
                            </p>
                            <p className="text-[11px] text-muted-foreground truncate">
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
      <SidebarFooter className="border-t border-sidebar-border px-2 py-2 gap-1">
        {/* Theme + User */}
        <div className="flex items-center justify-between px-2 py-1">
          <span className="text-xs text-muted-foreground group-data-[collapsible=icon]:hidden">
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
                    <AvatarFallback className="rounded-lg bg-primary/10 text-primary font-semibold text-sm">
                      {initial}
                    </AvatarFallback>
                  </Avatar>
                  <div className="grid flex-1 text-left leading-tight group-data-[collapsible=icon]:hidden">
                    <span className="truncate text-sm font-semibold">
                      {user.name ?? "Account"}
                    </span>
                    <span className="truncate text-xs text-muted-foreground">
                      {user.email}
                    </span>
                  </div>
                  <ChevronsUpDown className="ml-auto h-4 w-4 opacity-40 group-data-[collapsible=icon]:hidden" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="top" align="end" className="w-56">
                <DropdownMenuLabel className="font-normal py-2">
                  <div className="flex items-center gap-2">
                    <Avatar className="h-8 w-8 rounded-lg">
                      {user.hasImage && (
                        <AvatarImage
                          src="/api/account/avatar"
                          alt={user.name ?? user.email}
                          className="rounded-lg"
                        />
                      )}
                      <AvatarFallback className="rounded-lg bg-primary/10 text-primary font-semibold text-sm">
                        {initial}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold truncate">
                        {user.name ?? "Account"}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {user.email}
                      </p>
                    </div>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/dashboard/account" className="cursor-pointer">
                    <User className="h-4 w-4 mr-2" />
                    Profile
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link
                    href="/dashboard/account/billing"
                    className="cursor-pointer"
                  >
                    <CreditCard className="h-4 w-4 mr-2" />
                    Billing
                  </Link>
                </DropdownMenuItem>
                {isAdmin && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                      <Link href="/admin" className="cursor-pointer">
                        <Shield className="h-4 w-4 mr-2" />
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
                  className="cursor-pointer text-destructive focus:text-destructive"
                >
                  <LogOut className="h-4 w-4 mr-2" />
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
