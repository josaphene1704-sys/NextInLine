"use client";
import { Doc } from "@/convex/_generated/dataModel";
import { useLang } from "@/contexts/LanguageContext";
import { calcFinalPrice, HairDetailsData } from "@/lib/hair-details";
import { formatPrice } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Clock } from "lucide-react";

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
  hairDetails: HairDetailsData;
  onReset: () => void;
}

const labels = {
  title:      { he: "בקשתך התקבלה!",   ar: "تم استلام طلبك!" },
  detail:     { he: "פרטי הבקשה",       ar: "تفاصيل الطلب" },
  pending:    { he: "ממתין לאישור",     ar: "في انتظار التأكيد" },
  service:    { he: "שירות",            ar: "الخدمة" },
  stylist:    { he: "מעצבת",            ar: "المصففة" },
  date:       { he: "תאריך",            ar: "التاريخ" },
  time:       { he: "שעה",              ar: "الوقت" },
  price:      { he: "מחיר",             ar: "السعر" },
  newBooking: { he: "הזמני תור נוסף",  ar: "احجزي موعداً آخر" },
};

export default function Confirmation({ service, barber, date, slot, customerName, hairDetails, onReset }: Props) {
  const { lang, t } = useLang();
  const finalPrice = service ? calcFinalPrice(service, hairDetails.hairLength) : undefined;

  const locale = lang === "ar" ? "ar-IL" : "he-IL";
  const [y, m, d] = date.split("-").map(Number);
  const dateDisplay = new Date(Date.UTC(y, m - 1, d)).toLocaleDateString(locale, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

  const thankYou = lang === "ar"
    ? `شكراً ${customerName}!`
    : `תודה ${customerName}!`;

  const subtext = lang === "ar"
    ? "موعدك في انتظار تأكيد صاحب العمل. سنُعلمك فور تأكيده."
    : "התור ממתין לאישור של בית העסק. נעדכן אותך ברגע שהתור יאושר.";

  return (
    <div className="text-center py-4 animate-float-up">

      {/* Pending icon ring */}
      <div className="flex justify-center mb-5">
        <div className="w-20 h-20 rounded-full pending-ring flex items-center justify-center">
          <Clock className="w-9 h-9" />
        </div>
      </div>

      {/* Headings */}
      <h2 className="text-2xl font-bold mb-1">{t(labels.title)}</h2>
      <p className="text-base font-medium text-foreground/75 mb-2">{thankYou}</p>
      <p className="text-muted-foreground mb-8 text-sm max-w-xs mx-auto leading-relaxed">
        {subtext}
      </p>

      {/* Details card */}
      <div className="glass-panel p-5 text-start mb-8">

        {/* Header row: label + status chip */}
        <div className="flex items-center justify-between mb-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t(labels.detail)}
          </p>
          <span className="status-badge status-badge-pending">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
            {t(labels.pending)}
          </span>
        </div>

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
          {finalPrice !== undefined && (
            <div className="flex justify-between gap-4 pt-2 border-t mt-2">
              <span className="text-muted-foreground">{t(labels.price)}</span>
              <span className="font-bold text-primary">{formatPrice(finalPrice)}</span>
            </div>
          )}
        </div>
      </div>

      <Button onClick={onReset} variant="outline" className="w-full">
        {t(labels.newBooking)}
      </Button>
    </div>
  );
}
