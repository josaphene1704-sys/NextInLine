import { Megaphone } from "lucide-react";

/**
 * Prominent shop announcement shown to customers on the home / salon page.
 * Renders nothing when there is no announcement text.
 */
export function AnnouncementBanner({ text }: { text?: string | null }) {
  if (!text || !text.trim()) return null;

  return (
    <div
      dir="rtl"
      className="mt-6 mx-auto max-w-md rounded-2xl bg-primary/10 border-2 border-primary/30 shadow-sm px-4 py-3.5 flex items-start gap-3 text-right"
    >
      <div className="w-9 h-9 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
        <Megaphone className="w-5 h-5 text-primary" />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-bold text-primary mb-0.5">הודעה</p>
        <p className="text-sm font-medium text-foreground whitespace-pre-line break-words">
          {text}
        </p>
      </div>
    </div>
  );
}
