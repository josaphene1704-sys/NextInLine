"use client";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id, Doc } from "@/convex/_generated/dataModel";
import { useLang } from "@/contexts/LanguageContext";
import { cn, formatPrice, formatDuration } from "@/lib/utils";
import { Clock, Sparkles } from "lucide-react";

interface Props {
  businessId: Id<"businesses">;
  selectedId?: Id<"services">;
  onSelect: (service: Doc<"services">) => void;
}

const labels = {
  title: { he: "בחרי שירות", ar: "اختاري خدمتك" },
  subtitle: { he: "במה נוכל לפנק אותך היום?", ar: "كيف يمكننا تدليلك اليوم؟" },
  loading: { he: "טוען שירותים...", ar: "جاري تحميل الخدمات..." },
  empty: { he: "אין שירותים זמינים כרגע", ar: "لا توجد خدمات متاحة حالياً" },
};

export default function ServicePicker({ businessId, selectedId, onSelect }: Props) {
  const { lang, t } = useLang();
  const services = useQuery(api.services.getByBusiness, { businessId });

  return (
    <div>
      <div className="text-center mb-7">
        <div className="flex justify-center mb-3">
          <div className="w-11 h-11 rounded-full bg-primary/10 flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-primary" />
          </div>
        </div>
        <h2 className="text-2xl font-bold">{t(labels.title)}</h2>
        <p className="text-muted-foreground mt-1 text-sm">{t(labels.subtitle)}</p>
      </div>

      {services === undefined && (
        <p className="text-center text-muted-foreground py-12 animate-pulse">{t(labels.loading)}</p>
      )}
      {services?.length === 0 && (
        <p className="text-center text-muted-foreground py-12">{t(labels.empty)}</p>
      )}

      <div className="grid gap-3">
        {services?.map((service) => (
          <button
            key={service._id}
            onClick={() => onSelect(service)}
            className={cn(
              "w-full text-start rounded-2xl border-2 p-4 transition-all duration-200 hover:border-primary hover:shadow-md hover:-translate-y-0.5",
              selectedId === service._id
                ? "border-primary bg-accent/50 shadow-md"
                : "border-border bg-card"
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <p className="font-semibold">{t(service.name)}</p>
                <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2">
                  {t(service.description)}
                </p>
              </div>
              <div className="flex flex-col items-end gap-1 shrink-0">
                <span className="text-lg font-bold text-primary">{formatPrice(service.price)}</span>
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="w-3 h-3" />
                  {formatDuration(service.duration, lang)}
                </span>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
