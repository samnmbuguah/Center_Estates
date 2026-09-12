import { fireEvent, render, screen } from "@testing-library/react";

import { ModuleShell } from "@/components/module-shell";

describe("ModuleShell construction navigation", () => {
  it("uses compact workflow and page selectors without the horizontal tab strips", () => {
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

    expect(screen.getByLabelText("Construction workflow")).toBeInTheDocument();
    expect(screen.getByLabelText("Construction page")).toBeInTheDocument();
    expect(container.querySelector(".module-nav-groups")).not.toBeInTheDocument();
    expect(container.querySelector(".module-nav-pages")).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Construction workflow"), { target: { value: "Commercial" } });
    expect(onSelect).toHaveBeenCalledWith("boq");
  });
});
