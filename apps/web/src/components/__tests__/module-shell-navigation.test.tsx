import { fireEvent, render, screen } from "@testing-library/react";

import { ModuleShell } from "@/components/module-shell";

describe("ModuleShell construction navigation", () => {
  it("renders two-tier horizontal navigation tabs matching property module", () => {
    const onSelect = jest.fn();
    const { container } = render(
      <ModuleShell
        moduleKey="construction"
        moduleName="Construction Management"
        title="Construction"
        activeId="overview"
        onSelect={onSelect}
      >
        <div>Workspace content</div>
      </ModuleShell>,
    );

    // Verify horizontal navigation strips are rendered
    const groupsContainer = container.querySelector(".module-nav-groups");
    const pagesContainer = container.querySelector(".module-nav-pages");
    expect(groupsContainer).toBeInTheDocument();
    expect(pagesContainer).toBeInTheDocument();

    // Verify workflow section tabs exist
    expect(screen.getByRole("tab", { name: /MAIN/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /SITE OPERATIONS/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /COMMERCIAL/i })).toBeInTheDocument();

    // Verify active workflow group is MAIN and active page is Dashboard/Overview
    expect(screen.getByRole("tab", { name: /MAIN/i })).toHaveClass("active");
    expect(screen.getByRole("button", { name: /Dashboard/i })).toHaveClass("active");

    // Clicking a workflow tab switches to its first page
    fireEvent.click(screen.getByRole("tab", { name: /COMMERCIAL/i }));
    expect(onSelect).toHaveBeenCalledWith("boq");

    // Clicking a page tab in the active group selects that page
    fireEvent.click(screen.getByRole("button", { name: /Project Portfolio/i }));
    expect(onSelect).toHaveBeenCalledWith("projects");
  });
});
