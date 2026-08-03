import type { Metadata } from "next";
import "./globals.css";
import { PlatformShell } from "@/components/platform-shell";
import { AuthProvider } from "@/components/auth-provider";
import { ToastProvider } from "@/components/monitoring/hooks/useToast";

export const metadata: Metadata = {
  title: "Center Estates ERP",
  description: "Unified estate and property operations platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body>
        <AuthProvider>
          <ToastProvider>
            <PlatformShell>{children}</PlatformShell>
          </ToastProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
