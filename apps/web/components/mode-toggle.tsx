"use client";

import { CheckIcon, MonitorIcon, MoonIcon, SunIcon } from "lucide-react";
import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { THEME_SECTIONS, THEMES } from "@/lib/themes";
import { cn } from "@/lib/utils";

const subscribeNoop = () => () => false;
const useMounted = () =>
  useSyncExternalStore(
    subscribeNoop,
    () => true,
    () => false
  );

const MiniPanel = ({ className }: { className?: string }) => (
  <span className={cn("bg-background flex h-full w-full", className)}>
    <span className="bg-sidebar border-border/60 flex w-1/4 flex-col gap-1 border-r p-1.5">
      <span className="bg-primary h-1 rounded-full" />
      <span className="bg-muted-foreground/40 h-1 rounded-full" />
      <span className="bg-muted-foreground/40 h-1 rounded-full" />
    </span>
    <span className="flex flex-1 flex-col gap-1.5 p-2">
      <span className="bg-card border-border/60 flex-1 rounded-sm border" />
      <span className="bg-primary h-2 w-1/2 rounded-full" />
    </span>
  </span>
);

const ThemeCard = ({
  active,
  children,
  label,
  onSelect,
}: {
  active: boolean;
  children: ReactNode;
  label: string;
  onSelect: () => void;
}) => (
  <button
    aria-pressed={active}
    className={cn(
      "hover:bg-accent/20 flex flex-col gap-1.5 rounded-xl p-1.5 text-left transition-colors",
      active && "bg-accent/10"
    )}
    onClick={onSelect}
    type="button"
  >
    <span
      className={cn(
        "border-border relative block h-16 w-full overflow-hidden rounded-lg border",
        active && "ring-link ring-2"
      )}
    >
      {children}
      {active && (
        <span className="bg-link text-background absolute top-1 right-1 flex size-4 items-center justify-center rounded-full">
          <CheckIcon className="size-3" />
        </span>
      )}
    </span>
    <span className="truncate px-0.5 text-xs font-medium">{label}</span>
  </button>
);

const GRID = "grid grid-cols-2 gap-1 sm:grid-cols-3 md:grid-cols-4";

const TriggerIcon = ({ theme }: { theme: string | undefined }) => {
  if (theme === "light") {
    return <SunIcon className="size-[1.1rem]" />;
  }
  if (theme === "dark") {
    return <MoonIcon className="size-[1.1rem]" />;
  }
  if (!theme || theme === "system") {
    return <MonitorIcon className="size-[1.1rem]" />;
  }
  return (
    <span
      className={cn(
        theme,
        "bg-primary border-border size-4 rounded-full border"
      )}
    />
  );
};

export const ModeToggle = () => {
  const { theme, setTheme } = useTheme();
  const mounted = useMounted();

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          className="text-muted-foreground shrink-0"
          size="icon"
          title="Change theme"
          variant="ghost"
        >
          <TriggerIcon theme={mounted ? theme : undefined} />
          <span className="sr-only">Change theme</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Appearance</DialogTitle>
          <DialogDescription>
            Pick a theme. It changes straight away and is saved on this device.
          </DialogDescription>
        </DialogHeader>
        <section className="flex flex-col gap-2">
          <h3 className="text-muted-foreground text-xs font-medium">Mode</h3>
          <div className={GRID}>
            <ThemeCard
              active={theme === "system"}
              label="System"
              onSelect={() => setTheme("system")}
            >
              <span className="flex h-full">
                <span className="w-1/2 overflow-hidden">
                  <MiniPanel className="light w-[200%]" />
                </span>
                <span className="w-1/2 overflow-hidden">
                  <MiniPanel className="dark w-[200%]" />
                </span>
              </span>
            </ThemeCard>
            <ThemeCard
              active={theme === "light"}
              label="Light"
              onSelect={() => setTheme("light")}
            >
              <MiniPanel className="light" />
            </ThemeCard>
            <ThemeCard
              active={theme === "dark"}
              label="Dark"
              onSelect={() => setTheme("dark")}
            >
              <MiniPanel className="dark" />
            </ThemeCard>
          </div>
        </section>
        {THEME_SECTIONS.map((section) => (
          <section className="flex flex-col gap-2" key={section.key}>
            <h3 className="text-muted-foreground text-xs font-medium">
              {section.label}
            </h3>
            <div className={GRID}>
              {THEMES[section.key].map((entry) => (
                <ThemeCard
                  active={theme === entry.value}
                  key={entry.value}
                  label={entry.label}
                  onSelect={() => setTheme(entry.value)}
                >
                  <MiniPanel className={entry.value} />
                </ThemeCard>
              ))}
            </div>
          </section>
        ))}
      </DialogContent>
    </Dialog>
  );
};
