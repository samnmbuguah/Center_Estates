import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

function mockFetch(response: unknown, ok = true) {
  const fn = vi.fn().mockResolvedValue({
    ok,
    status: ok ? 200 : 403,
    json: async () => response,
  });
  vi.stubGlobal("fetch", fn);
  return fn;
}

vi.mock("../../sync/api", () => ({
  apiUrl: (path: string) => `http://localhost/api${path}`,
  authHeaders: vi.fn().mockResolvedValue({ Authorization: "Bearer tok" }),
  setToken: vi.fn(),
}));

vi.mock("expo-file-system/legacy", () => ({
  uploadAsync: vi.fn(),
  FileSystemUploadType: { MULTIPART: 1 },
}));

describe("mobile api client", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ access: "tok" }),
    }));
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("fetchBoqItems calls the correct endpoint", async () => {
    const mod = await import("../client");
    await mod.login("clerk", "pw");
    const fetchMock = mockFetch([]);
    await mod.fetchBoqItems("p1");
    const call = fetchMock.mock.calls.find((c) => String(c[0]).includes("/projects/p1/boq-items"));
    expect(call).toBeDefined();
    expect(String(call![0])).toBe("http://localhost/api/projects/p1/boq-items/");
  });

  it("updateBoqProgress PATCHes progress data", async () => {
    const mod = await import("../client");
    await mod.login("clerk", "pw");
    const fetchMock = mockFetch({ id: 42, executed_quantity: "75.5", progress_updated_at: 1000 });
    await mod.updateBoqProgress("p1", 42, 75.5);
    const call = fetchMock.mock.calls.find((c) => String(c[0]).includes("/projects/p1/boq-items/42/progress"));
    expect(call).toBeDefined();
    expect(call![1].method).toBe("PATCH");
    const body = JSON.parse(call![1].body);
    expect(body.executed_quantity).toBe(75.5);
  });

  it("fetchQualityTests calls the correct endpoint", async () => {
    const mod = await import("../client");
    await mod.login("clerk", "pw");
    const fetchMock = mockFetch([]);
    await mod.fetchQualityTests("p1");
    const call = fetchMock.mock.calls.find((c) => String(c[0]).includes("/projects/p1/quality-tests"));
    expect(call).toBeDefined();
    expect(String(call![0])).toBe("http://localhost/api/projects/p1/quality-tests/");
  });

  it("createQualityTest POSTs test data", async () => {
    const mod = await import("../client");
    await mod.login("clerk", "pw");
    const fetchMock = mockFetch({ id: "t1", test_type: "concrete_cylinder" });
    await mod.createQualityTest("p1", { test_type: "concrete_cylinder", sample_id: "S-001" });
    const call = fetchMock.mock.calls.find((c) => String(c[0]).includes("/projects/p1/quality-tests") && c[1]?.method === "POST");
    expect(call).toBeDefined();
    const body = JSON.parse(call![1].body);
    expect(body.test_type).toBe("concrete_cylinder");
    expect(body.sample_id).toBe("S-001");
  });

  it("fetchBimModels calls the correct endpoint", async () => {
    const mod = await import("../client");
    await mod.login("clerk", "pw");
    const fetchMock = mockFetch([]);
    await mod.fetchBimModels("p1");
    const call = fetchMock.mock.calls.find((c) => String(c[0]).includes("/projects/p1/bim-models"));
    expect(call).toBeDefined();
    expect(String(call![0])).toBe("http://localhost/api/projects/p1/bim-models/");
  });

  it("fetchDroneDatasets calls the correct endpoint", async () => {
    const mod = await import("../client");
    await mod.login("clerk", "pw");
    const fetchMock = mockFetch([]);
    await mod.fetchDroneDatasets("p1");
    const call = fetchMock.mock.calls.find((c) => String(c[0]).includes("/projects/p1/drone-datasets"));
    expect(call).toBeDefined();
    expect(String(call![0])).toBe("http://localhost/api/projects/p1/drone-datasets/");
  });

  it("fetchTickets and createTicket call the correct endpoints", async () => {
    const mod = await import("../client");
    await mod.login("clerk", "pw");
    const fetchMock = mockFetch([{ id: "tk-1", title: "Wall crack" }]);
    await mod.fetchTickets("p1");
    const getCall = fetchMock.mock.calls.find((c) => String(c[0]).includes("/tickets/?project_id=p1"));
    expect(getCall).toBeDefined();

    await mod.createTicket({ project_id: "p1", title: "Rebar defect", priority: "urgent" });
    const postCall = fetchMock.mock.calls.find((c) => String(c[0]).includes("/tickets/") && c[1]?.method === "POST");
    expect(postCall).toBeDefined();
    const payload = JSON.parse(postCall![1].body);
    expect(payload.title).toBe("Rebar defect");
    expect(payload.priority).toBe("urgent");
  });
});
