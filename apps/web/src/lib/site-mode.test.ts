import { isSalesOnlyHost, resolveApiBaseUrl } from "./site-mode";

describe("isSalesOnlyHost", () => {
  it("recognizes the storefront host and its subdomains", () => {
    expect(isSalesOnlyHost("centerestates.co.ke")).toBe(true);
    expect(isSalesOnlyHost("www.centerestates.co.ke")).toBe(true);
    expect(isSalesOnlyHost("api.centerestates.co.ke")).toBe(true);
  });

  it("does not match the ERP host or unrelated domains", () => {
    expect(isSalesOnlyHost("centerestates.com")).toBe(false);
    expect(isSalesOnlyHost("api.centerestates.com")).toBe(false);
    expect(isSalesOnlyHost("notcenterestates.co.ke")).toBe(false);
    expect(isSalesOnlyHost("")).toBe(false);
  });
});

describe("resolveApiBaseUrl", () => {
  it("uses the same-origin proxy on the storefront so cookies stay first-party", () => {
    expect(resolveApiBaseUrl("centerestates.co.ke")).toBe("/api/v1");
  });

  it("keeps the configured cross-subdomain base everywhere else", () => {
    const previous = process.env.NEXT_PUBLIC_API_BASE_URL;
    process.env.NEXT_PUBLIC_API_BASE_URL = "https://api.centerestates.com/api/v1";
    try {
      expect(resolveApiBaseUrl("centerestates.com")).toBe("https://api.centerestates.com/api/v1");
      expect(resolveApiBaseUrl("localhost")).toBe("https://api.centerestates.com/api/v1");
    } finally {
      if (previous === undefined) delete process.env.NEXT_PUBLIC_API_BASE_URL;
      else process.env.NEXT_PUBLIC_API_BASE_URL = previous;
    }
  });

  it("falls back to /api/v1 when nothing is configured", () => {
    const previous = process.env.NEXT_PUBLIC_API_BASE_URL;
    delete process.env.NEXT_PUBLIC_API_BASE_URL;
    try {
      expect(resolveApiBaseUrl("localhost")).toBe("/api/v1");
    } finally {
      if (previous !== undefined) process.env.NEXT_PUBLIC_API_BASE_URL = previous;
    }
  });
});
