import { fireEvent, render, screen } from "@testing-library/react";
import { ModuleShell, type ModuleNavGroup } from "./module-shell";

const groups: ModuleNavGroup[] = [
  {
    label: "Overview",
    items: [
      { id: "dashboard", label: "Dashboard", icon: "📊" },
      { id: "projects", label: "Projects", icon: "🏗️" },
    ],
  },
  {
    label: "Finance",
    items: [
      { id: "requisitions", label: "Requisitions", icon: "🧾" },
      { id: "certificates", label: "Certificates", icon: "📄" },
    ],
  },
];

describe("ModuleShell navigation", () => {
  test("uses accessible MUI navigation controls and switches workflow groups", () => {
    const onSelect = jest.fn();

    render(
      <ModuleShell
        moduleKey="test"
        moduleName="Test module"
        title="Test workspace"
        groups={groups}
        activeId="dashboard"
        onSelect={onSelect}
      >
        <div>Workspace content</div>
      </ModuleShell>,
    );

    expect(screen.getByRole("navigation", { name: "Test module navigation" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Overview" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("button", { name: "Dashboard" })).toHaveAttribute("aria-current", "page");

    fireEvent.click(screen.getByRole("tab", { name: "Finance" }));
    expect(onSelect).toHaveBeenCalledWith("requisitions");
  });

  test("selects an individual page from the active workflow", () => {
    const onSelect = jest.fn();

    render(
      <ModuleShell
        moduleKey="test"
        moduleName="Test module"
        title="Test workspace"
        groups={groups}
        activeId="projects"
        onSelect={onSelect}
      >
        <div>Workspace content</div>
      </ModuleShell>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Dashboard" }));
    expect(onSelect).toHaveBeenCalledWith("dashboard");
  });
});
