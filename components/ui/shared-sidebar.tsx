"use client";

import type { ReactNode } from "react";
import {
  ChevronsUpDown,
  LogOut,
  User,
} from "lucide-react";
import Link from "next/link";

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
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { signOut } from "@/lib/auth-client";

export interface SidebarUserConfig {
  name: string | null;
  email: string;
  hasImage: boolean;
  role: string;
  superAdmin: boolean;
}

export interface SharedSidebarProps {
  user: SidebarUserConfig;
  headerTitle: string;
  headerSubtitle: string;
  headerHref: string;
  children: ReactNode;
  showAdminLink?: boolean;
  onSignOut?: () => Promise<void>;
}

export const SharedSidebar = ({
  user,
  headerTitle,
  headerSubtitle,
  headerHref,
  children,
  showAdminLink = false,
  onSignOut,
}: SharedSidebarProps) => {
  const initial = (user.name ?? user.email ?? "?").charAt(0).toUpperCase();
  const isAdmin = user.superAdmin || user.role === "admin";

  const handleSignOut = async () => {
    if (onSignOut) {
      await onSignOut();
    } else {
      await signOut();
    }
  };

  return (
    <Sidebar collapsible="offcanvas" className="border-none">
      {/* Header */}
      <SidebarHeader className="border-b border-border/40 px-4 py-3.5">
        <Link
          href={headerHref}
          className="flex items-center gap-2.5 rounded-lg transition-opacity hover:opacity-80"
        >
          <Logo className="h-5 w-auto text-sidebar-foreground" />
          <div className="flex flex-col leading-tight group-data-[collapsible=icon]:hidden">
            <span className="text-sm font-bold tracking-tight text-sidebar-foreground">
              {headerTitle}
            </span>
            <span className="text-xs text-muted-foreground">{headerSubtitle}</span>
          </div>
        </Link>
      </SidebarHeader>

      {/* Main Content */}
      <SidebarContent className="px-0">{children}</SidebarContent>

      {/* Footer */}
      <SidebarFooter className="border-t border-border/40 px-0 py-2 gap-0">
        {/* Theme Selector */}
        <SidebarMenu className="px-2 gap-1">
          <SidebarMenuItem>
            <div className="flex items-center justify-between rounded-lg px-3 py-2.5 text-xs font-medium text-muted-foreground hover:bg-muted/50 transition-colors group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-2">
              <span className="group-data-[collapsible=icon]:hidden">Theme</span>
              <ModeToggle />
            </div>
          </SidebarMenuItem>
        </SidebarMenu>

        {/* User Menu */}
        <SidebarMenu className="px-2 gap-0">
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton
                  size="lg"
                  className="rounded-lg"
                  tooltip={user.email}
                >
                  <Avatar className="h-8 w-8 rounded-lg">
                    {user.hasImage && (
                      <AvatarImage
                        src="/api/account/avatar"
                        alt={user.name ?? user.email}
                        className="rounded-lg"
                      />
                    )}
                    <AvatarFallback className="rounded-lg bg-sidebar-accent text-sidebar-accent-foreground font-semibold">
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
                  <ChevronsUpDown className="ml-auto h-4 w-4 opacity-50 group-data-[collapsible=icon]:hidden" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                side="top"
                align="end"
                className="w-56"
              >
                {/* User Info */}
                <DropdownMenuLabel className="font-normal">
                  <div className="grid text-left leading-tight">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold">
                        {user.name ?? user.email}
                      </span>
                      {user.superAdmin && (
                        <Badge variant="secondary" className="text-[10px]">
                          Super Admin
                        </Badge>
                      )}
                      {!user.superAdmin && user.role === "admin" && (
                        <Badge variant="secondary" className="text-[10px]">
                          Admin
                        </Badge>
                      )}
                    </div>
                    <span className="truncate text-xs text-muted-foreground">
                      {user.email}
                    </span>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />

                {/* Menu Items */}
                <DropdownMenuItem asChild>
                  <Link href="/dashboard/account" className="cursor-pointer">
                    <User className="h-4 w-4 mr-2" />
                    <span>Account Settings</span>
                  </Link>
                </DropdownMenuItem>

                {showAdminLink && isAdmin && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                      <Link href="/admin" className="cursor-pointer">
                        <span>Admin Panel</span>
                      </Link>
                    </DropdownMenuItem>
                  </>
                )}

                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={async () => {
                    await handleSignOut();
                  }}
                  className="cursor-pointer text-destructive"
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  <span>Sign Out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
};
