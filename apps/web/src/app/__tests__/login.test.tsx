import { render, screen } from "@testing-library/react";
import LoginPage, { generateMetadata } from "../login/page";
import { headers } from "next/headers";

jest.mock("next/headers", () => ({
  headers: jest.fn(),
}));

jest.mock("@/components/auth-provider", () => ({
  useAuth: () => ({
    login: jest.fn(),
  }),
}));

describe("LoginPage Server Component", () => {
  it("renders Sales Portal login layout for centerestates.co.ke", async () => {
    (headers as jest.Mock).mockResolvedValue({
      get: (header: string) => (header === "host" ? "centerestates.co.ke" : null),
    });

    const metadata = await generateMetadata();
    expect(metadata.title).toContain("Center Estates Sales & Client Portal");

    const Page = await LoginPage();
    render(Page);

    expect(screen.getByText("SALES, AGENTS & CLIENT PORTAL")).toBeInTheDocument();
    expect(screen.getByText("Real Estate Sales, Portals & Developments")).toBeInTheDocument();
    expect(screen.getByText("Sign In to Portal")).toBeInTheDocument();
    expect(screen.getByText("Sign In to Portal →")).toBeInTheDocument();
  });

  it("renders CeEst ERP login layout for centerestates.com", async () => {
    (headers as jest.Mock).mockResolvedValue({
      get: (header: string) => (header === "host" ? "centerestates.com" : null),
    });

    const metadata = await generateMetadata();
    expect(metadata.title).toContain("CeEst ERP");

    const Page = await LoginPage();
    render(Page);

    expect(screen.getByText("CONNECTED ESTATE OPERATIONS")).toBeInTheDocument();
    expect(screen.getByText("Run every estate with clarity and control")).toBeInTheDocument();
    expect(screen.getByText("Welcome back")).toBeInTheDocument();
    expect(screen.getByText("Sign In to Workspace →")).toBeInTheDocument();
  });
});
