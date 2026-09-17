export type Theme = "light" | "dark";

const KEY = "recan-flow-theme";

export function loadTheme(): Theme {
  if (typeof window === "undefined") return "light";
  const saved = localStorage.getItem(KEY);
  if (saved === "light" || saved === "dark") return saved;
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function saveTheme(theme: Theme) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, theme);
  document.documentElement.setAttribute("data-theme", theme);
}
