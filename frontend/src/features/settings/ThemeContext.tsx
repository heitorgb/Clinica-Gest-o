import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

type ThemeMode = "light" | "dark";

type ThemeContextValue = {
  isDarkMode: boolean;
  setTheme: (theme: ThemeMode) => void;
  theme: ThemeMode;
  toggleTheme: () => void;
};

const storageKey = "clinica-theme";

const ThemeContext = createContext<ThemeContextValue | null>(null);

function getInitialTheme(): ThemeMode {
  if (typeof window === "undefined") {
    return "light";
  }

  const storedTheme = window.localStorage.getItem(storageKey);

  if (storedTheme === "light" || storedTheme === "dark") {
    return storedTheme;
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeMode>(getInitialTheme);

  useEffect(() => {
    const root = document.documentElement;
    const isDarkMode = theme === "dark";

    root.classList.toggle("dark", isDarkMode);
    root.style.colorScheme = isDarkMode ? "dark" : "light";
    window.localStorage.setItem(storageKey, theme);
  }, [theme]);

  const value = useMemo<ThemeContextValue>(
    () => ({
      isDarkMode: theme === "dark",
      setTheme: setThemeState,
      theme,
      toggleTheme: () => setThemeState((current) => (current === "dark" ? "light" : "dark")),
    }),
    [theme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error("useTheme deve ser usado dentro de ThemeProvider.");
  }

  return context;
}
