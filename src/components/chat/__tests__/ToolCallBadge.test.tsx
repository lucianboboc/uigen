import { render, screen, cleanup } from "@testing-library/react";
import { describe, it, expect, afterEach } from "vitest";
import { ToolCallBadge } from "../ToolCallBadge";

afterEach(() => {
  cleanup();
});

describe("ToolCallBadge", () => {
  describe("str_replace_editor tool", () => {
    it("displays 'Creating' message for create command", () => {
      const toolInvocation = {
        toolName: "str_replace_editor",
        state: "result",
        args: {
          command: "create",
          path: "/components/Button.tsx",
        },
      };

      render(<ToolCallBadge toolInvocation={toolInvocation} />);
      expect(screen.getByText("Creating Button.tsx")).toBeDefined();
    });

    it("displays 'Editing' message for str_replace command", () => {
      const toolInvocation = {
        toolName: "str_replace_editor",
        state: "result",
        args: {
          command: "str_replace",
          path: "/App.jsx",
        },
      };

      render(<ToolCallBadge toolInvocation={toolInvocation} />);
      expect(screen.getByText("Editing App.jsx")).toBeDefined();
    });

    it("displays 'Updating' message for insert command", () => {
      const toolInvocation = {
        toolName: "str_replace_editor",
        state: "result",
        args: {
          command: "insert",
          path: "/utils/helpers.ts",
        },
      };

      render(<ToolCallBadge toolInvocation={toolInvocation} />);
      expect(screen.getByText("Updating helpers.ts")).toBeDefined();
    });

    it("displays 'Viewing' message for view command", () => {
      const toolInvocation = {
        toolName: "str_replace_editor",
        state: "result",
        args: {
          command: "view",
          path: "/config.json",
        },
      };

      render(<ToolCallBadge toolInvocation={toolInvocation} />);
      expect(screen.getByText("Viewing config.json")).toBeDefined();
    });
  });

  describe("file_manager tool", () => {
    it("displays 'Deleting' message for delete command", () => {
      const toolInvocation = {
        toolName: "file_manager",
        state: "result",
        args: {
          command: "delete",
          path: "/old-component.tsx",
        },
      };

      render(<ToolCallBadge toolInvocation={toolInvocation} />);
      expect(screen.getByText("Deleting old-component.tsx")).toBeDefined();
    });

    it("displays 'Renaming' message for rename command", () => {
      const toolInvocation = {
        toolName: "file_manager",
        state: "result",
        args: {
          command: "rename",
          path: "/Button.tsx",
          new_path: "/components/Button.tsx",
        },
      };

      render(<ToolCallBadge toolInvocation={toolInvocation} />);
      expect(
        screen.getByText("Renaming Button.tsx to Button.tsx")
      ).toBeDefined();
    });

    it("displays rename message without new name when new_path is missing", () => {
      const toolInvocation = {
        toolName: "file_manager",
        state: "result",
        args: {
          command: "rename",
          path: "/Button.tsx",
        },
      };

      render(<ToolCallBadge toolInvocation={toolInvocation} />);
      expect(screen.getByText("Renaming Button.tsx")).toBeDefined();
    });
  });

  describe("visual states", () => {
    it("shows green dot when state is result", () => {
      const toolInvocation = {
        toolName: "str_replace_editor",
        state: "result",
        args: {
          command: "create",
          path: "/test.ts",
        },
      };

      const { container } = render(<ToolCallBadge toolInvocation={toolInvocation} />);
      const greenDot = container.querySelector(".bg-emerald-500");
      expect(greenDot).toBeDefined();
    });

    it("shows loading spinner when state is not result", () => {
      const toolInvocation = {
        toolName: "str_replace_editor",
        state: "pending",
        args: {
          command: "create",
          path: "/test.ts",
        },
      };

      const { container } = render(<ToolCallBadge toolInvocation={toolInvocation} />);
      const spinner = container.querySelector(".animate-spin");
      expect(spinner).toBeDefined();
    });
  });

  describe("edge cases", () => {
    it("handles missing args gracefully", () => {
      const toolInvocation = {
        toolName: "str_replace_editor",
        state: "result",
      };

      render(<ToolCallBadge toolInvocation={toolInvocation} />);
      expect(screen.getByText("Modifying file")).toBeDefined();
    });

    it("handles unknown tool names", () => {
      const toolInvocation = {
        toolName: "unknown_tool",
        state: "result",
        args: {},
      };

      render(<ToolCallBadge toolInvocation={toolInvocation} />);
      expect(screen.getByText("unknown_tool")).toBeDefined();
    });

    it("handles nested file paths", () => {
      const toolInvocation = {
        toolName: "str_replace_editor",
        state: "result",
        args: {
          command: "create",
          path: "/src/components/ui/Button.tsx",
        },
      };

      render(<ToolCallBadge toolInvocation={toolInvocation} />);
      expect(screen.getByText("Creating Button.tsx")).toBeDefined();
    });
  });
});
