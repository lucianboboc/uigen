import { Loader2 } from "lucide-react";

interface ToolInvocation {
  toolName: string;
  state: string;
  args?: any;
  result?: any;
}

interface ToolCallBadgeProps {
  toolInvocation: ToolInvocation;
}

function getToolMessage(toolName: string, args: any): string {
  if (toolName === "str_replace_editor") {
    const { command, path } = args || {};
    const fileName = path?.split("/").pop() || "file";

    switch (command) {
      case "create":
        return `Creating ${fileName}`;
      case "str_replace":
        return `Editing ${fileName}`;
      case "insert":
        return `Updating ${fileName}`;
      case "view":
        return `Viewing ${fileName}`;
      default:
        return `Modifying ${fileName}`;
    }
  }

  if (toolName === "file_manager") {
    const { command, path, new_path } = args || {};
    const fileName = path?.split("/").pop() || "file";
    const newFileName = new_path?.split("/").pop();

    switch (command) {
      case "delete":
        return `Deleting ${fileName}`;
      case "rename":
        return newFileName
          ? `Renaming ${fileName} to ${newFileName}`
          : `Renaming ${fileName}`;
      default:
        return `Managing ${fileName}`;
    }
  }

  return toolName;
}

export function ToolCallBadge({ toolInvocation }: ToolCallBadgeProps) {
  const { state, args, toolName } = toolInvocation;
  const message = getToolMessage(toolName, args);
  const isComplete = state === "result";

  return (
    <div className="inline-flex items-center gap-2 mt-2 px-3 py-1.5 bg-neutral-50 rounded-lg text-xs font-mono border border-neutral-200">
      {isComplete ? (
        <>
          <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
          <span className="text-neutral-700">{message}</span>
        </>
      ) : (
        <>
          <Loader2 className="w-3 h-3 animate-spin text-blue-600" />
          <span className="text-neutral-700">{message}</span>
        </>
      )}
    </div>
  );
}
