import { headers } from "next/headers";
import type { Metadata } from "next";
import { isSalesOnlyHost } from "@/lib/site-mode";
import { LoginForm } from "./LoginForm";

export async function generateMetadata(): Promise<Metadata> {
  const headerList = await headers();
  const host = headerList.get("x-forwarded-host") || headerList.get("host") || "";

  if (isSalesOnlyHost(host)) {
    return {
      title: "Sign In | Center Estates Sales & Client Portal",
      description: "Sign in to access your sales workspace, client portal, or agent desk.",
    };
  }

  return {
    title: "Sign In | CeEst ERP",
    description: "Sign in to access your subscribed ERP workspaces.",
  };
}

export default async function LoginPage() {
  const headerList = await headers();
  const host = headerList.get("x-forwarded-host") || headerList.get("host") || "";
  const isSales = isSalesOnlyHost(host);

  return <LoginForm isSalesInitial={isSales} />;
}
