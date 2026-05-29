export interface ThemeColors {
  bgBase: string;
  bgSidebar: string;
  bgTabbar: string;
  bgCard: string;
  bgInput: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  textDim: string;
  textFaint: string;
  accent: string;
  border: string;
  borderSubtle: string;
  statusConnected: string;
  statusWarning: string;
  statusDisconnected: string;
  scrollThumb: string;
  scrollThumbHover: string;
}

export interface Theme {
  id: string;
  name: string;
  description: string;
  colors: ThemeColors;
}

export const themes: Theme[] = [
  {
    id: "ember",
    name: "Ember",
    description: "Warm dark with amber glow",
    colors: {
      bgBase: "#1a1a1a",
      bgSidebar: "#151515",
      bgTabbar: "#0e0e0e",
      bgCard: "#222222",
      bgInput: "#2a2a2a",
      textPrimary: "#e0e0e0",
      textSecondary: "#888888",
      textMuted: "#666666",
      textDim: "#555555",
      textFaint: "#444444",
      accent: "#d4a029",
      border: "#333333",
      borderSubtle: "#2a2a2a",
      statusConnected: "#44aa99",
      statusWarning: "#d4a029",
      statusDisconnected: "#cc4444",
      scrollThumb: "#333333",
      scrollThumbHover: "#444444",
    },
  },
  {
    id: "midnight",
    name: "Midnight",
    description: "Cool steel with a quiet blue pulse",
    colors: {
      bgBase: "#171a1e",
      bgSidebar: "#131619",
      bgTabbar: "#0d0f12",
      bgCard: "#1e2226",
      bgInput: "#252a2f",
      textPrimary: "#d4d8de",
      textSecondary: "#828990",
      textMuted: "#5c6369",
      textDim: "#4a5058",
      textFaint: "#3a3f45",
      accent: "#7aa2c7",
      border: "#2a2f35",
      borderSubtle: "#222730",
      statusConnected: "#6aab8e",
      statusWarning: "#c4a24e",
      statusDisconnected: "#b85c5c",
      scrollThumb: "#2a2f35",
      scrollThumbHover: "#363c43",
    },
  },
  {
    id: "github",
    name: "GitHub Dark",
    description: "Muted charcoal with soft blue links",
    colors: {
      bgBase: "#161a1f",
      bgSidebar: "#12161a",
      bgTabbar: "#0c0f13",
      bgCard: "#1d2127",
      bgInput: "#24292e",
      textPrimary: "#d6dae0",
      textSecondary: "#848b94",
      textMuted: "#636a72",
      textDim: "#525960",
      textFaint: "#3c4248",
      accent: "#89b4d4",
      border: "#2d3238",
      borderSubtle: "#24292e",
      statusConnected: "#6dab7f",
      statusWarning: "#c4a24e",
      statusDisconnected: "#c06a68",
      scrollThumb: "#2d3238",
      scrollThumbHover: "#393f46",
    },
  },
  {
    id: "mono",
    name: "Monochrome",
    description: "Pure neutrals, no color distraction",
    colors: {
      bgBase: "#181818",
      bgSidebar: "#131313",
      bgTabbar: "#0c0c0c",
      bgCard: "#202020",
      bgInput: "#272727",
      textPrimary: "#d5d5d5",
      textSecondary: "#8a8a8a",
      textMuted: "#636363",
      textDim: "#525252",
      textFaint: "#3e3e3e",
      accent: "#a8a8a8",
      border: "#2e2e2e",
      borderSubtle: "#262626",
      statusConnected: "#8a8a8a",
      statusWarning: "#8a8a8a",
      statusDisconnected: "#b07070",
      scrollThumb: "#2e2e2e",
      scrollThumbHover: "#3c3c3c",
    },
  },
];

const THEME_KEY = "devnotebook-theme";

export function getSavedThemeId(): string {
  try {
    return localStorage.getItem(THEME_KEY) || "ember";
  } catch {
    return "ember";
  }
}

export function saveThemeId(id: string): void {
  try {
    localStorage.setItem(THEME_KEY, id);
  } catch {
    // localStorage unavailable
  }
}

export function getThemeById(id: string): Theme {
  return themes.find((t) => t.id === id) || themes[0];
}

export function applyTheme(theme: Theme): void {
  const root = document.documentElement;
  const c = theme.colors;
  root.style.setProperty("--color-bg-base", c.bgBase);
  root.style.setProperty("--color-bg-sidebar", c.bgSidebar);
  root.style.setProperty("--color-bg-tabbar", c.bgTabbar);
  root.style.setProperty("--color-bg-card", c.bgCard);
  root.style.setProperty("--color-bg-input", c.bgInput);
  root.style.setProperty("--color-text-primary", c.textPrimary);
  root.style.setProperty("--color-text-secondary", c.textSecondary);
  root.style.setProperty("--color-text-muted", c.textMuted);
  root.style.setProperty("--color-text-dim", c.textDim);
  root.style.setProperty("--color-text-faint", c.textFaint);
  root.style.setProperty("--color-accent", c.accent);
  root.style.setProperty("--color-border", c.border);
  root.style.setProperty("--color-border-subtle", c.borderSubtle);
  root.style.setProperty("--color-status-connected", c.statusConnected);
  root.style.setProperty("--color-status-warning", c.statusWarning);
  root.style.setProperty("--color-status-disconnected", c.statusDisconnected);
  root.style.setProperty("--scroll-thumb", c.scrollThumb);
  root.style.setProperty("--scroll-thumb-hover", c.scrollThumbHover);
}
