import { StorefrontListingsPage } from "@/components/storefront/StorefrontListingsPage";

function pick(params: Record<string, string | string[] | undefined>, key: string): string {
  const value = params[key];
  return typeof value === "string" ? value : "";
}

export default async function PropertiesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  return (
    <StorefrontListingsPage
      heading="All properties"
      blurb="Every available unit across our projects — filter by type, price, location or project."
      initial={{
        search: pick(params, "search"),
        minPrice: pick(params, "min_price"),
        maxPrice: pick(params, "max_price"),
        type: pick(params, "type"),
        location: pick(params, "location"),
        project: pick(params, "project"),
      }}
    />
  );
}
