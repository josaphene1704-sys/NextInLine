"use client";
import { Doc } from "@/convex/_generated/dataModel";
import { useLang } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { CheckCircle2 } from "lucide-react";

interface TimeSlot {
  startTime: number;
  endTime: number;
  label: string;
}

interface Props {
  service: Doc<"services"> | null;
  barber: Doc<"barbers"> | null;
  date: string;
  slot: TimeSlot;
  customerName: string;
  onReset: () => void;
}

const labels = {
  title: { he: "ההזמנה אושרה!", ar: "تم تأكيد الحجز!" },
  detail: { he: "פרטי התור", ar: "تفاصيل الموعد" },
  service: { he: "שירות", ar: "الخدمة" },
  stylist: { he: "מעצבת", ar: "المصففة" },
  date: { he: "תאריך", ar: "التاريخ" },
  time: { he: "שעה", ar: "الوقت" },
  newBooking: { he: "הזמני תור נוסף", ar: "احجزي موعداً آخر" },
};

export default function Confirmation({ service, barber, date, slot, customerName, onReset }: Props) {
  const { lang, t } = useLang();

  const locale = lang === "ar" ? "ar-IL" : "he-IL";
  const [y, m, d] = date.split("-").map(Number);
  const dateDisplay = new Date(Date.UTC(y, m - 1, d)).toLocaleDateString(locale, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

  const subtitle =
    lang === "ar"
      ? `شكراً ${customerName}! سنرسل لك تذكيراً قبل الموعد.`
      : `תודה ${customerName}! נשלח לך תזכורת לפני התור.`;

  return (
    <div className="text-center py-4">
      <div className="flex justify-center mb-5">
        <div className="w-20 h-20 rounded-full bg-primary/12 flex items-center justify-center">
          <CheckCircle2 className="w-10 h-10 text-primary" />
        </div>
      </div>

      <h2 className="text-2xl font-bold mb-2">{t(labels.title)}</h2>
      <p className="text-muted-foreground mb-8 text-sm">{subtitle}</p>

      <div className="bg-card border rounded-2xl p-5 text-start mb-8">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
          {t(labels.detail)}
        </p>
        <div className="space-y-2 text-sm">
          {service && (
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">{t(labels.service)}</span>
              <span className="font-medium text-end">{t(service.name)}</span>
            </div>
          )}
          {barber && (
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">{t(labels.stylist)}</span>
              <span className="font-medium text-end">{t(barber.name)}</span>
            </div>
          )}
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">{t(labels.date)}</span>
            <span className="font-medium text-end">{dateDisplay}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">{t(labels.time)}</span>
            <span className="font-medium">{slot.label}</span>
          </div>
        </div>
      </div>

      <Button onClick={onReset} variant="outline" className="w-full">
        {t(labels.newBooking)}
      </Button>
    </div>
  );
}
