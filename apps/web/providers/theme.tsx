import type { ThemeProviderProps } from "next-themes";
import { ThemeProvider as NextThemeProvider } from "next-themes";

export const ALL_THEMES = [
  "light",
  "dark",
  "midnight",
  "rose",
  "forest",
  "desert",
  "ocean",
  "slate",
  "crimson",
  "emerald",
  "amber",
  "teal",
  "lavender",
  "violet",
  "catppuccin-mocha",
  "catppuccin-macchiato",
  "catppuccin-frappe",
  "catppuccin-latte",
  "dracula",
  "nord",
  "gruvbox",
  "solarized",
  "tokyo-night",
  "one-dark",
  "rose-pine",
  "stranger",
  "christmas",
  "newyear",
] as const;

export type AppTheme = (typeof ALL_THEMES)[number];

export const ThemeProvider = ({
  children,
  ...properties
}: ThemeProviderProps) => (
  <NextThemeProvider
    attribute="class"
    defaultTheme="system"
    enableSystem
    disableTransitionOnChange
    themes={[...ALL_THEMES]}
    {...properties}
  >
    {children}
  </NextThemeProvider>
);
