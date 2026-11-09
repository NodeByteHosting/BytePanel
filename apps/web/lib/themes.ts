export const THEMES = {
  catppuccin: [
    { label: "Mocha", value: "catppuccin-mocha" },
    { label: "Macchiato", value: "catppuccin-macchiato" },
    { label: "Frappé", value: "catppuccin-frappe" },
    { label: "Latte", value: "catppuccin-latte" },
  ],
  palette: [
    { label: "Slate", value: "slate" },
    { label: "Ocean", value: "ocean" },
    { label: "Midnight", value: "midnight" },
    { label: "Teal", value: "teal" },
    { label: "Lavender", value: "lavender" },
    { label: "Violet", value: "violet" },
    { label: "Rose", value: "rose" },
    { label: "Amber", value: "amber" },
    { label: "Desert", value: "desert" },
    { label: "Forest", value: "forest" },
    { label: "Emerald", value: "emerald" },
    { label: "Crimson", value: "crimson" },
    { label: "Cobalt", value: "cobalt" },
    { label: "Sakura", value: "sakura" },
    { label: "Copper", value: "copper" },
    { label: "Abyss", value: "abyss" },
  ],
  popular: [
    { label: "Dracula", value: "dracula" },
    { label: "Nord", value: "nord" },
    { label: "Gruvbox", value: "gruvbox" },
    { label: "Solarized", value: "solarized" },
    { label: "Tokyo Night", value: "tokyo-night" },
    { label: "One Dark", value: "one-dark" },
    { label: "Rosé Pine", value: "rose-pine" },
    { label: "Kanagawa", value: "kanagawa" },
    { label: "Everforest", value: "everforest" },
    { label: "Monokai", value: "monokai" },
  ],
  seasonal: [
    { label: "Christmas", value: "christmas" },
    { label: "New Year", value: "newyear" },
    { label: "Winter", value: "winter" },
    { label: "St. Pat's", value: "stpatricks" },
    { label: "Easter", value: "easter" },
    { label: "Spring", value: "spring" },
    { label: "Summer", value: "summer" },
    { label: "4th July", value: "fourthjuly" },
    { label: "Halloween", value: "halloween" },
    { label: "Autumn", value: "autumn" },
    { label: "Thanks.", value: "thanksgiving" },
    { label: "Valentine's", value: "valentines" },
    { label: "Stranger", value: "stranger" },
  ],
} as const;

export const THEME_SECTIONS: { key: keyof typeof THEMES; label: string }[] = [
  { key: "catppuccin", label: "Catppuccin" },
  { key: "popular", label: "Popular" },
  { key: "palette", label: "Palette" },
  { key: "seasonal", label: "Seasonal" },
];

export const THEME_VALUES: string[] = [
  "light",
  "dark",
  ...Object.values(THEMES)
    .flat()
    .map((theme) => theme.value),
];
