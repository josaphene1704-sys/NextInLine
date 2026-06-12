"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { formatPrice, formatSlotTime } from "@/lib/utils";
import { getColorByCode } from "@/lib/colors";
import { X, User, Calendar, CheckCircle2, Clock, Phone } from "lucide-react";

const STATUS_LABEL: Record<string, string> = {
  pending:   "ממתין",
  confirmed: "מאושר",
  cancelled: "בוטל",
};
const STATUS_COLOR: Record<string, string> = {
  pending:   "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  confirmed: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  cancelled: "bg-red-100  text-red-700  dark:bg-red-900/30  dark:text-red-400",
};
const HAIR_LABEL: Record<string, string> = {
  hairLength: "אורך", hairCondition: "מצב", bleachHistory: "הבהרות",
  grayHairPercentage: "שיבה", previousKeratin: "קראטין",
};

interface Props {
  customerPhone: string;
  customerName: string;
  timezone: string;
  onClose: () => void;
}

export function CustomerProfileDrawer({ customerPhone, customerName, timezone, onClose }: Props) {
  const appointments = useQuery(api.appointments.getCustomerProfile, { customerPhone });

  const now       = Date.now();
  const upcoming  = appointments?.filter((a) => a.startTime > now && a.status !== "cancelled") ?? [];
  const total     = appointments?.length ?? 0;
  const confirmed = appointments?.filter((a) => a.status === "confirmed").length ?? 0;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Drawer panel */}
      <div
        className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-background shadow-2xl flex flex-col overflow-hidden"
        dir="rtl"
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-border shrink-0">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <User className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-sm truncate">{customerName}</p>
            <p className="text-xs text-muted-foreground font-mono flex items-center gap-1">
              <Phone className="w-3 h-3" />{customerPhone}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Stats */}
        {appointments !== undefined && (
          <div className="grid grid-cols-3 gap-2 px-4 py-3 border-b border-border shrink-0">
            <MiniStat icon={<Calendar className="w-3.5 h-3.5" />} value={total}          label="סה״כ" />
            <MiniStat icon={<Clock className="w-3.5 h-3.5" />}    value={upcoming.length} label="קרובים" color="text-primary" />
            <MiniStat icon={<CheckCircle2 className="w-3.5 h-3.5" />} value={confirmed}  label="אושרו"  color="text-green-600" />
          </div>
        )}

        {/* Appointment list */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
          {appointments === undefined && (
            <div className="flex justify-center py-12">
              <div className="w-6 h-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
            </div>
          )}

          {appointments?.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-12">אין תורים בהיסטוריה</p>
          )}

          {appointments?.map((appt) => {
            const start = formatSlotTime(appt.startTime, timezone, "he");
            const end   = formatSlotTime(appt.endTime,   timezone, "he");
            const [y, m, d] = new Date(appt.startTime).toISOString().slice(0, 10).split("-").map(Number);
            const dateDisplay = new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("he-IL", {
              weekday: "short", day: "numeric", month: "long", timeZone: "UTC",
            });
            const hd = appt.hairDetails;

            return (
              <div
                key={appt._id}
                className={`rounded-2xl border border-border/60 bg-card overflow-hidden ${appt.status === "cancelled" ? "opacity-55" : ""}`}
              >
                <div className="p-3.5 space-y-2.5">

                  {/* Top row */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold text-sm leading-tight truncate">
                        {appt.service?.name?.he ?? "שירות"}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {dateDisplay} · {start}–{end}
                      </p>
                      {appt.barber && (
                        <p className="text-xs text-muted-foreground">
                          {appt.barber.name?.he}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-1.5 shrink-0">
                      <span className={`text-[10px] font-semibold rounded-full px-2 py-0.5 ${STATUS_COLOR[appt.status]}`}>
                        {STATUS_LABEL[appt.status]}
                      </span>
                      {appt.service?.price && (
                        <span className="text-[11px] text-muted-foreground">{formatPrice(appt.service.price)}</span>
                      )}
                    </div>
                  </div>

                  {/* Hair details */}
                  {hd && (
                    <div className="border-t border-border/40 pt-2.5 space-y-2">

                      {/* Chips */}
                      {(["hairLength","hairCondition","bleachHistory","grayHairPercentage","previousKeratin"] as const).some((k) => hd[k]) && (
                        <div className="flex flex-wrap gap-1">
                          {(["hairLength","hairCondition","bleachHistory","grayHairPercentage","previousKeratin"] as const).map((k) =>
                            hd[k] ? (
                              <span key={k} className="text-[10px] bg-muted rounded-full px-2 py-0.5 border border-border/50">
                                <span className="text-muted-foreground">{HAIR_LABEL[k]}: </span>{hd[k]}
                              </span>
                            ) : null
                          )}
                        </div>
                      )}

                      {/* Colors */}
                      {(hd.currentHairColorCode || hd.desiredHairColorCode) && (
                        <div className="flex gap-2 flex-wrap">
                          {(["currentHairColorCode","desiredHairColorCode"] as const).map((key) => {
                            const color = getColorByCode(hd[key]);
                            if (!color) return null;
                            const lbl = key === "currentHairColorCode" ? "נוכחי" : "רצוי";
                            return (
                              <div key={key} className="flex items-center gap-1.5 bg-muted/50 rounded-lg px-2 py-1.5 border border-border/50">
                                <img src={color.imagePath} alt={color.name} className="w-8 h-8 rounded-md object-cover border border-border shrink-0" />
                                <div>
                                  <p className="text-[9px] text-muted-foreground leading-none">{lbl}</p>
                                  <p className="text-[11px] font-bold leading-tight">{color.nameHe}</p>
                                  <p className="text-[9px] text-muted-foreground">{color.code}</p>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Photos */}
                      {(hd.currentHairPhotoUrl || hd.desiredHairPhotoUrl) && (
                        <div className="flex gap-2">
                          {[{url: hd.currentHairPhotoUrl, label:"נוכחי"}, {url: hd.desiredHairPhotoUrl, label:"רצוי"}].map(({url, label}) =>
                            url ? (
                              <a key={label} href={url} target="_blank" rel="noopener noreferrer">
                                <img src={url} alt={label} className="w-14 h-14 rounded-xl object-cover border border-border hover:border-primary/60 transition-colors" />
                                <p className="text-[9px] text-muted-foreground text-center mt-0.5">{label}</p>
                              </a>
                            ) : null
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Notes */}
                  {appt.notes && (
                    <p className="text-xs text-muted-foreground italic border-t border-border/40 pt-2">
                      {appt.notes}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}

function MiniStat({ icon, value, label, color = "text-muted-foreground" }: {
  icon: React.ReactNode; value: number; label: string; color?: string;
}) {
  return (
    <div className="text-center space-y-0.5">
      <div className={`flex justify-center ${color}`}>{icon}</div>
      <p className={`text-base font-bold ${color}`}>{value}</p>
      <p className="text-[10px] text-muted-foreground">{label}</p>
    </div>
  );
}
