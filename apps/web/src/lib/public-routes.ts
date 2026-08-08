export const PUBLIC_ROUTES = [
  "/",
  "/login",
  "/sign-up",
  "/about",
  "/contact",
  "/pricing",
  "/product",
  "/demo",
  "/faq",
  "/docs",
  "/blog",
] as const;

export function isPublicRoute(pathname: string) {
  return PUBLIC_ROUTES.some(
    (path) => pathname === path || (path !== "/" && pathname.startsWith(`${path}/`)),
  );
}
