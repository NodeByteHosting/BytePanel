"use client";

import {
  CheckIcon,
  MonitorIcon,
  MoonIcon,
  PaletteIcon,
  SunIcon,
} from "lucide-react";
import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

// [primary, accent] colors per theme — used for preview swatches
const THEME_COLORS: Record<string, [string, string]> = {
  amber: ["oklch(0.46 0.18 60)", "oklch(0.52 0.16 50)"],
  "catppuccin-frappe": ["#8caaee", "#ca9ee6"],
  "catppuccin-latte": ["#1e66f5", "#8839ef"],
  "catppuccin-macchiato": ["#8aadf4", "#c6a0f6"],
  "catppuccin-mocha": ["#89b4fa", "#cba6f7"],
  christmas: ["#c4122e", "#ffd700"],
  crimson: ["oklch(0.52 0.22 20)", "oklch(0.58 0.20 15)"],
  dark: ["oklch(0.55 0.16 235)", "oklch(0.55 0.12 200)"],
  desert: ["oklch(0.43 0.18 44)", "oklch(0.55 0.16 30)"],
  dracula: ["#bd93f9", "#ff79c6"],
  emerald: ["oklch(0.42 0.18 160)", "oklch(0.48 0.16 165)"],
  forest: ["oklch(0.45 0.16 140)", "oklch(0.48 0.14 150)"],
  gruvbox: ["#fabd2f", "#d65d0e"],
  lavender: ["oklch(0.56 0.18 290)", "oklch(0.62 0.16 280)"],
  light: ["oklch(0.28 0.12 230)", "oklch(0.65 0.15 200)"],
  midnight: ["oklch(0.48 0.18 240)", "oklch(0.6 0.16 210)"],
  newyear: ["#ffd166", "#ff6b6b"],
  nord: ["#88c0d0", "#81a1c1"],
  ocean: ["oklch(0.5 0.16 200)", "oklch(0.62 0.16 190)"],
  "one-dark": ["#61afef", "#c678dd"],
  rose: ["oklch(0.55 0.18 340)", "oklch(0.6 0.18 330)"],
  "rose-pine": ["#c4a7e7", "#ebbcba"],
  slate: ["oklch(0.50 0.10 240)", "oklch(0.56 0.12 220)"],
  solarized: ["#268bd2", "#2aa198"],
  stranger: ["#ff2d55", "#ff4d94"],
  teal: ["oklch(0.44 0.16 180)", "oklch(0.50 0.14 175)"],
  "tokyo-night": ["#7aa2f7", "#bb9af7"],
  violet: ["oklch(0.58 0.20 280)", "oklch(0.64 0.18 270)"],
};

const THEME_GROUPS = [
  {
    label: "System",
    themes: [
      { icon: MonitorIcon, label: "System (device)", value: "system" },
      { icon: SunIcon, label: "Light", value: "light" },
      { icon: MoonIcon, label: "Dark", value: "dark" },
    ],
  },
  {
    label: "Palette",
    themes: [
      { label: "Midnight", value: "midnight" },
      { label: "Rose", value: "rose" },
      { label: "Forest", value: "forest" },
      { label: "Desert", value: "desert" },
      { label: "Ocean", value: "ocean" },
      { label: "Slate", value: "slate" },
      { label: "Crimson", value: "crimson" },
      { label: "Emerald", value: "emerald" },
      { label: "Amber", value: "amber" },
      { label: "Teal", value: "teal" },
      { label: "Lavender", value: "lavender" },
      { label: "Violet", value: "violet" },
    ],
  },
  {
    label: "Popular",
    themes: [
      { label: "Catppuccin Mocha", value: "catppuccin-mocha" },
      { label: "Catppuccin Macchiato", value: "catppuccin-macchiato" },
      { label: "Catppuccin Frappé", value: "catppuccin-frappe" },
      { label: "Catppuccin Latte", value: "catppuccin-latte" },
      { label: "Dracula", value: "dracula" },
      { label: "Nord", value: "nord" },
      { label: "Gruvbox", value: "gruvbox" },
      { label: "Solarized", value: "solarized" },
      { label: "Tokyo Night", value: "tokyo-night" },
      { label: "One Dark", value: "one-dark" },
      { label: "Rosé Pine", value: "rose-pine" },
    ],
  },
  {
    label: "Seasonal",
    themes: [
      { label: "Stranger Things", value: "stranger" },
      { label: "Christmas", value: "christmas" },
      { label: "New Year", value: "newyear" },
    ],
  },
] as const;

/** Two-dot color pill previewing a theme's primary + accent colors */
const ThemeSwatch = ({ value }: { value: string }) => {
  const colors = THEME_COLORS[value];
  if (!colors) {
    return null;
  }
  const [primary, accent] = colors;
  return (
    <span className="flex shrink-0 overflow-hidden rounded-full border border-white/10">
      <span className="block size-3.5" style={{ background: primary }} />
      <span className="block size-3.5" style={{ background: accent }} />
    </span>
  );
};

/** Split half-light / half-dark circle for the system theme */
const SystemSwatch = () => (
  <span
    className="size-3.5 shrink-0 overflow-hidden rounded-full border border-white/10"
    style={{
      background:
        "linear-gradient(to right, oklch(0.98 0.01 260) 50%, oklch(0.155 0.03 235) 50%)",
    }}
  />
);

// The theme is only known on the client: false during SSR/hydration, then true.
const subscribeNoop = () => () => {
  // Nothing to unsubscribe: mounted never changes after hydration.
};
const useMounted = () =>
  useSyncExternalStore(
    subscribeNoop,
    () => true,
    () => false
  );

const TriggerIcon = ({ theme }: { theme: string | undefined }) => {
  if (theme === "light") {
    return <SunIcon className="size-[1.1rem]" />;
  }
  if (theme === "dark") {
    return <MoonIcon className="size-[1.1rem]" />;
  }
  if (theme === "system") {
    return <MonitorIcon className="size-[1.1rem]" />;
  }
  return <PaletteIcon className="size-[1.1rem]" />;
};

export const ModeToggle = () => {
  const { theme, setTheme } = useTheme();
  const mounted = useMounted();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="text-muted-foreground shrink-0"
          title="Change theme"
        >
          <TriggerIcon theme={mounted ? theme : undefined} />
          <span className="sr-only">Change theme</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="max-h-[70vh] w-56 overflow-y-auto"
      >
        {THEME_GROUPS.map((group, i) => (
          <div key={group.label}>
            {i > 0 && <DropdownMenuSeparator />}
            <DropdownMenuLabel className="text-muted-foreground text-xs">
              {group.label}
            </DropdownMenuLabel>
            {group.themes.map(({ label, value, ...rest }) => {
              const Icon = "icon" in rest ? rest.icon : null;
              const active = theme === value;
              return (
                <DropdownMenuItem
                  key={value}
                  onClick={() => setTheme(value)}
                  className={cn(
                    "cursor-pointer gap-2",
                    active && "bg-accent/20 text-foreground font-medium"
                  )}
                >
                  {/* Left: icon or color swatch */}
                  {value === "system" && <SystemSwatch />}
                  {value !== "system" && Icon && (
                    <Icon className="text-muted-foreground size-3.5 shrink-0" />
                  )}
                  {value !== "system" && !Icon && <ThemeSwatch value={value} />}

                  <span className="flex-1 truncate text-sm">{label}</span>

                  {/* Right: checkmark when active */}
                  {active && (
                    <CheckIcon className="text-foreground size-3.5 shrink-0" />
                  )}
                </DropdownMenuItem>
              );
            })}
          </div>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
