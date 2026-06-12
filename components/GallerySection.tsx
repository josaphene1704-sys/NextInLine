"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";

const ALL_KEY = "__all__";

export function GallerySection({
  businessId,
  onClose,
}: {
  businessId: Id<"businesses">;
  onClose?: () => void;
}) {
  const services = useQuery(api.services.getByBusiness, { businessId });
  const galleryItems = useQuery(api.gallery.getByBusiness, { businessId });
  const [activeServiceId, setActiveServiceId] = useState<string>(ALL_KEY);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  if (!galleryItems || galleryItems.length === 0) return null;

  const servicesWithPhotos = services?.filter((s) =>
    galleryItems.some((i) => i.serviceId === s._id)
  ) ?? [];

  const visibleItems = galleryItems.filter((item) =>
    activeServiceId === ALL_KEY ? true : item.serviceId === activeServiceId
  );

  return (
    <section className="max-w-2xl mx-auto px-4 pb-8" dir="rtl">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold">גלרייה</h2>
        {onClose && (
          <button
            onClick={onClose}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-3.5 h-3.5" />
            סגור
          </button>
        )}
      </div>

      {/* Service filter tabs */}
      {servicesWithPhotos.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-2 mb-4" style={{ scrollbarWidth: "none" }}>
          <button
            onClick={() => setActiveServiceId(ALL_KEY)}
            className={cn(
              "shrink-0 px-3 h-8 rounded-full border text-xs font-medium transition-colors",
              activeServiceId === ALL_KEY
                ? "bg-primary text-primary-foreground border-primary"
                : "border-border text-muted-foreground hover:border-primary"
            )}
          >
            הכל
          </button>
          {servicesWithPhotos.map((s) => (
            <button
              key={s._id}
              onClick={() => setActiveServiceId(s._id)}
              className={cn(
                "shrink-0 px-3 h-8 rounded-full border text-xs font-medium transition-colors",
                activeServiceId === s._id
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-border text-muted-foreground hover:border-primary"
              )}
            >
              {s.name.he}
            </button>
          ))}
        </div>
      )}

      {/* Photo grid */}
      <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4">
        {visibleItems.map((item) =>
          item.url ? (
            <button
              key={item._id}
              onClick={() => setLightboxUrl(item.url!)}
              className="aspect-square rounded-xl overflow-hidden border border-border/40 bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <img
                src={item.url}
                alt={item.caption ?? "תמונת גלרייה"}
                className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                loading="lazy"
              />
            </button>
          ) : null
        )}
      </div>

      {/* Lightbox */}
      {lightboxUrl && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setLightboxUrl(null)}
        >
          <button
            className="absolute top-4 right-4 w-9 h-9 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-colors"
            onClick={() => setLightboxUrl(null)}
            aria-label="סגור"
          >
            <X className="w-5 h-5" />
          </button>
          <img
            src={lightboxUrl}
            alt="תמונת גלרייה"
            className="max-w-full max-h-[90vh] rounded-xl object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </section>
  );
}
