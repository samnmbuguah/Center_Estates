import { StorefrontListingsPage } from "@/components/storefront/StorefrontListingsPage";

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q : "";
  return (
    <StorefrontListingsPage
      heading="Search properties"
      blurb="Find homes, offices, shops and land by keyword, price, type or location."
      initial={{ search: q }}
      autoFocus
    />
  );
}
