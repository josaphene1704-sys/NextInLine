"use client";

import { useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { ImagePlus, Trash2, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAdminSession } from "@/contexts/AdminSessionContext";

const ALL_KEY = "__all__";

export function GalleryManager({ businessId }: { businessId: Id<"businesses"> }) {
  const { session } = useAdminSession();
  const services = useQuery(api.services.getAllByBusiness, { businessId });
  const galleryItems = useQuery(api.gallery.getByBusiness, { businessId });
  const addPhotoRaw = useMutation(api.gallery.add);
  const removePhotoRaw = useMutation(api.gallery.remove);
  const generateUploadUrl = useMutation(api.files.generateUploadUrl);
  const addPhoto = (args: Omit<Parameters<typeof addPhotoRaw>[0], "token">) =>
    addPhotoRaw({ ...args, token: session?.token ?? "" });
  const removePhoto = (args: Omit<Parameters<typeof removePhotoRaw>[0], "token">) =>
    removePhotoRaw({ ...args, token: session?.token ?? "" });

  const [activeServiceId, setActiveServiceId] = useState<string>(ALL_KEY);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const activeServiceIdForQuery =
    activeServiceId === ALL_KEY ? undefined : (activeServiceId as Id<"services">);

  const visibleItems =
    galleryItems?.filter((item) =>
      activeServiceId === ALL_KEY
        ? true
        : item.serviceId === activeServiceId
    ) ?? [];

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    setError(null);
    try {
      for (const file of Array.from(files)) {
        const uploadUrl = await generateUploadUrl();
        const res = await fetch(uploadUrl, {
          method: "POST",
          headers: { "Content-Type": file.type },
          body: file,
        });
        if (!res.ok) throw new Error("Upload failed");
        const { storageId } = await res.json();
        await addPhoto({
          businessId,
          serviceId: activeServiceId === ALL_KEY ? undefined : (activeServiceId as Id<"services">),
          storageId,
        });
      }
    } catch {
      setError("העלאת התמונה נכשלה. נסי שוב.");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function handleRemovePhoto(galleryId: Id<"gallery">) {
    setError(null);
    try {
      await removePhoto({ galleryId });
    } catch {
      setError("מחיקת התמונה נכשלה. נסי שוב.");
    }
  }

  if (!services || !galleryItems) {
    return <div className="text-sm text-muted-foreground">טוען גלרייה...</div>;
  }

  return (
    <div className="space-y-5" dir="rtl">
      {/* Service tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
        <button
          onClick={() => setActiveServiceId(ALL_KEY)}
          className={cn(
            "shrink-0 px-3 h-8 rounded-full border text-xs font-medium transition-colors",
            activeServiceId === ALL_KEY
              ? "bg-primary text-primary-foreground border-primary"
              : "border-border text-muted-foreground hover:border-primary"
          )}
        >
          הכל ({galleryItems.length})
        </button>
        {services.map((s) => {
          const count = galleryItems.filter((i) => i.serviceId === s._id).length;
          return (
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
              {s.name.he} ({count})
            </button>
          );
        })}
        <button
          onClick={() => setActiveServiceId("__none__")}
          className={cn(
            "shrink-0 px-3 h-8 rounded-full border text-xs font-medium transition-colors",
            activeServiceId === "__none__"
              ? "bg-primary text-primary-foreground border-primary"
              : "border-border text-muted-foreground hover:border-primary"
          )}
        >
          כללי ({galleryItems.filter((i) => !i.serviceId).length})
        </button>
      </div>

      {/* Upload button */}
      <div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
        <button
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="flex items-center gap-2 px-4 py-2 rounded-xl border border-dashed border-primary/50 text-sm font-medium text-primary hover:bg-primary/5 transition-colors disabled:opacity-50"
        >
          {uploading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <ImagePlus className="w-4 h-4" />
          )}
          {uploading ? "מעלה תמונות..." : "העלי תמונות"}
          {activeServiceId !== ALL_KEY && activeServiceId !== "__none__" && (
            <span className="text-muted-foreground font-normal">
              — {services.find((s) => s._id === activeServiceId)?.name.he}
            </span>
          )}
        </button>
      </div>

      {error && (
        <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      {/* Photo grid */}
      {visibleItems.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground border border-dashed border-border/60 rounded-2xl">
          <ImagePlus className="w-10 h-10 mb-3 opacity-30" />
          <p className="text-sm">אין תמונות בקטגוריה זו</p>
          <p className="text-xs mt-1 opacity-60">לחצי על "העלי תמונות" להוספה</p>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {visibleItems.map((item) => (
            <div key={item._id} className="group relative aspect-square rounded-xl overflow-hidden border border-border/60 bg-muted">
              {item.url ? (
                <img
                  src={item.url}
                  alt={item.caption ?? "תמונת גלרייה"}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs">
                  לא נטען
                </div>
              )}
              {/* Service label */}
              {item.serviceId && activeServiceId === ALL_KEY && (
                <div className="absolute bottom-0 inset-x-0 bg-black/60 px-2 py-1">
                  <p className="text-[10px] text-white truncate">
                    {services.find((s) => s._id === item.serviceId)?.name.he}
                  </p>
                </div>
              )}
              {/* Delete overlay */}
              <button
                onClick={() => handleRemovePhoto(item._id)}
                className="absolute top-1.5 left-1.5 w-7 h-7 rounded-full bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive"
                title="מחק תמונה"
              >
                <Trash2 className="w-3.5 h-3.5 text-white" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
