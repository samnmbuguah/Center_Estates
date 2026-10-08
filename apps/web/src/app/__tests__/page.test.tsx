import { render, screen } from "@testing-library/react";
import MarketingHomePage from "../page";

jest.mock("next/headers", () => ({
  headers: jest.fn(),
}));

jest.mock("@/components/monitoring/pages/Home", () => ({
  Home: () => <div data-testid="erpmicro-home">ERP Home</div>,
}));

jest.mock("@/components/monitoring/pages/MarketingLayout", () => ({
  MarketingLayout: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="marketing-layout">{children}</div>
  ),
}));

jest.mock("@/components/storefront/StorefrontHome", () => ({
  StorefrontHome: () => <div data-testid="storefront-home">Storefront Home</div>,
}));

describe("MarketingHomePage Server Component", () => {
  const { headers } = jest.requireMock("next/headers");

  it("renders the StorefrontHome for centerestates.co.ke on server without client flash", async () => {
    headers.mockResolvedValue(new Headers({ host: "centerestates.co.ke" }));

    const Component = await MarketingHomePage();
    render(Component);

    expect(screen.getByTestId("storefront-home")).toBeInTheDocument();
    expect(screen.queryByTestId("erpmicro-home")).not.toBeInTheDocument();
  });

  it("renders the MarketingLayout and Home for centerestates.com", async () => {
    headers.mockResolvedValue(new Headers({ host: "centerestates.com" }));

    const Component = await MarketingHomePage();
    render(Component);

    expect(screen.getByTestId("marketing-layout")).toBeInTheDocument();
    expect(screen.getByTestId("erpmicro-home")).toBeInTheDocument();
    expect(screen.queryByTestId("storefront-home")).not.toBeInTheDocument();
  });
});
