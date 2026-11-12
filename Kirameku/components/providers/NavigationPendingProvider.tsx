"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";

type NavigationPendingContextValue = {
  pendingHref: string | null;
  displayPath: string;
  beginNavigation: (href: string) => void;
};

const NavigationPendingContext =
  createContext<NavigationPendingContextValue | undefined>(undefined);

export function normalizePathname(href: string): string {
  if (!href) return "/";
  let path = href.trim();
  const hashIdx = path.indexOf("#");
  if (hashIdx >= 0) path = path.slice(0, hashIdx);
  const queryIdx = path.indexOf("?");
  if (queryIdx >= 0) path = path.slice(0, queryIdx);
  if (
    path.startsWith("http://") ||
    path.startsWith("https://") ||
    path.startsWith("//")
  ) {
    try {
      const url = path.startsWith("//") ? new URL(`https:${path}`) : new URL(path);
      path = url.pathname;
    } catch {
      // keep as-is
    }
  }
  if (!path.startsWith("/")) path = `/${path}`;
  if (path.length > 1 && path.endsWith("/")) path = path.slice(0, -1);
  return path || "/";
}

export function isSameRoute(a: string, b: string): boolean {
  return normalizePathname(a) === normalizePathname(b);
}

export function isExcludedShellPath(pathname: string): boolean {
  const p = normalizePathname(pathname);
  return p === "/garden" || p.startsWith("/garden/") || p === "/auth" || p.startsWith("/auth/");
}

export function isPublicSitePath(pathname: string): boolean {
  const p = normalizePathname(pathname);
  if (isExcludedShellPath(p)) return false;
  if (p === "/api" || p.startsWith("/api/")) return false;
  if (p === "/feed" || p.startsWith("/feed/")) return false;
  return true;
}

function isInternalHref(href: string): boolean {
  const value = href.trim();
  if (!value) return false;
  if (
    value.startsWith("mailto:") ||
    value.startsWith("tel:") ||
    value.startsWith("javascript:")
  ) {
    return false;
  }
  if (value.startsWith("#")) return false;
  if (value.startsWith("/")) return true;
  if (
    value.startsWith("http://") ||
    value.startsWith("https://") ||
    value.startsWith("//")
  ) {
    if (typeof window === "undefined") return false;
    try {
      const url = value.startsWith("//")
        ? new URL(`https:${value}`)
        : new URL(value);
      return url.origin === window.location.origin;
    } catch {
      return false;
    }
  }
  return true;
}

export function NavigationPendingProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [pendingHref, setPendingHref] = useState<string | null>(null);

  const displayPath = pendingHref ?? pathname;

  const beginNavigation = useCallback(
    (href: string) => {
      const target = normalizePathname(href);
      if (!isPublicSitePath(target)) return;
      if (pendingHref && isSameRoute(target, pendingHref)) return;
      if (isSameRoute(target, pathname)) {
        if (pendingHref) setPendingHref(null);
        return;
      }
      setPendingHref(target);
    },
    [pathname, pendingHref]
  );

  useEffect(() => {
    if (!pendingHref) return;
    if (isSameRoute(pathname, pendingHref)) {
      setPendingHref(null);
    }
  }, [pathname, pendingHref]);

  useEffect(() => {
    const clearPending = () => setPendingHref(null);
    window.addEventListener("popstate", clearPending);
    return () => window.removeEventListener("popstate", clearPending);
  }, []);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const target = event.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest("a[href]");
      if (!(anchor instanceof HTMLAnchorElement)) return;
      if (anchor.target && anchor.target !== "_self") return;
      if (anchor.hasAttribute("download")) return;
      const href = anchor.getAttribute("href");
      if (!href || !isInternalHref(href)) return;
      beginNavigation(href);
    };
    // Capture so we run before Next.js <Link> preventDefault.
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [beginNavigation]);

  const value = useMemo(
    () => ({ pendingHref, displayPath, beginNavigation }),
    [pendingHref, displayPath, beginNavigation]
  );

  return (
    <NavigationPendingContext.Provider value={value}>
      {children}
    </NavigationPendingContext.Provider>
  );
}

export function useNavigationPending(): NavigationPendingContextValue {
  const ctx = useContext(NavigationPendingContext);
  if (!ctx) {
    throw new Error("useNavigationPending must be used within NavigationPendingProvider");
  }
  return ctx;
}
