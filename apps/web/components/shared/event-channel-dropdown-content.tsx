"use client";

import { Input } from "@/components/ui/input";
import { RemixIcon } from "@/components/remix-icon";

export type EventChannelItem = {
  id: string;
  title: string;
  description?: string | null;
};

type EventChannelDropdownContentProps = {
  query: string;
  onQueryChange: (value: string) => void;
  searchPlaceholder: string;
  loading: boolean;
  loadingText: string;
  emptyText: string;
  items: EventChannelItem[];
  onSelect: (item: EventChannelItem) => void;
};

/**
 * Shared event/channel list content used by chat and character task editor.
 */
export function EventChannelDropdownContent({
  query,
  onQueryChange,
  searchPlaceholder,
  loading,
  loadingText,
  emptyText,
  items,
  onSelect,
}: EventChannelDropdownContentProps) {
  return (
    <>
      <div className="p-2 border-b">
        <div className="relative">
          <RemixIcon
            name="search"
            size="size-4"
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder={searchPlaceholder}
            className="h-8 pl-9 pr-8"
          />
          {query ? (
            <button
              type="button"
              onClick={() => onQueryChange("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1"
            >
              <RemixIcon name="close" size="size-4" />
            </button>
          ) : null}
        </div>
      </div>
      <div className="max-h-[360px] overflow-y-auto p-1.5">
        {loading ? (
          <div className="px-3 py-5 text-sm text-muted-foreground">
            {loadingText}
          </div>
        ) : items.length === 0 ? (
          <div className="px-3 py-5 text-sm text-muted-foreground">
            {emptyText}
          </div>
        ) : (
          items.map((item) => (
            <button
              key={item.id}
              type="button"
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-accent hover:text-accent-foreground"
              onClick={() => onSelect(item)}
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted/80 text-muted-foreground">
                <RemixIcon name="calendar-event" size="size-4" />
              </span>
              <div className="min-w-0 flex-1">
                <span className="block truncate">{item.title}</span>
                {item.description ? (
                  <span className="block truncate text-xs text-muted-foreground">
                    {item.description}
                  </span>
                ) : null}
              </div>
            </button>
          ))
        )}
      </div>
    </>
  );
}
