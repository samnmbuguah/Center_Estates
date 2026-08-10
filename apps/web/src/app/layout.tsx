import type { Metadata } from "next";
import { Suspense } from "react";
import "./globals.css";
import PlatformShell from "@/components/platform-shell";
import { AuthProvider } from "@/components/auth-provider";
import { ToastProvider } from "@/components/monitoring/hooks/useToast";
import { ErrorBoundary } from "@/components/error-boundary";
import { PropertyWorkspaceProvider } from "@/lib/property-context";
import { ThemeProvider } from "@/theme/theme-provider";

export const metadata: Metadata = {
  title: "Center Estates ERP",
  description: "Unified estate and property operations platform",
  icons: { icon: "/logo.png", shortcut: "/logo.png", apple: "/logo.png" },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased" data-theme="light">
      <body>
        <AuthProvider>
          <ThemeProvider>
            <ToastProvider>
              <PropertyWorkspaceProvider>
                <Suspense fallback={null}>
                  <PlatformShell>
                    <ErrorBoundary moduleName="Application">
                      {children}
                    </ErrorBoundary>
                  </PlatformShell>
                </Suspense>
              </PropertyWorkspaceProvider>
            </ToastProvider>
          </ThemeProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
