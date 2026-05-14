"use client";

import {
  ChevronsUpDown,
  HomeIcon,
  LayoutDashboard,
  LogOut,
  Plus,
  Server,
  Shield,
  User,
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
import { games } from "@/games";
import { signOut } from "@/lib/auth-client";
import { cn } from "@/lib/utils";

export interface SidebarServer {
  id: string;
  name: string;
  game: string;
  observedState: string;
  desiredState: string;
}

export interface SidebarUser {
  name: string | null;
  email: string;
  hasImage: boolean;
  role: string;
  superAdmin: boolean;
}

const statusDotClass = (state: string, deleting: boolean) => {
  if (deleting) {
    return "bg-destructive";
  }
  if (state === "running") {
    return "bg-emerald-500";
  }
  if (state === "failed" || state === "lost") {
    return "bg-destructive";
  }
  if (state === "unhealthy") {
    return "bg-amber-500";
  }
  return "bg-muted-foreground/40";
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

  return (
    <Sidebar collapsible="offcanvas" className="border-none">
      <SidebarHeader className="px-4 py-3">
        <Link
          href="/dashboard"
          className="flex items-center gap-2.5 rounded-lg transition-opacity hover:opacity-80"
        >
          <Logo className="h-5 w-auto text-sidebar-foreground" />
          <span className="text-sm font-semibold tracking-tight text-sidebar-foreground group-data-[collapsible=icon]:hidden">
            NodeByte
          </span>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={pathname === "/dashboard"}
                  tooltip="Dashboard"
                >
                  <Link href="/">
                    <HomeIcon />
                    <span>Home</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={pathname === "/dashboard"}
                  tooltip="Dashboard"
                >
                  <Link href="/dashboard">
                    <LayoutDashboard />
                    <span>Dashboard</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={pathname === "/dashboard/new"}
                  tooltip="New server"
                >
                  <Link href="/dashboard/new">
                    <Plus />
                    <span>New server</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Servers</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {servers.length === 0 ? (
                <SidebarMenuItem>
                  <div className="px-3 py-2 text-muted-foreground text-xs group-data-[collapsible=icon]:hidden">
                    No servers yet.
                  </div>
                </SidebarMenuItem>
              ) : (
                servers.map((server) => {
                  const href = `/dashboard/${server.id}`;
                  const game = games.find((g) => g.id === server.game);
                  const deleting = server.desiredState === "deleted";
                  return (
                    <SidebarMenuItem key={server.id}>
                      <SidebarMenuButton
                        asChild
                        isActive={pathname.startsWith(href)}
                        tooltip={server.name}
                      >
                        <Link href={href}>
                          {game ? (
                            <Image
                              src={game.image}
                              alt={game.name}
                              width={16}
                              height={16}
                              className="size-4 shrink-0 rounded-xs object-cover"
                            />
                          ) : (
                            <Server />
                          )}
                          <span className="flex-1 truncate">{server.name}</span>
                          <span
                            className={cn(
                              "size-2 shrink-0 rounded-full",
                              statusDotClass(server.observedState, deleting)
                            )}
                            aria-label={
                              deleting ? "deleting" : server.observedState
                            }
                          />
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

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <div className="flex items-center justify-between rounded-lg border border-border/50 bg-card/30 px-2.5 py-2 backdrop-blur-sm group-data-[collapsible=icon]:justify-center">
              <span className="text-muted-foreground text-xs group-data-[collapsible=icon]:hidden">
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
                      <span className="truncate text-muted-foreground text-xs">
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
                          className="text-[10px] px-1 py-0"
                        >
                          Super Admin
                        </Badge>
                      )}
                      {!user.superAdmin && user.role === "admin" && (
                        <Badge
                          variant="secondary"
                          className="text-[10px] px-1 py-0"
                        >
                          Admin
                        </Badge>
                      )}
                    </span>
                    <span className="truncate text-muted-foreground text-xs">
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
                {isAdmin && (
                  <DropdownMenuItem asChild>
                    <Link href="/admin">
                      <Shield />
                      Admin panel
                    </Link>
                  </DropdownMenuItem>
                )}
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
