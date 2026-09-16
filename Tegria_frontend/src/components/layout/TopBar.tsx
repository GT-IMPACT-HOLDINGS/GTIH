import { Avatar } from "../ui/Avatar";
import { BellIcon, CubeIcon, SearchIcon } from "../icons";

interface TopBarProps {
  chatOpen: boolean;
  onToggleChat: () => void;
}

export function TopBar({ chatOpen, onToggleChat }: TopBarProps) {
  return (
    <header className="flex h-[60px] items-center justify-between px-6 bg-bg-primary">
      <div className="flex items-center gap-2">
        <span className="text-text-white font-semibold text-base tracking-wide">
          TERGIA
        </span>
        <span className="text-text-muted text-base">Deployed 5m ago</span>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={onToggleChat}
          className={`flex items-center justify-center size-[38px] rounded-full border text-text-white transition-colors ${
            chatOpen
              ? "bg-accent-green border-accent-green"
              : "bg-transparent border-border-default text-text-muted hover:text-text-primary"
          }`}
        >
          <CubeIcon size={22} />
        </button>

        <div className="flex items-center border border-border-default rounded-full">
          {/* Integration icons — overlapping */}
          <div className="flex items-center">
            {/* Jira */}
            <div className="size-[36px] rounded-[6px] overflow-hidden flex items-center justify-center -mr-[5px]">
              <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
                <rect width="22" height="22" rx="4" fill="#1868DB" />
                <path d="M15.52 10.44l-4.96-4.96L11 5.04 6.48 10.44a.56.56 0 000 .78L11 15.96l4.52-4.74a.56.56 0 000-.78zM11 12.84L9.16 11 11 9.16 12.84 11 11 12.84z" fill="white" />
              </svg>
            </div>
            {/* GitHub */}
            <div className="size-[36px] rounded-[6px] overflow-hidden flex items-center justify-center -mr-[5px]">
              <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
                <rect width="22" height="22" rx="4" fill="#24292F" />
                <path d="M11 4a7 7 0 00-2.21 13.64c.35.06.48-.15.48-.34v-1.2c-1.96.43-2.37-.94-2.37-.94-.32-.81-.78-1.03-.78-1.03-.64-.44.05-.43.05-.43.7.05 1.08.73 1.08.73.63 1.07 1.64.76 2.04.58.06-.46.24-.76.44-.93-1.56-.18-3.2-.78-3.2-3.48 0-.77.27-1.4.73-1.89-.08-.18-.32-.9.07-1.87 0 0 .59-.19 1.94.72a6.76 6.76 0 013.54 0c1.35-.91 1.94-.72 1.94-.72.39.97.14 1.69.07 1.87.45.5.73 1.12.73 1.89 0 2.71-1.65 3.3-3.22 3.47.25.22.48.65.48 1.31v1.94c0 .19.13.41.48.34A7 7 0 0011 4z" fill="white" />
              </svg>
            </div>
            {/* Slack */}
            <div className="size-[36px] rounded-[6px] overflow-hidden flex items-center justify-center">
              <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
                <rect width="22" height="22" rx="4" fill="#2C2C2C" />
                <path d="M8.13 13.25a1.13 1.13 0 11-2.25 0 1.13 1.13 0 012.25 0zm1.12-1.13a1.13 1.13 0 110-2.25h3.38a1.13 1.13 0 010 2.25H9.25z" fill="#2EB67D" />
                <path d="M8.75 5.88a1.13 1.13 0 10-2.25 0v3.37a1.13 1.13 0 002.25 0V5.88zm-1.12 7.87a1.13 1.13 0 10 0 2.25 1.13 1.13 0 000-2.25z" fill="#E01E5A" />
                <path d="M16.13 9.25a1.13 1.13 0 10 0-2.25h-3.38a1.13 1.13 0 000 2.25h3.38zm-7.88 1.12a1.13 1.13 0 10-2.25 0 1.13 1.13 0 002.25 0z" fill="#ECB22E" />
                <path d="M13.25 16.13a1.13 1.13 0 102.25 0v-3.38a1.13 1.13 0 00-2.25 0v3.38zm1.13-7.88a1.13 1.13 0 100-2.25 1.13 1.13 0 000 2.25z" fill="#36C5F0" />
              </svg>
            </div>
          </div>
          {/* Grid/apps icon */}
          <div className="size-[36px] rounded-[6px] overflow-hidden flex items-center justify-center">
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
              <rect x="4" y="4" width="5.5" height="5.5" rx="1.2" stroke="#8B8B8B" strokeWidth="1.2" />
              <rect x="12.5" y="4" width="5.5" height="5.5" rx="1.2" stroke="#8B8B8B" strokeWidth="1.2" />
              <rect x="4" y="12.5" width="5.5" height="5.5" rx="1.2" stroke="#8B8B8B" strokeWidth="1.2" />
              <rect x="12.5" y="12.5" width="5.5" height="5.5" rx="1.2" stroke="#8B8B8B" strokeWidth="1.2" />
            </svg>
          </div>
        </div>

        <button className="flex items-center justify-center size-[38px] rounded-[6px] text-text-muted hover:text-text-primary">
          <SearchIcon size={24} />
        </button>

        <button className="flex items-center justify-center size-[38px] rounded-[6px] text-text-muted hover:text-text-primary">
          <BellIcon size={24} />
        </button>

        <Avatar initials="A" size={38} />
      </div>
    </header>
  );
}
