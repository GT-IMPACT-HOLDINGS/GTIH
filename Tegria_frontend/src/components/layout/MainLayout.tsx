import { useCallback, useState } from "react";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { ChatPanel } from "../chat/ChatPanel";
import { DocumentView } from "../document/DocumentView";
import {
  mapOsngEnvelopeToTegria,
  type PageData,
  type TreeItem,
} from "../../data/pages";
import { formatProposeError, proposeFromIntentUntilDone } from "../../lib/gtihClient";
import {
  appendProgressLine,
  expressDraftReady,
  expressHanumanLog,
  expressProposeStatus,
} from "../../lib/hanumanProgressCopy";

const CHAT_TITLE_NEW_VOLUME = "Describe the outcome you want to realize…";

export function MainLayout() {
  const [chatOpen, setChatOpen] = useState(false);
  const [activePageId, setActivePageId] = useState("");
  const [scrollAnchor, setScrollAnchor] = useState<string | null>(null);
  const [pages, setPages] = useState<Record<string, PageData>>({});
  const [treeData, setTreeData] = useState<TreeItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [statusText, setStatusText] = useState<string | null>(null);
  const [statusIsError, setStatusIsError] = useState(false);
  const [chatTitle, setChatTitle] = useState("");

  const handleAnchorClick = useCallback((pageId: string, anchorId: string) => {
    setActivePageId(pageId);
    setScrollAnchor(anchorId);
    setTimeout(() => setScrollAnchor(null), 100);
  }, []);

  const handleCreateVolume = useCallback(() => {
    setChatTitle(CHAT_TITLE_NEW_VOLUME);
    setChatOpen(true);
    setStatusText(null);
    setStatusIsError(false);
    setPages({});
    setTreeData([]);
    setActivePageId("");
  }, []);

  const handlePropose = useCallback(async (intent: string) => {
    setBusy(true);
    setStatusIsError(false);
    setStatusText(
      "Hanuman receives your intent and opens an OSNG propose Job…"
    );
    try {
      const envelope = await proposeFromIntentUntilDone(
        { intent, max_descendants: 0 },
        {
          onLog: (line) => {
            const expressed = expressHanumanLog(line);
            if (!expressed) return;
            setStatusText((prev) => appendProgressLine(prev, expressed));
          },
          onStatus: (st) => {
            const expressed = expressProposeStatus(String(st.status || ""));
            if (!expressed) return;
            setStatusText((prev) => appendProgressLine(prev, expressed));
          },
        }
      );
      const mapped = mapOsngEnvelopeToTegria(envelope);
      setPages(mapped.pages);
      setTreeData(mapped.tree);
      if (mapped.rootId) setActivePageId(mapped.rootId);
      setStatusIsError(false);
      setStatusText(expressDraftReady(envelope.root_osn_id));
    } catch (e) {
      setStatusIsError(true);
      setStatusText(formatProposeError(e));
    } finally {
      setBusy(false);
    }
  }, []);

  return (
    <div className="flex flex-col h-screen bg-bg-primary">
      <TopBar chatOpen={chatOpen} onToggleChat={() => setChatOpen((v) => !v)} />

      <div className="flex flex-1 min-h-0 gap-0 pb-2.5 pr-2.5">
        <Sidebar
          treeData={treeData}
          activeItemId={activePageId}
          onItemClick={setActivePageId}
          onAnchorClick={handleAnchorClick}
          onCreateVolume={handleCreateVolume}
        />

        <div className="flex-1 min-w-0">
          <DocumentView
            pageId={activePageId}
            pages={pages}
            scrollToAnchor={scrollAnchor}
          />
        </div>

        {chatOpen && (
          <div className="w-[var(--chat-width)] shrink-0 ml-2.5">
            <ChatPanel
              onClose={() => setChatOpen(false)}
              onPropose={handlePropose}
              busy={busy}
              statusText={statusText}
              statusIsError={statusIsError}
              chatTitle={chatTitle}
            />
          </div>
        )}
      </div>
    </div>
  );
}
