"use client";
import Image from "next/image";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id, Doc } from "@/convex/_generated/dataModel";
import { useLang } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { UserCircle2, ChevronRight } from "lucide-react";

interface Props {
  businessId: Id<"businesses">;
  serviceId: Id<"services">;
  selectedId?: Id<"barbers">;
  onSelect: (barber: Doc<"barbers">) => void;
  onBack: () => void;
}

const labels = {
  title: { he: "בחרי מעצבת", ar: "اختاري مصففتك" },
  subtitle: { he: "מי תטפל בך היום?", ar: "من ستهتم بشعرك اليوم؟" },
  back: { he: "חזור", ar: "رجوع" },
  loading: { he: "טוען...", ar: "جاري التحميل..." },
  empty: { he: "אין מעצבות זמינות לשירות זה", ar: "لا توجد مصففات متاحات لهذه الخدمة" },
};

export default function BarberPicker({ businessId, serviceId, selectedId, onSelect, onBack }: Props) {
  const { t } = useLang();
  const allBarbers = useQuery(api.barbers.getByBusiness, { businessId });

  const barbers = allBarbers?.filter(
    (b) => b.specializedServices.length === 0 || b.specializedServices.includes(serviceId)
  );

  return (
    <div>
      <div className="text-center mb-7">
        <h2 className="text-2xl font-bold">{t(labels.title)}</h2>
        <p className="text-muted-foreground mt-1 text-sm">{t(labels.subtitle)}</p>
      </div>

      {barbers === undefined && (
        <p className="text-center text-muted-foreground py-12 animate-pulse">{t(labels.loading)}</p>
      )}
      {barbers?.length === 0 && (
        <p className="text-center text-muted-foreground py-12">{t(labels.empty)}</p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
        {barbers?.map((barber) => (
          <button
            key={barber._id}
            onClick={() => onSelect(barber)}
            className={cn(
              "flex items-center gap-4 rounded-2xl border-2 p-4 text-start transition-all duration-200 hover:border-primary hover:shadow-md hover:-translate-y-0.5",
              selectedId === barber._id
                ? "border-primary bg-accent/50 shadow-md"
                : "border-border bg-card"
            )}
          >
            <div className="relative w-14 h-14 rounded-full overflow-hidden bg-muted shrink-0 flex items-center justify-center">
              {barber.avatarUrl ? (
                <Image
                  src={barber.avatarUrl}
                  alt={t(barber.name)}
                  fill
                  className="object-cover"
                  sizes="56px"
                />
              ) : (
                <UserCircle2 className="w-10 h-10 text-muted-foreground" />
              )}
            </div>
            <div>
              <p className="font-semibold">{t(barber.name)}</p>
              <p className="text-sm text-muted-foreground">{t(barber.role)}</p>
            </div>
          </button>
        ))}
      </div>

      <Button variant="ghost" onClick={onBack} className="gap-2">
        <ChevronRight className="w-4 h-4" />
        {t(labels.back)}
      </Button>
    </div>
  );
}
