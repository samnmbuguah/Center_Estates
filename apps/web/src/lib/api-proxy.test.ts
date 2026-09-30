import {
  buildResponseHeaders,
  forwardRequestHeaders,
  stripCookieDomain,
} from "./api-proxy";

describe("stripCookieDomain", () => {
  it("removes the Domain attribute so cookies become host-only", () => {
    const rewritten = stripCookieDomain(
      "ce_access=abc; Domain=.centerestates.com; Path=/api/v1/; Max-Age=900; HttpOnly; SameSite=None; Secure",
    );
    expect(rewritten).toBe(
      "ce_access=abc; Path=/api/v1/; Max-Age=900; HttpOnly; SameSite=None; Secure",
    );
  });

  it("keeps cookies without a Domain untouched", () => {
    const cookie = "csrftoken=xyz; Path=/; Expires=Wed, 01 Jan 2030 00:00:00 GMT; SameSite=None; Secure";
    expect(stripCookieDomain(cookie)).toBe(cookie);
  });

  it("is case-insensitive about the Domain attribute", () => {
    expect(stripCookieDomain("a=1; domain=api.centerestates.com; Path=/")).toBe("a=1; Path=/");
  });
});

describe("forwardRequestHeaders", () => {
  it("keeps auth-relevant headers and drops hop-by-hop noise", () => {
    const incoming = new Headers({
      cookie: "csrftoken=tok; ce_access=jwt",
      origin: "https://centerestates.co.ke",
      referer: "https://centerestates.co.ke/sales",
      "x-csrftoken": "tok",
      "x-organization-id": "org-1",
      "content-type": "application/json",
      host: "centerestates.co.ke",
      "accept-encoding": "gzip, br",
      "content-length": "42",
      connection: "keep-alive",
    });
    const forwarded = forwardRequestHeaders(incoming);
    expect(forwarded.get("cookie")).toBe("csrftoken=tok; ce_access=jwt");
    expect(forwarded.get("origin")).toBe("https://centerestates.co.ke");
    expect(forwarded.get("x-csrftoken")).toBe("tok");
    expect(forwarded.get("x-organization-id")).toBe("org-1");
    expect(forwarded.get("content-type")).toBe("application/json");
    expect(forwarded.get("host")).toBeNull();
    expect(forwarded.get("accept-encoding")).toBeNull();
    expect(forwarded.get("content-length")).toBeNull();
    expect(forwarded.get("connection")).toBeNull();
  });
});

describe("buildResponseHeaders", () => {
  it("drops set-cookie (handled separately) and recomputed encoding headers", () => {
    const upstream = new Headers({
      "content-type": "application/json",
      "content-encoding": "gzip",
      "content-length": "999",
      "set-cookie": "a=1; Domain=.centerestates.com",
      "cache-control": "no-store",
      vary: "Cookie",
    });
    const outgoing = buildResponseHeaders(upstream);
    expect(outgoing.get("content-type")).toBe("application/json");
    expect(outgoing.get("cache-control")).toBe("no-store");
    expect(outgoing.get("vary")).toBe("Cookie");
    expect(outgoing.get("content-encoding")).toBeNull();
    expect(outgoing.get("content-length")).toBeNull();
    expect(outgoing.get("set-cookie")).toBeNull();
  });
});
