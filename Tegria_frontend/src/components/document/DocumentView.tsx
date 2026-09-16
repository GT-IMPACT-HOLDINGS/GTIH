import { useCallback, useEffect, useRef } from "react";
import { LinkIcon, MoreIcon } from "../icons";
import type { PageData } from "../../data/pages";

interface DocumentViewProps {
  pageId: string;
  pages: Record<string, PageData>;
  scrollToAnchor?: string | null;
}

function storageKey(pageId: string, blockId: string) {
  return `tergia-doc-${pageId}-${blockId}`;
}

function loadBlock(pageId: string, blockId: string, fallback: string): string {
  try {
    const saved = localStorage.getItem(storageKey(pageId, blockId));
    if (saved !== null) return saved;
  } catch {
    /* ignore */
  }
  return fallback;
}

function saveBlock(pageId: string, blockId: string, value: string) {
  try {
    localStorage.setItem(storageKey(pageId, blockId), value);
  } catch {
    /* ignore */
  }
}

function EditableBlock({
  pageId,
  blockId,
  defaultText,
  className,
  tag: Tag = "p",
}: {
  pageId: string;
  blockId: string;
  defaultText: string;
  className?: string;
  tag?: "p" | "h1" | "h2" | "h3" | "li" | "span";
}) {
  const ref = useRef<HTMLElement>(null);
  const initialText = loadBlock(pageId, blockId, defaultText);

  const handleBlur = useCallback(() => {
    if (ref.current) {
      saveBlock(pageId, blockId, ref.current.innerText);
    }
  }, [pageId, blockId]);

  return (
    <Tag
      ref={ref as never}
      contentEditable
      suppressContentEditableWarning
      onBlur={handleBlur}
      className={`outline-none rounded-sm focus:ring-1 focus:ring-border-default/30 px-1 -mx-1 ${className ?? ""}`}
      dangerouslySetInnerHTML={{ __html: initialText }}
    />
  );
}

export function DocumentView({ pageId, pages, scrollToAnchor }: DocumentViewProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const page = pages[pageId];

  useEffect(() => {
    if (scrollToAnchor && scrollRef.current) {
      const el = scrollRef.current.querySelector(`[data-anchor="${scrollToAnchor}"]`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }
  }, [scrollToAnchor]);

  if (!page) {
    return (
      <div className="bg-bg-surface rounded-2xl flex flex-col h-full overflow-hidden items-center justify-center text-text-muted text-sm px-8 text-center">
        Empty document pane. Propose an OSNG from Ask Anything to begin.
      </div>
    );
  }

  return (
    <div className="bg-bg-surface rounded-2xl flex flex-col h-full overflow-hidden">
      <div className="flex items-center justify-between p-4 h-[76px]">
        <div className="flex items-center gap-2 text-base font-medium overflow-hidden">
          {page.breadcrumb.map((crumb, i) => (
            <span key={i} className="flex items-center gap-2">
              {i > 0 && <span className="text-text-breadcrumb">/</span>}
              <span
                className={
                  i === page.breadcrumb.length - 1 ? "text-text-white" : "text-text-breadcrumb"
                }
              >
                {crumb}
              </span>
            </span>
          ))}
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            className="flex items-center justify-center size-10 text-text-muted hover:text-text-primary"
          >
            <LinkIcon size={24} />
          </button>
          <button
            type="button"
            className="flex items-center justify-center size-10 text-text-muted hover:text-text-primary"
          >
            <MoreIcon size={24} />
          </button>
        </div>
      </div>

      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-10 xl:px-[100px] 2xl:px-[156px] py-[100px]"
      >
        <div className="max-w-[740px] flex flex-col gap-11" key={pageId}>
          <div className="flex items-center gap-3.5 overflow-hidden">
            <span className="text-3xl">{page.emoji}</span>
            <EditableBlock
              pageId={pageId}
              blockId="title"
              defaultText={page.title}
              tag="h1"
              className="text-text-primary font-bold text-[34px]"
            />
          </div>

          <EditableBlock
            pageId={pageId}
            blockId="subtitle"
            defaultText={page.subtitle}
            tag="h2"
            className="text-text-primary font-bold text-2xl"
          />

          {page.sections.map((section, si) => (
            <div
              key={si}
              className="flex flex-col gap-2.5"
              {...(section.anchorId ? { "data-anchor": section.anchorId } : {})}
            >
              <EditableBlock
                pageId={pageId}
                blockId={`s${si}-heading`}
                defaultText={section.heading}
                tag="h3"
                className="text-text-primary font-semibold text-lg"
              />

              {section.blocks.map((block, bi) => {
                const blockId = `s${si}-b${bi}`;

                if (block.type === "paragraph") {
                  return (
                    <EditableBlock
                      key={bi}
                      pageId={pageId}
                      blockId={blockId}
                      defaultText={block.text}
                      className="text-text-secondary text-[14.5px] leading-relaxed"
                    />
                  );
                }

                if (block.type === "labeled") {
                  return (
                    <div
                      key={bi}
                      contentEditable
                      suppressContentEditableWarning
                      onBlur={(e) => saveBlock(pageId, blockId, e.currentTarget.innerText)}
                      className="text-text-secondary text-[14.5px] leading-relaxed outline-none rounded-sm focus:ring-1 focus:ring-border-default/30 px-1 -mx-1"
                      dangerouslySetInnerHTML={{
                        __html: loadBlock(
                          pageId,
                          blockId,
                          `<strong class="text-text-primary font-semibold">${block.label}</strong> ${block.text}`
                        ),
                      }}
                    />
                  );
                }

                if (block.type === "list") {
                  return (
                    <EditableBlock
                      key={bi}
                      pageId={pageId}
                      blockId={blockId}
                      defaultText={block.text}
                      tag="li"
                      className="text-text-secondary text-[14.5px] leading-relaxed list-disc ml-5"
                    />
                  );
                }

                if (block.type === "quote") {
                  return (
                    <EditableBlock
                      key={bi}
                      pageId={pageId}
                      blockId={blockId}
                      defaultText={block.text}
                      className="text-text-quote text-[14.5px] leading-relaxed italic"
                    />
                  );
                }

                return null;
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
