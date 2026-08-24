import type { Metadata } from "next";
import { Suspense } from "react";
import { AppRouterCacheProvider } from "@mui/material-nextjs/v16-appRouter";
import "./globals.css";
import PlatformShell from "@/components/platform-shell";
import { AuthProvider } from "@/components/auth-provider";
import { ToastProvider } from "@/components/monitoring/hooks/useToast";
import { ToastContainer } from "@/components/monitoring/components/Toast";
import { FormRecoveryProvider } from "@/components/form-recovery-provider";
import { ErrorBoundary } from "@/components/error-boundary";
import { PropertyWorkspaceProvider } from "@/lib/property-context";
import { ThemeProvider } from "@/theme/theme-provider";
import ChunkErrorRecovery from "@/components/chunk-error-recovery";
import ErrorMonitoring from "@/components/error-monitoring";
import { ToastCenter } from "@/components/toast-center";

export const metadata: Metadata = {
  title: "CeEst ERP",
  description: "Unified estate and property operations platform",
  icons: {
    icon: [
      { url: "/logo.png", type: "image/png" },
      { url: "/favicon.ico" },
    ],
    shortcut: "/logo.png",
    apple: "/logo.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased" data-theme="light">
      <head>
        <link rel="icon" href="/logo.png" type="image/png" />
        <link rel="shortcut icon" href="/logo.png" />
        <link rel="apple-touch-icon" href="/logo.png" />
      </head>
      <body>
        <ChunkErrorRecovery />
        <ErrorMonitoring />
        <AppRouterCacheProvider>
          <AuthProvider>
            <ThemeProvider>
              <ToastProvider>
                <ToastContainer />
                <ToastCenter />
                <FormRecoveryProvider><PropertyWorkspaceProvider>
                  <Suspense fallback={null}>
                    <PlatformShell>
                      <ErrorBoundary moduleName="Application">
                        {children}
                      </ErrorBoundary>
                    </PlatformShell>
                  </Suspense>
                </PropertyWorkspaceProvider></FormRecoveryProvider>
              </ToastProvider>
            </ThemeProvider>
          </AuthProvider>
        </AppRouterCacheProvider>
      </body>
    </html>
  );
}
