"use client";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { COLOR_CATEGORIES, getColorByCode, getColorsByCategory } from "@/lib/colors";
import { Check, ChevronDown, X } from "lucide-react";

export default function ColorPicker({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string | undefined;
  onChange: (code: string | undefined) => void;
}) {
  const [open, setOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState(COLOR_CATEGORIES[0]);
  const containerRef = useRef<HTMLDivElement>(null);
  const tabsRef = useRef<HTMLDivElement>(null);

  const selected = getColorByCode(value);
  const colorsInCategory = getColorsByCategory(activeCategory);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  useEffect(() => {
    if (open && selected) {
      setActiveCategory(selected.category);
    }
  }, [open]);

  function pick(code: string) {
    onChange(code);
    setOpen(false);
  }

  return (
    <div className="space-y-1.5" ref={containerRef} dir="rtl">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>

      <div className="relative">
        {/* Trigger */}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className={cn(
            "w-full flex items-center gap-2 rounded-xl border bg-background px-3 py-2 text-right transition-colors",
            open
              ? "border-primary ring-1 ring-primary/30"
              : "border-border hover:border-primary/50"
          )}
        >
          {selected ? (
            <div className="w-9 h-9 rounded-lg overflow-hidden border border-border shrink-0">
              <img
                src={selected.imagePath}
                alt={selected.name}
                className="w-full h-full object-cover"
              />
            </div>
          ) : (
            <span
              className="w-9 h-9 rounded-lg border-2 border-dashed border-border shrink-0"
              aria-hidden
            />
          )}

          <span className="flex-1 min-w-0 truncate text-sm">
            {selected ? (
              <>
                <span className="font-semibold">{selected.nameHe}</span>
                <span className="text-muted-foreground"> · {selected.code}</span>
              </>
            ) : (
              <span className="text-muted-foreground">בחרי צבע מהקטלוג</span>
            )}
          </span>

          {selected ? (
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation();
                onChange(undefined);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.stopPropagation();
                  onChange(undefined);
                }
              }}
              className="shrink-0 w-6 h-6 -my-1 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              title="נקה בחירה"
            >
              <X className="w-3.5 h-3.5" />
            </span>
          ) : (
            <ChevronDown
              className={cn(
                "w-4 h-4 text-muted-foreground shrink-0 transition-transform",
                open && "rotate-180"
              )}
            />
          )}
        </button>

        {/* Dropdown */}
        {open && (
          <div className="absolute z-30 mt-1.5 w-full rounded-xl border border-border bg-popover shadow-xl overflow-hidden">
            {/* Category tabs */}
            <div
              ref={tabsRef}
              className="flex gap-1.5 overflow-x-auto border-b border-border px-2.5 py-2 scrollbar-none"
              style={{ scrollbarWidth: "none" }}
            >
              {COLOR_CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setActiveCategory(cat)}
                  className={cn(
                    "shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all whitespace-nowrap",
                    activeCategory === cat
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "bg-muted text-muted-foreground hover:text-foreground hover:bg-muted/80"
                  )}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Color grid */}
            <div className="grid grid-cols-3 gap-3 p-3 max-h-72 overflow-y-auto bg-white">
              {colorsInCategory.map((c) => {
                const isActive = c.code === value;
                return (
                  <button
                    key={c.code}
                    type="button"
                    onClick={() => pick(c.code)}
                    className={cn(
                      "relative rounded-xl overflow-hidden border-2 transition-all focus:outline-none",
                      isActive
                        ? "border-primary shadow-md scale-[1.06]"
                        : "border-transparent hover:border-primary/40 hover:scale-[1.03]"
                    )}
                  >
                    <div className="aspect-square w-full">
                      <img
                        src={c.imagePath}
                        alt={c.name}
                        className="w-full h-full object-cover bg-white"
                        loading="lazy"
                      />
                    </div>
                    <p className="text-[11px] font-semibold text-center py-1 px-0.5 bg-white leading-tight truncate">
                      {c.nameHe}
                    </p>
                    {isActive && (
                      <div className="absolute top-1 right-1 w-4 h-4 rounded-full bg-primary flex items-center justify-center shadow">
                        <Check className="w-2.5 h-2.5 text-white" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
