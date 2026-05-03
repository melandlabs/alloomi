"use client";

import { RemixIcon } from "@/components/remix-icon";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type SkillDropdownItem = {
  id: string;
  name: string;
  description?: string;
};

type SkillDropdownContentProps = {
  title: string;
  manageLabel?: string;
  searchPlaceholder: string;
  query: string;
  onQueryChange: (value: string) => void;
  onManageClick?: () => void;
  skills: SkillDropdownItem[];
  highlightedIndex?: number;
  emptyText: string;
  searchHintText?: string;
  onSelect: (skill: SkillDropdownItem) => void;
  onSearchKeyDown?: (event: React.KeyboardEvent<HTMLInputElement>) => void;
  searchInputRef?: React.RefObject<HTMLInputElement | null>;
  dense?: boolean;
};

/**
 * Shared skill dropdown content used by chat and character task editor.
 */
export function SkillDropdownContent({
  title,
  manageLabel,
  searchPlaceholder,
  query,
  onQueryChange,
  onManageClick,
  skills,
  highlightedIndex,
  emptyText,
  searchHintText,
  onSelect,
  onSearchKeyDown,
  searchInputRef,
  dense = false,
}: SkillDropdownContentProps) {
  return (
    <>
      <div className="px-0 pt-0 pb-3">
        <div className="px-1 pb-2 flex items-center justify-between gap-2">
          <span className="text-xs font-normal text-muted-foreground">
            {title}
          </span>
          {onManageClick && manageLabel ? (
            <button
              type="button"
              onClick={onManageClick}
              className="text-xs font-medium text-primary transition-colors hover:text-primary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-popover rounded-sm px-1 py-0.5"
            >
              {manageLabel}
            </button>
          ) : null}
        </div>
        <div className="relative">
          <RemixIcon
            name="search"
            size="size-4"
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            ref={searchInputRef}
            type="text"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            onKeyDown={onSearchKeyDown}
            className="w-full rounded-lg border border-border/70 bg-background/70 py-2 pr-3 pl-9 text-sm outline-none transition-colors placeholder:text-muted-foreground/70 focus-visible:ring-2 focus-visible:ring-ring"
            placeholder={searchPlaceholder}
            aria-label={searchPlaceholder}
          />
        </div>
      </div>

      {skills.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 px-4 py-6 text-center">
          <span className="text-muted-foreground/80 text-sm">{emptyText}</span>
          {searchHintText ? (
            <span className="text-xs text-muted-foreground/60">
              {searchHintText}
            </span>
          ) : null}
        </div>
      ) : (
        <div className="list-none m-0 flex flex-col gap-0.5 p-0" role="listbox">
          {skills.map((skill, index) => {
            const isHighlighted = highlightedIndex === index;
            return (
              <div key={skill.id} role="option" aria-selected={isHighlighted}>
                <button
                  type="button"
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition-colors",
                    "hover:bg-accent hover:text-accent-foreground",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-popover",
                    isHighlighted &&
                      "bg-accent text-accent-foreground shadow-sm",
                    dense && "py-1.5",
                  )}
                  onClick={() => onSelect(skill)}
                >
                  <div className="flex-1 min-w-0">
                    <span className="flex items-center gap-1.5 truncate">
                      <RemixIcon
                        name="apps_2_ai"
                        size="size-4"
                        className={cn(
                          "shrink-0",
                          isHighlighted
                            ? "text-primary"
                            : "text-muted-foreground",
                        )}
                      />
                      <span className="block truncate align-middle font-normal">
                        {skill.name}
                      </span>
                    </span>
                  </div>
                </button>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
