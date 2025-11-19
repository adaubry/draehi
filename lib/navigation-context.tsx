"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { usePathname } from "next/navigation";

export type NavHistory = {
  before: string | null;
  after: string;
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
    before: null,
    after: "",
  });

  // Initialize on mount
  useEffect(() => {
    const storageKey = `draehi_navigation_history`;
    const stored = localStorage.getItem(storageKey);

    if (stored) {
      try {
        setHistory(JSON.parse(stored));
      } catch {
        setHistory({
          before: null,
          after: pathname,
        });
      }
    } else {
      setHistory({
        before: null,
        after: pathname,
      });
    }
  }, []);

  // Update history on pathname change
  useEffect(() => {
    setHistory((prev) => {
      const storageKey = `draehi_navigation_history`;

      // Only update if path actually changed
      if (prev.after === pathname) {
        return prev;
      }

      const updated: NavHistory = {
        before: prev.after,
        after: pathname,
      };

      // Persist to localStorage
      try {
        localStorage.setItem(storageKey, JSON.stringify(updated));
      } catch {
        // Storage quota exceeded or storage disabled
      }

      return updated;
    });
  }, [pathname]);

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
