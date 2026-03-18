"use client";

import { createContext, useContext, useState, useEffect, useCallback } from "react";

type ThemeMode = "light" | "dark" | "system";

interface ThemeContextType {
  theme: ThemeMode;
  setTheme: (t: ThemeMode) => void;
  isDark: boolean;
}

const ThemeContext = createContext<ThemeContextType | null>(null);

function getSystemDark() {
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function applyTheme(mode: ThemeMode) {
  const isDark = mode === "dark" || (mode === "system" && getSystemDark());
  document.documentElement.setAttribute("data-theme", isDark ? "dark" : "light");
  return isDark;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeMode>("light");
  const [isDark, setIsDark] = useState(false);

  // 초기 로드
  useEffect(() => {
    const saved = (localStorage.getItem("theme") as ThemeMode) || "light";
    setThemeState(saved);
    setIsDark(applyTheme(saved));
  }, []);

  // 시스템 테마 변경 감지
  useEffect(() => {
    if (theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => setIsDark(applyTheme("system"));
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [theme]);

  const setTheme = useCallback((mode: ThemeMode) => {
    setThemeState(mode);
    localStorage.setItem("theme", mode);
    setIsDark(applyTheme(mode));
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, isDark }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
