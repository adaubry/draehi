"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { usePathname } from "next/navigation";

export type NavHistory = {
  currentPath: string;
  previousPath: string | null;
  n2Path: string | null;
};

type NavigationContextType = {
  history: NavHistory;
  workspaceSlug: string;
};

const NavigationContext = createContext<NavigationContextType | undefined>(undefined);

export function NavigationProvider({
  children,
  workspaceSlug,
}: {
  children: React.ReactNode;
  workspaceSlug: string;
}) {
  const pathname = usePathname();
  const [history, setHistory] = useState<NavHistory>({
    currentPath: "",
    previousPath: null,
    n2Path: null,
  });

  // Initialize on mount
  useEffect(() => {
    const storageKey = `draehi-nav-history-${workspaceSlug}`;
    const stored = localStorage.getItem(storageKey);

    if (stored) {
      try {
        setHistory(JSON.parse(stored));
      } catch {
        setHistory({
          currentPath: pathname,
          previousPath: null,
          n2Path: null,
        });
      }
    } else {
      setHistory({
        currentPath: pathname,
        previousPath: null,
        n2Path: null,
      });
    }
  }, []);

  // Update history on pathname change
  useEffect(() => {
    setHistory((prev) => {
      const storageKey = `draehi-nav-history-${workspaceSlug}`;

      // Only update if path actually changed
      if (prev.currentPath === pathname) {
        return prev;
      }

      const updated: NavHistory = {
        currentPath: pathname,
        previousPath: prev.currentPath,
        n2Path: prev.previousPath,
      };

      // Persist to sessionStorage
      try {
        localStorage.setItem(storageKey, JSON.stringify(updated));
      } catch {
        // Storage quota exceeded or storage disabled
      }

      return updated;
    });
  }, [pathname, workspaceSlug]);

  return (
    <NavigationContext.Provider value={{ history, workspaceSlug }}>
      {children}
    </NavigationContext.Provider>
  );
}

export function useNavigation() {
  const context = useContext(NavigationContext);
  if (!context) {
    throw new Error("useNavigation must be used within NavigationProvider");
  }
  return context;
}

export function useNavigationHistory() {
  const { history } = useNavigation();
  return history;
}
