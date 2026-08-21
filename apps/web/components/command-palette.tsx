"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import {
  BarChart3,
  Bot,
  Boxes,
  CircleHelp,
  FileText,
  History,
  LayoutDashboard,
  Search,
  Settings,
  Shield,
  Users,
  type LucideIcon,
} from "lucide-react";
import { Dialog } from "@/components/ui/dialog";

type Command = {
  href: Route;
  icon: LucideIcon;
  label: string;
  keywords: string;
};

const commands: Command[] = [
  { href: "/app", icon: LayoutDashboard, label: "Overview", keywords: "dashboard home" },
  { href: "/app/documents", icon: FileText, label: "Documents", keywords: "upload files library" },
  { href: "/app/collections", icon: Boxes, label: "Collections", keywords: "folders access" },
  { href: "/app/chat", icon: Bot, label: "Ask Kivo", keywords: "chat question answer" },
  { href: "/app/search", icon: Search, label: "Search", keywords: "find query" },
  { href: "/app/analytics", icon: BarChart3, label: "Analytics", keywords: "usage quota" },
  { href: "/app/members", icon: Users, label: "Members", keywords: "invite team roles" },
  { href: "/app/audit", icon: History, label: "Audit log", keywords: "history events" },
  { href: "/app/settings", icon: Settings, label: "Settings", keywords: "workspace retention" },
  { href: "/docs", icon: CircleHelp, label: "Help & docs", keywords: "documentation api" },
];

const adminCommand: Command = {
  href: "/app/admin",
  icon: Shield,
  label: "Platform admin",
  keywords: "quota suspend organizations",
};

export function CommandPalette({
  open,
  onClose,
  platformAdmin,
}: {
  open: boolean;
  onClose: () => void;
  platformAdmin: boolean;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setQuery("");
      setActiveIndex(0);
      // The dialog opens via showModal in an effect; focus after that tick.
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  const available = useMemo(
    () => (platformAdmin ? [...commands, adminCommand] : commands),
    [platformAdmin],
  );
  const trimmed = query.trim().toLowerCase();
  const matches = useMemo(
    () =>
      available.filter(
        ({ label, keywords }) =>
          !trimmed ||
          label.toLowerCase().includes(trimmed) ||
          keywords.toLowerCase().includes(trimmed),
      ),
    [available, trimmed],
  );
  const searchable = trimmed.length >= 2;
  const optionCount = matches.length + (searchable ? 1 : 0);
  const active = Math.min(activeIndex, Math.max(optionCount - 1, 0));

  function run(index: number) {
    const match = matches[index];
    const target = match
      ? match.href
      : (`/app/search?q=${encodeURIComponent(query.trim())}` as Route);
    onClose();
    router.push(target);
  }

  return (
    <Dialog open={open} onClose={onClose} label="Command menu" className="palette-dialog">
      <input
        ref={inputRef}
        aria-label="Command"
        role="combobox"
        aria-expanded="true"
        aria-controls="palette-options"
        aria-activedescendant={optionCount ? `palette-option-${active}` : undefined}
        className="palette-input"
        placeholder="Go to page or search your knowledge…"
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          setActiveIndex(0);
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") {
            event.preventDefault();
            setActiveIndex((index) => Math.min(index + 1, optionCount - 1));
          } else if (event.key === "ArrowUp") {
            event.preventDefault();
            setActiveIndex((index) => Math.max(index - 1, 0));
          } else if (event.key === "Enter" && optionCount) {
            event.preventDefault();
            run(active);
          }
        }}
      />
      <ul id="palette-options" role="listbox" aria-label="Commands" className="palette-list">
        {matches.map(({ href, icon: Icon, label }, index) => (
          <li
            key={href}
            id={`palette-option-${index}`}
            role="option"
            aria-selected={index === active}
            className="palette-option"
            onMouseEnter={() => setActiveIndex(index)}
            onMouseDown={(event) => {
              event.preventDefault();
              run(index);
            }}
          >
            <Icon />
            {label}
          </li>
        ))}
        {searchable && (
          <li
            id={`palette-option-${matches.length}`}
            role="option"
            aria-selected={active === matches.length}
            className="palette-option"
            onMouseEnter={() => setActiveIndex(matches.length)}
            onMouseDown={(event) => {
              event.preventDefault();
              run(matches.length);
            }}
          >
            <Search />
            Search for “{query.trim()}”
          </li>
        )}
        {!optionCount && <li className="palette-empty">No matching pages.</li>}
      </ul>
      <div className="palette-hint" aria-hidden>
        <span>↑↓ navigate</span>
        <span>↵ open</span>
        <span>esc close</span>
      </div>
    </Dialog>
  );
}
