"use client";

import React from "react";
import NextLink, { LinkProps as NextLinkProps } from "next/link";

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
  return (
    <NextLink href={href || to || "#"} {...props}>
      {children}
    </NextLink>
  );
}

export function useParams<T extends Record<string, string | undefined> = Record<string, string | undefined>>(): T {
  if (typeof window === "undefined") return {} as T;
  const parts = window.location.pathname.split("/").filter(Boolean);
  const params: Record<string, string> = {};
  if (parts.length >= 3 && parts[0] === "monitoring" && parts[1] === "projects") {
    params.id = parts[2];
    params.projectId = parts[2];
  }
  return params as T;
}

export function useNavigate() {
  return (to: string | number) => {
    if (typeof window === "undefined") return;
    if (typeof to === "number") {
      window.history.go(to);
    } else {
      window.location.href = String(to);
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
}: {
  to: string;
  children: React.ReactNode;
  className?: string | ((props: { isActive: boolean }) => string);
}) {
  const loc = useLocation();
  const isActive = loc.pathname === to;
  const cls = typeof className === "function" ? className({ isActive }) : className;
  return (
    <Link to={to} className={cls}>
      {children}
    </Link>
  );
}

export function Outlet() {
  return null;
}
