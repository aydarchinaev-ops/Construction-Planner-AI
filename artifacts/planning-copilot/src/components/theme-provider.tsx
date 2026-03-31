import React, { createContext, useContext, useEffect, useState } from "react";
import { type ThemeProviderProps } from "next-themes/dist/types";

const initialState = {
  theme: "system" as "light" | "dark" | "system",
  setTheme: () => null,
};

const ThemeProviderContext = createContext<typeof initialState>(initialState);

export function ThemeProvider({
  children,
  defaultTheme = "light",
  storageKey = "vite-ui-theme",
  ...props
}: ThemeProviderProps) {
  // Hardcode light theme per user spec
  const [theme, setTheme] = useState<"light" | "dark" | "system">("light");

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove("light", "dark");
    root.classList.add("light"); // Force light mode as base, customized by css
  }, []);

  const value = {
    theme,
    setTheme: (theme: "light" | "dark" | "system") => {
      // ignore
    },
  };

  return (
    <ThemeProviderContext.Provider {...props} value={value as any}>
      {children}
    </ThemeProviderContext.Provider>
  );
}

export const useTheme = () => {
  const context = useContext(ThemeProviderContext);
  if (context === undefined)
    throw new Error("useTheme must be used within a ThemeProvider");
  return context;
};