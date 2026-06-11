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
  image: "bg-violet-500/10 text-violet-400 border-violet-500/20",
  video: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  audio: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
};

interface AssetRowProps {
  item: AssetItem;
  selected: boolean;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
}

function AssetRow({ item, selected, onSelect, onDelete }: AssetRowProps) {
  const handleDownload = (e: React.MouseEvent | Event) => {
    e.stopPropagation();
    if (!item.url) return;
    const link = document.createElement("a");
    link.href = item.url;
    link.download = item.name;
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  return (
    <ContextMenu>
      <ContextMenuTrigger>
        <button
          onClick={() => onSelect(item.id)}
          className={cn(
            "w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left text-xs transition-colors group relative cursor-pointer",
            selected
              ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
              : "hover:bg-sidebar-accent/55 text-sidebar-foreground/90"
          )}
        >
          {TYPE_ICON[item.type]}
          <span className="flex-1 truncate mr-2">{item.name}</span>
          <Badge
            variant="outline"
            className={cn("text-[9px] px-1 py-0 uppercase leading-3 transition-opacity hidden group-hover:inline-flex", TYPE_BADGE[item.type])}
          >
            {item.type}
          </Badge>
        </button>
      </ContextMenuTrigger>
      <ContextMenuContent className="w-36">
        <ContextMenuItem onClick={handleDownload} className="text-[11px] gap-2 cursor-pointer">
          <DownloadIcon className="size-3.5" />
          Download
        </ContextMenuItem>
        <ContextMenuItem onClick={() => onDelete(item.id)} className="text-[11px] gap-2 text-destructive focus:text-destructive focus:bg-destructive/10 cursor-pointer">
          <Trash2Icon className="size-3.5" />
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
  onDelete: (id: string) => void;
  searchFilter: string;
}

function FolderRow({ folder, selectedId, onSelect, onDelete, searchFilter }: FolderRowProps) {
  const [open, setOpen] = useState(true);

  // Filter nested folder items
  const filteredItems = folder.items.filter((item) =>
    item.name.toLowerCase().includes(searchFilter.toLowerCase())
  );

  // Hide folder entirely if search is active and no items match
  if (searchFilter && filteredItems.length === 0) return null;

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="w-full">
      <CollapsibleTrigger className="w-full flex items-center gap-1 px-1.5 py-1 rounded-md text-xs text-sidebar-foreground/80 hover:bg-sidebar-accent/40 transition-colors group cursor-pointer">
        <ChevronRightIcon
          className={cn("size-3.5 shrink-0 transition-transform text-muted-foreground/60", open && "rotate-90")}
        />
        {open ? (
          <FolderOpenIcon className="size-3.5 text-amber-400 shrink-0 fill-amber-400/20" />
        ) : (
          <FolderIcon className="size-3.5 text-amber-400 shrink-0 fill-amber-400/10" />
        )}
        <span className="flex-1 truncate text-left ml-1 text-[11px] font-medium">{folder.name}</span>
        <span className="text-[9px] text-muted-foreground/60 bg-muted px-1.5 py-0.2 rounded-full font-mono">
          {filteredItems.length}
        </span>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="ml-3.5 pl-2.5 border-l border-border/40 mt-0.5 flex flex-col gap-0.5">
          {filteredItems.map((item) => (
            <AssetRow
              key={item.id}
              item={item}
              selected={selectedId === item.id}
              onSelect={onSelect}
              onDelete={onDelete}
            />
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

interface AssetSidebarProps {
  folders: AssetFolder[];
  rootItems: AssetItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
}

export function AssetSidebar({
  folders,
  rootItems,
  selectedId,
  onSelect,
  onDelete,
}: AssetSidebarProps) {
  const [search, setSearch] = useState("");

  const filteredRootItems = rootItems.filter((item) =>
    item.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex flex-col h-full overflow-hidden bg-sidebar border-r border-sidebar-border">
      {/* ── Header ── */}
      <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-sidebar-border shrink-0">
        <span className="text-[10px] font-bold text-sidebar-foreground/80 tracking-wider uppercase">
          Creative Library
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

      {/* ── Search Input ── */}
      <div className="px-3 py-2 shrink-0">
        <div className="relative">
          <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3 text-muted-foreground/60" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search library..."
            className="h-7.5 pl-7.5 pr-2.5 text-xs bg-background/40 border-border/50 focus-visible:ring-1 focus-visible:ring-primary/40 focus-visible:border-border"
          />
        </div>
      </div>

      {/* ── Asset Tree ── */}
      <ScrollArea className="flex-1 px-2 pb-3">
        <div className="flex flex-col gap-1">
          {/* Render Folders */}
          {folders.map((folder) => (
            <FolderRow
              key={folder.id}
              folder={folder}
              selectedId={selectedId}
              onSelect={onSelect}
              onDelete={onDelete}
              searchFilter={search}
            />
          ))}

          {/* Render Root Items header if search filter is empty or matches root items */}
          {filteredRootItems.length > 0 && (
            <div className="mt-2.5 space-y-0.5">
              <span className="text-[9px] font-bold text-muted-foreground/50 uppercase px-2 select-none tracking-wider">
                Unsorted Files
              </span>
              <div className="flex flex-col gap-0.5 pt-1">
                {filteredRootItems.map((item) => (
                  <AssetRow
                    key={item.id}
                    item={item}
                    selected={selectedId === item.id}
                    onSelect={onSelect}
                    onDelete={onDelete}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Empty State when search returns no matches */}
          {filteredRootItems.length === 0 && folders.every(f => f.items.filter(i => i.name.toLowerCase().includes(search.toLowerCase())).length === 0) && (
            <div className="text-center py-6 px-4">
              <span className="text-[11px] text-muted-foreground/75">No creative assets found</span>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
