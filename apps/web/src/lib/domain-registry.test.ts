import { resolveDomainRule, isSalesStorefrontHost, normalizeHost } from "./domain-registry";

describe("domain-registry", () => {
  it("normalizes hosts correctly", () => {
    expect(normalizeHost("CenterEstates.CO.KE:443")).toBe("centerestates.co.ke");
    expect(normalizeHost("  TENANT.centerestates.com ")).toBe("tenant.centerestates.com");
  });

  it("identifies sales storefront host", () => {
    expect(isSalesStorefrontHost("centerestates.co.ke")).toBe(true);
    expect(isSalesStorefrontHost("www.centerestates.co.ke")).toBe(true);
    expect(isSalesStorefrontHost("centerestates.com")).toBe(false);
  });

  it("resolves portal subdomains correctly", () => {
    expect(resolveDomainRule("tenant.centerestates.com")?.defaultRewritePath).toBe("/tenant-portal");
    expect(resolveDomainRule("owner.centerestates.com")?.defaultRewritePath).toBe("/owner-portal");
    expect(resolveDomainRule("landlord.centerestates.com")?.defaultRewritePath).toBe("/owner-portal");
    expect(resolveDomainRule("buyer.centerestates.com")?.defaultRewritePath).toBe("/client-portal");
    expect(resolveDomainRule("portal.centerestates.com")?.defaultRewritePath).toBe("/client-portal");
    expect(resolveDomainRule("sales.centerestates.com")?.defaultRewritePath).toBe("/sales");
    expect(resolveDomainRule("property.centerestates.com")?.defaultRewritePath).toBe("/property");
    expect(resolveDomainRule("dashboard.centerestates.com")?.defaultRewritePath).toBe("/workspaces");
    expect(resolveDomainRule("app.centerestates.com")?.defaultRewritePath).toBe("/workspaces");
  });
});
