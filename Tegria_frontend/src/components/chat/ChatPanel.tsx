import { CloseIcon, MoreIcon, LocationIcon, AttachIcon, SendIcon, TergiaLogo } from "../icons";
import { useState } from "react";

interface ChatPanelProps {
  onClose?: () => void;
  onPropose?: (intent: string) => Promise<void>;
  busy?: boolean;
  statusText?: string | null;
  statusIsError?: boolean;
  /** Prompt title shown in the chat body (volume / outcome framing). */
  chatTitle?: string;
}

export function ChatPanel({
  onClose,
  onPropose,
  busy,
  statusText,
  statusIsError,
  chatTitle = "",
}: ChatPanelProps) {
  const [intent, setIntent] = useState("");

  async function handleSend() {
    const text = intent.trim();
    if (!text || busy || !onPropose) return;
    await onPropose(text);
  }

  return (
    <div className="bg-bg-surface rounded-2xl flex flex-col h-full overflow-hidden">
      <div className="flex items-center justify-between p-4 h-[76px]">
        <div className="flex items-center gap-2">
          <TergiaLogo size={40} className="opacity-80" />
          <span className="text-text-white font-medium text-base opacity-80">
            Tegria
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button type="button" className="flex items-center justify-center size-10 text-text-muted hover:text-text-primary">
            <MoreIcon size={24} />
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex items-center justify-center size-10 text-text-muted hover:text-text-primary"
          >
            <CloseIcon size={24} />
          </button>
        </div>
      </div>

      <div className="flex-1 px-6 pt-4 overflow-y-auto">
        <div className="flex items-start gap-3">
          <div className="mt-0.5">
            <svg width={21} height={21} viewBox="0 0 21 21" fill="none">
              <circle cx="10.5" cy="10.5" r="9" stroke="var(--color-text-muted)" strokeWidth="1.5" />
            </svg>
          </div>
          <div className="flex flex-col gap-2 min-w-0">
            <span className="text-text-white font-medium text-sm leading-relaxed">
              {chatTitle}
            </span>
            {statusText ? (
              <pre
                className={
                  statusIsError
                    ? "text-xs whitespace-pre-wrap font-mono leading-relaxed max-h-64 overflow-y-auto"
                    : "text-text-context text-sm whitespace-pre-wrap font-sans"
                }
                style={statusIsError ? { color: "#e88a8a" } : undefined}
              >
                {statusText}
              </pre>
            ) : null}
          </div>
        </div>
      </div>

      <div className="mx-2.5 mb-3 bg-bg-input rounded-2xl pb-0.5 px-0.5">
        <div className="flex items-center gap-2 px-2.5 py-4">
          <LocationIcon size={24} className="text-text-muted" />
          <span className="text-text-context text-base">Context: Day zero garden</span>
        </div>

        <div className="bg-bg-surface border border-border-subtle rounded-2xl overflow-hidden">
          <div className="px-6 pt-4 pb-1">
            <textarea
              value={intent}
              onChange={(e) => setIntent(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void handleSend();
                }
              }}
              disabled={!!busy}
              placeholder="Ask anything..."
              rows={3}
              className="w-full resize-none bg-transparent text-text-primary text-base placeholder:text-text-placeholder outline-none"
            />
          </div>
          <div className="flex items-center justify-between p-3.5">
            <button
              type="button"
              className="flex items-center justify-center size-12 rounded-xl text-text-muted hover:text-text-primary"
            >
              <AttachIcon size={24} />
            </button>
            <button
              type="button"
              disabled={!!busy || !intent.trim()}
              onClick={() => void handleSend()}
              className="flex items-center justify-center size-12 rounded-full bg-accent-green-solid text-bg-surface disabled:opacity-40"
            >
              <SendIcon size={24} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
