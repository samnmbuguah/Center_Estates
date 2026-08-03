"use client";

import React from "react";
import NextLink, { LinkProps as NextLinkProps } from "next/link";

export function remapSpaRoute(target: string): string {
  if (!target || target.startsWith("#") || target.startsWith("http")) return target;

  const variationsMatch = target.match(/^\/(?:app\/)?projects\/([^/]+)\/variations/);
  if (variationsMatch) return `/monitoring?tab=variations&projectId=${variationsMatch[1]}`;

  const boqMatch = target.match(/^\/(?:app\/)?projects\/([^/]+)\/boq-review/);
  if (boqMatch) return `/monitoring?tab=boq-review&projectId=${boqMatch[1]}`;

  const contingencyMatch = target.match(/^\/(?:app\/)?projects\/([^/]+)\/contingency-drawdowns/);
  if (contingencyMatch) return `/monitoring?tab=contingency-drawdowns&projectId=${contingencyMatch[1]}`;

  if (target.includes("pending-verification") || target.includes("pending-verifications")) {
    return "/monitoring?tab=pending-verification";
  }

  const projectDetailMatch = target.match(/^\/(?:app\/)?projects\/([^/]+)$/);
  if (projectDetailMatch) return `/monitoring?tab=project-detail&id=${projectDetailMatch[1]}`;

  return target;
}

export function Link({
  to,
  href,
  children,
  ...props
}: {
  to?: string;
  href?: string;
  children: React.ReactNode;
  [key: string]: any;
}) {
  const target = remapSpaRoute(href || to || "#");
  return (
    <NextLink href={target} {...props}>
      {children}
    </NextLink>
  );
}

export function useParams<T extends Record<string, string | undefined> = Record<string, string | undefined>>(): T {
  if (typeof window === "undefined") return {} as T;
  const parts = window.location.pathname.split("/").filter(Boolean);
  const searchParams = new URLSearchParams(window.location.search);
  const params: Record<string, string> = {};
  if (searchParams.get("projectId")) {
    params.id = searchParams.get("projectId")!;
    params.projectId = searchParams.get("projectId")!;
  } else if (searchParams.get("id")) {
    params.id = searchParams.get("id")!;
    params.projectId = searchParams.get("id")!;
  } else if (parts.length >= 3 && parts[0] === "monitoring" && parts[1] === "projects") {
    params.id = parts[2];
    params.projectId = parts[2];
  }
  return params as T;
}

export function useNavigate() {
  return (to: string | number, options?: { replace?: boolean }) => {
    if (typeof window === "undefined") return;
    if (typeof to === "number") {
      window.history.go(to);
    } else {
      const target = remapSpaRoute(String(to));
      if (options?.replace) {
        window.history.replaceState({}, "", target);
      } else {
        window.location.href = target;
      }
    }
  };
}


export function useLocation() {
  if (typeof window === "undefined") return { pathname: "/monitoring", search: "", hash: "" };
  return {
    pathname: window.location.pathname,
    search: window.location.search,
    hash: window.location.hash,
  };
}

export function useSearchParams(): [URLSearchParams, (params: Record<string, string>, opts?: { replace?: boolean }) => void] {
  if (typeof window === "undefined") return [new URLSearchParams(), () => {}];
  const searchParams = new URLSearchParams(window.location.search);
  const setSearchParams = (newParams: Record<string, string>, opts?: { replace?: boolean }) => {
    const sp = new URLSearchParams(newParams);
    const newUrl = `${window.location.pathname}?${sp.toString()}`;
    if (opts?.replace) {
      window.history.replaceState({}, "", newUrl);
    } else {
      window.history.pushState({}, "", newUrl);
    }
  };
  return [searchParams, setSearchParams];
}


export function useOutletContext<T = any>(): T {
  return {} as T;
}

export function NavLink({
  to,
  children,
  className,
  ...props
}: {
  to: string;
  children: React.ReactNode;
  className?: string | ((props: { isActive: boolean }) => string);
  [key: string]: any;
}) {
  const loc = useLocation();
  const isActive = loc.pathname === to;
  const cls = typeof className === "function" ? className({ isActive }) : className;
  return (
    <Link to={to} className={cls} {...props}>
      {children}
    </Link>
  );
}


export function Outlet() {
  return null;
}
