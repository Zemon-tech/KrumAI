"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  ChevronRightIcon,
  FolderIcon,
  FolderOpenIcon,
  ImageIcon,
  VideoIcon,
  MusicIcon,
  PlusIcon,
  SearchIcon,
  MoreHorizontalIcon,
  Trash2Icon,
  DownloadIcon,
} from "lucide-react";
import { Input } from "@/components/ui/input";

export type AssetType = "image" | "video" | "audio";

export interface AssetItem {
  id: string;
  name: string;
  type: AssetType;
  url?: string;
  createdAt: Date;
  prompt?: string;
  model?: string;
}

export interface AssetFolder {
  id: string;
  name: string;
  items: AssetItem[];
}

const TYPE_ICON: Record<AssetType, React.ReactNode> = {
  image: <ImageIcon className="size-3.5 text-violet-400 shrink-0" />,
  video: <VideoIcon className="size-3.5 text-blue-400 shrink-0" />,
  audio: <MusicIcon className="size-3.5 text-emerald-400 shrink-0" />,
};

const TYPE_BADGE: Record<AssetType, string> = {
  image: "bg-violet-500/15 text-violet-400 border-violet-500/20",
  video: "bg-blue-500/15 text-blue-400 border-blue-500/20",
  audio: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
};

// Demo data — replace with real state once backend is wired
const DEMO_FOLDERS: AssetFolder[] = [
  {
    id: "f1",
    name: "Landscapes",
    items: [
      { id: "a1", name: "mountain_sunset.png", type: "image", createdAt: new Date(), prompt: "mountain at sunset", model: "SDXL" },
      { id: "a2", name: "ocean_waves.mp4", type: "video", createdAt: new Date(), prompt: "ocean waves crashing", model: "CogVideoX" },
    ],
  },
  {
    id: "f2",
    name: "Portraits",
    items: [
      { id: "a3", name: "portrait_01.png", type: "image", createdAt: new Date(), prompt: "cinematic portrait", model: "FLUX" },
    ],
  },
];

const ROOT_ITEMS: AssetItem[] = [
  { id: "a4", name: "ambient_loop.wav", type: "audio", createdAt: new Date(), prompt: "ambient music loop", model: "AudioCraft" },
  { id: "a5", name: "abstract_01.png", type: "image", createdAt: new Date(), prompt: "abstract colorful art", model: "SDXL" },
];

interface AssetRowProps {
  item: AssetItem;
  selected: boolean;
  onSelect: (id: string) => void;
}

function AssetRow({ item, selected, onSelect }: AssetRowProps) {
  return (
    <ContextMenu>
      <ContextMenuTrigger>
        <button
          onClick={() => onSelect(item.id)}
          className={cn(
            "w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left text-xs transition-colors group",
            selected
              ? "bg-sidebar-accent text-sidebar-accent-foreground"
              : "hover:bg-sidebar-accent/50 text-sidebar-foreground"
          )}
        >
          {TYPE_ICON[item.type]}
          <span className="flex-1 truncate">{item.name}</span>
          <Badge
            variant="outline"
            className={cn("text-[10px] px-1 py-0 hidden group-hover:inline-flex", TYPE_BADGE[item.type])}
          >
            {item.type}
          </Badge>
        </button>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem>
          <DownloadIcon className="size-3.5 mr-2" />
          Download
        </ContextMenuItem>
        <ContextMenuItem className="text-destructive">
          <Trash2Icon className="size-3.5 mr-2" />
          Delete
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}

interface FolderRowProps {
  folder: AssetFolder;
  selectedId: string | null;
  onSelect: (id: string) => void;
}

function FolderRow({ folder, selectedId, onSelect }: FolderRowProps) {
  const [open, setOpen] = useState(true);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="w-full flex items-center gap-1.5 px-2 py-1.5 rounded-md text-xs text-sidebar-foreground hover:bg-sidebar-accent/50 transition-colors group">
        <ChevronRightIcon
          className={cn("size-3 shrink-0 transition-transform text-muted-foreground", open && "rotate-90")}
        />
        {open
          ? <FolderOpenIcon className="size-3.5 text-yellow-400 shrink-0" />
          : <FolderIcon className="size-3.5 text-yellow-400 shrink-0" />
        }
        <span className="flex-1 truncate text-left">{folder.name}</span>
        <span className="text-[10px] text-muted-foreground">{folder.items.length}</span>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="ml-4 mt-0.5 flex flex-col gap-0.5">
          {folder.items.map((item) => (
            <AssetRow
              key={item.id}
              item={item}
              selected={selectedId === item.id}
              onSelect={onSelect}
            />
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

interface AssetSidebarProps {
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function AssetSidebar({ selectedId, onSelect }: AssetSidebarProps) {
  const [search, setSearch] = useState("");

  return (
    <div className="flex flex-col h-full overflow-hidden bg-sidebar border-r border-sidebar-border">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-3 border-b border-sidebar-border shrink-0">
        <span className="text-xs font-semibold text-sidebar-foreground tracking-wide uppercase">
          Assets
        </span>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon-sm" className="size-6 text-muted-foreground hover:text-foreground">
            <PlusIcon className="size-3.5" />
          </Button>
          <Button variant="ghost" size="icon-sm" className="size-6 text-muted-foreground hover:text-foreground">
            <MoreHorizontalIcon className="size-3.5" />
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="px-2 py-2 shrink-0">
        <div className="relative">
          <SearchIcon className="absolute left-2 top-1/2 -translate-y-1/2 size-3 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search assets..."
            className="h-7 pl-6 text-xs bg-background/50"
          />
        </div>
      </div>

      {/* Tree */}
      <ScrollArea className="flex-1 px-2 pb-2">
        <div className="flex flex-col gap-0.5">
          {DEMO_FOLDERS.map((folder) => (
            <FolderRow
              key={folder.id}
              folder={folder}
              selectedId={selectedId}
              onSelect={onSelect}
            />
          ))}
          {/* Root-level items */}
          <div className="mt-1 flex flex-col gap-0.5">
            {ROOT_ITEMS.map((item) => (
              <AssetRow
                key={item.id}
                item={item}
                selected={selectedId === item.id}
                onSelect={onSelect}
              />
            ))}
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
