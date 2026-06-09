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
    description: "Cool steel with electric blue accent",
    colors: {
      bgBase: "#161a20",
      bgSidebar: "#111519",
      bgTabbar: "#0c0f13",
      bgCard: "#1c2028",
      bgInput: "#232830",
      textPrimary: "#dce0e8",
      textSecondary: "#9aa2ac",
      textMuted: "#6d7580",
      textDim: "#505860",
      textFaint: "#3a4048",
      accent: "#58a6ff",
      border: "#2c3240",
      borderSubtle: "#232830",
      statusConnected: "#3fb950",
      statusWarning: "#d29922",
      statusDisconnected: "#f85149",
      scrollThumb: "#2c3240",
      scrollThumbHover: "#3a4250",
    },
  },
  {
    id: "github",
    name: "GitHub Dark",
    description: "GitHub-inspired dark with blue links",
    colors: {
      bgBase: "#0d1117",
      bgSidebar: "#090d12",
      bgTabbar: "#060a0e",
      bgCard: "#161b22",
      bgInput: "#21262d",
      textPrimary: "#e6edf3",
      textSecondary: "#9da5b0",
      textMuted: "#7d8590",
      textDim: "#545d68",
      textFaint: "#3d444d",
      accent: "#58a6ff",
      border: "#30363d",
      borderSubtle: "#21262d",
      statusConnected: "#3fb950",
      statusWarning: "#d29922",
      statusDisconnected: "#f85149",
      scrollThumb: "#30363d",
      scrollThumbHover: "#484f58",
    },
  },
  {
    id: "mono",
    name: "Monochrome",
    description: "Clean neutrals with white accent",
    colors: {
      bgBase: "#181818",
      bgSidebar: "#121212",
      bgTabbar: "#0c0c0c",
      bgCard: "#212121",
      bgInput: "#292929",
      textPrimary: "#e0e0e0",
      textSecondary: "#a0a0a0",
      textMuted: "#787878",
      textDim: "#585858",
      textFaint: "#404040",
      accent: "#e0e0e0",
      border: "#333333",
      borderSubtle: "#282828",
      statusConnected: "#8cc88c",
      statusWarning: "#d4b24a",
      statusDisconnected: "#d46a6a",
      scrollThumb: "#333333",
      scrollThumbHover: "#444444",
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
