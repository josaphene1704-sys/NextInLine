"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Images } from "lucide-react";

export function GalleryPreviewButton({
  businessId,
  onClick,
}: {
  businessId: Id<"businesses">;
  onClick: () => void;
}) {
  const galleryItems = useQuery(api.gallery.getByBusiness, { businessId });

  if (!galleryItems || galleryItems.length === 0) return null;

  const previews = galleryItems
    .filter((i) => i.url)
    .slice(0, 3);

  return (
    <button
      onClick={onClick}
      className="mt-5 mx-auto flex items-center gap-3 px-4 py-2.5 rounded-2xl border border-border/60 bg-card/80 backdrop-blur-sm shadow-sm hover:shadow-md hover:border-primary/40 transition-all duration-200 group"
      dir="rtl"
    >
      {/* Thumbnail collage */}
      <div className="flex -space-x-2 rtl:space-x-reverse">
        {previews.map((item, i) => (
          <div
            key={item._id}
            className="w-9 h-9 rounded-xl overflow-hidden border-2 border-card shrink-0"
            style={{ zIndex: previews.length - i }}
          >
            <img
              src={item.url!}
              alt=""
              className="w-full h-full object-cover"
            />
          </div>
        ))}
        {galleryItems.length > 3 && (
          <div
            className="w-9 h-9 rounded-xl border-2 border-card bg-muted flex items-center justify-center shrink-0"
            style={{ zIndex: 0 }}
          >
            <span className="text-[10px] font-semibold text-muted-foreground">
              +{galleryItems.length - 3}
            </span>
          </div>
        )}
      </div>

      {/* Label */}
      <div className="text-right">
        <p className="text-sm font-semibold leading-none group-hover:text-primary transition-colors">
          גלרייה
        </p>
        <p className="text-[11px] text-muted-foreground mt-0.5 leading-none">
          {galleryItems.length} תמונות
        </p>
      </div>

      <Images className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0 mr-1" />
    </button>
  );
}
