import type { Metadata } from "next";
import "./globals.css";
import { PlatformShell } from "@/components/platform-shell";
import { AuthProvider } from "@/components/auth-provider";

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
      <body><AuthProvider><PlatformShell>{children}</PlatformShell></AuthProvider></body>
    </html>
  );
}
