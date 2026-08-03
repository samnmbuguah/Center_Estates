import { redirect } from "next/navigation";

export default async function AppWorkspacePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/monitoring?tab=project-detail&id=${encodeURIComponent(id)}`);
}
