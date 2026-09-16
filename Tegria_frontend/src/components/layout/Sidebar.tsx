import { PlusIcon, CopyIcon } from "../icons";
import { StatusIndicator } from "../ui/StatusIndicator";
import type { TreeItem } from "../../data/pages";

interface SidebarProps {
  treeData: TreeItem[];
  activeItemId: string;
  onItemClick: (id: string) => void;
  onAnchorClick: (pageId: string, anchorId: string) => void;
  onCreateVolume?: () => void;
}

export function Sidebar({
  treeData,
  activeItemId,
  onItemClick,
  onAnchorClick,
  onCreateVolume,
}: SidebarProps) {
  function handleClick(item: TreeItem) {
    if (item.type === "file") {
      const parentId = item.parentId ?? "";
      onAnchorClick(parentId, item.id);
    } else {
      onItemClick(item.id);
    }
  }

  return (
    <aside className="w-[var(--sidebar-width)] h-full flex flex-col">
      <div className="flex items-center justify-between px-4 py-5 h-20">
        <button
          type="button"
          onClick={() => onCreateVolume?.()}
          title="create a new volume"
          aria-label="create a new volume"
          className="flex items-center justify-center size-10 rounded-lg text-text-white hover:bg-bg-surface-hover hover:text-text-primary"
        >
          <PlusIcon size={24} />
        </button>
        <button
          type="button"
          className="flex items-center justify-center size-10 text-text-muted hover:text-text-primary"
        >
          <CopyIcon size={24} />
        </button>
      </div>

      <nav className="flex flex-col overflow-y-auto relative">
        {treeData.length === 0 ? (
          <p className="px-4 py-3 text-text-muted text-sm">
            Empty garden — create a volume, then Ask Anything to propose a single-OSN OSNG.
          </p>
        ) : null}
        {treeData.map((item, index) => {
          const hasChildrenBelow = treeData
            .slice(index + 1)
            .some((next) => next.parentId === item.id);
          const isActive = item.id === activeItemId;

          if (item.type === "file") {
            return (
              <div
                key={item.id}
                onClick={() => handleClick(item)}
                className="h-8 flex items-center overflow-hidden relative cursor-pointer hover:bg-bg-surface-hover"
                style={{ paddingLeft: 69 }}
              >
                <div
                  className="absolute top-1/2 h-px bg-border-tree"
                  style={{
                    left: item.depth === 2 ? 53 : 28,
                    width: item.depth === 2 ? 12 : 37,
                  }}
                />
                <div
                  className="absolute bg-border-tree"
                  style={{
                    left: item.depth === 2 ? 53 : 28,
                    top: 0,
                    width: 1,
                    height: isLastChild(treeData, index, item.depth) ? "50%" : "100%",
                  }}
                />
                <span className="text-text-muted text-sm">{item.label}</span>
              </div>
            );
          }

          const isTask = item.type === "task";
          const paddingLeft = isTask ? 45 : 20;

          return (
            <div
              key={item.id}
              onClick={() => handleClick(item)}
              className={`h-12 flex items-center gap-2 overflow-hidden relative cursor-pointer hover:bg-bg-surface-hover ${
                isActive ? "bg-bg-active" : ""
              }`}
              style={{ paddingLeft }}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") handleClick(item);
              }}
            >
              {isActive && (
                <div className="absolute left-0 top-[7px] bottom-[7px] w-[3px] rounded-r-sm bg-status-ready" />
              )}

              {item.depth > 0 && (
                <div
                  className="absolute bg-border-tree"
                  style={{
                    left: item.depth === 1 ? 28 : 53,
                    top: 0,
                    width: 1,
                    height: isLastChild(treeData, index, item.depth) ? "50%" : "100%",
                  }}
                />
              )}

              {isTask && (
                <div
                  className="absolute top-1/2 h-px bg-border-tree"
                  style={{ left: 28, width: 13 }}
                />
              )}

              {hasChildrenBelow && (
                <div
                  className="absolute bg-border-tree"
                  style={{
                    left: isTask ? 53 : 28,
                    top: "50%",
                    width: 1,
                    bottom: 0,
                  }}
                />
              )}

              <StatusIndicator status={item.status ?? "draft"} size={16} />
              <span className="text-text-white font-medium text-sm">{item.label}</span>
            </div>
          );
        })}
      </nav>
    </aside>
  );
}

function isLastChild(items: TreeItem[], currentIndex: number, depth: number): boolean {
  for (let i = currentIndex + 1; i < items.length; i++) {
    if (items[i].depth < depth) return true;
    if (items[i].depth === depth) return false;
  }
  return true;
}
