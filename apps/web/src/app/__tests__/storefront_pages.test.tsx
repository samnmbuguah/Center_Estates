import { render, screen } from "@testing-library/react";
import AboutPage, { generateMetadata as generateAboutMetadata } from "../about/page";
import ContactPage, { generateMetadata as generateContactMetadata } from "../contact/page";
import FaqPage, { generateMetadata as generateFaqMetadata } from "../faq/page";
import { headers } from "next/headers";

jest.mock("next/headers", () => ({
  headers: jest.fn(),
}));

describe("AboutPage Server Component", () => {
  it("renders Center Estates real estate about page for centerestates.co.ke", async () => {
    (headers as jest.Mock).mockResolvedValue({
      get: (header: string) => (header === "host" ? "centerestates.co.ke" : null),
    });

    const metadata = await generateAboutMetadata();
    expect(metadata.title).toContain("About Us | Center Estates Kenya");

    const Page = await AboutPage();
    render(Page);

    expect(screen.getByText("Connecting Discerning Buyers to Verified Kenyan Real Estate")).toBeInTheDocument();
    expect(screen.getByText("The Center Estates Standard")).toBeInTheDocument();
    expect(screen.getByText("Exhaustive Title Verification")).toBeInTheDocument();
  });

  it("renders CeEst ERP about page for centerestates.com", async () => {
    (headers as jest.Mock).mockResolvedValue({
      get: (header: string) => (header === "host" ? "centerestates.com" : null),
    });

    const metadata = await generateAboutMetadata();
    expect(metadata.title).toContain("About | CeEst ERP");

    const Page = await AboutPage();
    render(Page);

    expect(screen.getByText("About MonitorERP")).toBeInTheDocument();
    expect(screen.getByText("Why Construction Teams Choose Us")).toBeInTheDocument();
  });
});

describe("ContactPage Server Component", () => {
  it("renders Center Estates advisory desk and form for centerestates.co.ke", async () => {
    (headers as jest.Mock).mockResolvedValue({
      get: (header: string) => (header === "host" ? "centerestates.co.ke" : null),
    });

    const metadata = await generateContactMetadata();
    expect(metadata.title).toContain("Contact Sales Desk | Center Estates Kenya");

    const Page = await ContactPage();
    render(Page);

    expect(screen.getByText("Speak With Our Property Specialists")).toBeInTheDocument();
    expect(screen.getByText("Westlands Headquarters")).toBeInTheDocument();
    expect(screen.getByText("Submit Property Enquiry")).toBeInTheDocument();
  });

  it("renders CeEst ERP contact page for centerestates.com", async () => {
    (headers as jest.Mock).mockResolvedValue({
      get: (header: string) => (header === "host" ? "centerestates.com" : null),
    });

    const metadata = await generateContactMetadata();
    expect(metadata.title).toContain("Contact Us | CeEst ERP");

    const Page = await ContactPage();
    render(Page);

    expect(screen.getByText("hello@monitorerp.com")).toBeInTheDocument();
  });
});

describe("FaqPage Server Component", () => {
  it("renders Kenyan property FAQs for centerestates.co.ke", async () => {
    (headers as jest.Mock).mockResolvedValue({
      get: (header: string) => (header === "host" ? "centerestates.co.ke" : null),
    });

    const metadata = await generateFaqMetadata();
    expect(metadata.title).toContain("FAQ | Center Estates Kenya");

    const Page = await FaqPage();
    render(Page);

    expect(screen.getByText("Buyer & Investor Knowledge Base")).toBeInTheDocument();
    expect(screen.getByText("How do I purchase a property through Center Estates?")).toBeInTheDocument();
  });

  it("renders MonitorERP FAQs for centerestates.com", async () => {
    (headers as jest.Mock).mockResolvedValue({
      get: (header: string) => (header === "host" ? "centerestates.com" : null),
    });

    const metadata = await generateFaqMetadata();
    expect(metadata.title).toContain("FAQ | CeEst ERP");

    const Page = await FaqPage();
    render(Page);

    expect(screen.getByText("What is MonitorERP?")).toBeInTheDocument();
  });
});
