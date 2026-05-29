"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Doc, Id } from "@/convex/_generated/dataModel";
import { toDateStr } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2 } from "lucide-react";

const DAY_NAMES = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];

type FormState = {
  date: string;
  barberId: string; // "" = all
  isClosed: boolean;
  customStart: string;
  customEnd: string;
  note: string;
};

const todayStr = toDateStr(new Date());

const EMPTY: FormState = {
  date: todayStr,
  barberId: "",
  isClosed: true,
  customStart: "09:00",
  customEnd: "17:00",
  note: "",
};

export function SpecialSchedulesManager({
  businessId,
}: {
  businessId: Id<"businesses">;
}) {
  const schedules = useQuery(api.specialSchedules.getByBusiness, { businessId });
  const barbers = useQuery(api.barbers.getAllByBusiness, { businessId });
  const upsert = useMutation(api.specialSchedules.upsert);
  const remove = useMutation(api.specialSchedules.remove);

  const [form, setForm] = useState<FormState>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);

  function set<K extends keyof FormState>(k: K, v: FormState[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function handleAdd() {
    setSaving(true);
    try {
      await upsert({
        businessId,
        barberId: form.barberId ? (form.barberId as Id<"barbers">) : undefined,
        date: form.date,
        isClosed: form.isClosed,
        customStart: form.isClosed ? undefined : form.customStart,
        customEnd: form.isClosed ? undefined : form.customEnd,
        note: form.note || undefined,
      });
      setForm({ ...EMPTY, date: form.date });
      setShowForm(false);
    } finally {
      setSaving(false);
    }
  }

  if (!schedules || !barbers) {
    return <div className="text-muted-foreground text-sm">טוען...</div>;
  }

  const barberMap = Object.fromEntries(barbers.map((b) => [b._id, b.name.he]));

  // Sort by date ascending
  const sorted = [...schedules].sort((a, b) => a.date.localeCompare(b.date));

  // Group by date
  const byDate = sorted.reduce<Record<string, typeof sorted>>((acc, s) => {
    (acc[s.date] ??= []).push(s);
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="font-semibold">ימים מיוחדים</h2>
        <Button size="sm" onClick={() => setShowForm((v) => !v)}>
          <Plus className="h-4 w-4 ml-1" />
          הוסף
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardContent className="py-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">תאריך</Label>
                <Input
                  type="date"
                  value={form.date}
                  onChange={(e) => set("date", e.target.value)}
                  dir="ltr"
                  className="text-left"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">ספר (ריק = כולם)</Label>
                <select
                  value={form.barberId}
                  onChange={(e) => set("barberId", e.target.value)}
                  className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="">כל הספרים</option>
                  {barbers.map((b) => (
                    <option key={b._id} value={b._id}>
                      {b.name.he}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex gap-4 items-center">
              <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
                <input
                  type="radio"
                  checked={form.isClosed}
                  onChange={() => set("isClosed", true)}
                />
                יום סגור
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
                <input
                  type="radio"
                  checked={!form.isClosed}
                  onChange={() => set("isClosed", false)}
                />
                שעות מיוחדות
              </label>
            </div>

            {!form.isClosed && (
              <div className="flex items-center gap-2">
                <Input
                  type="time"
                  value={form.customStart}
                  onChange={(e) => set("customStart", e.target.value)}
                  dir="ltr"
                  className="h-8 w-28 text-left text-sm"
                />
                <span className="text-muted-foreground text-xs">—</span>
                <Input
                  type="time"
                  value={form.customEnd}
                  onChange={(e) => set("customEnd", e.target.value)}
                  dir="ltr"
                  className="h-8 w-28 text-left text-sm"
                />
              </div>
            )}

            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">הערה (אופציונלי)</Label>
              <Input
                value={form.note}
                onChange={(e) => set("note", e.target.value)}
                placeholder="חג, חופשה, אירוע..."
              />
            </div>

            <div className="flex gap-2">
              <Button onClick={handleAdd} disabled={saving} size="sm">
                {saving ? "שומר..." : "שמור"}
              </Button>
              <Button variant="outline" size="sm" onClick={() => setShowForm(false)}>
                ביטול
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {sorted.length === 0 && !showForm && (
        <p className="text-sm text-muted-foreground text-center py-8">
          אין ימים מיוחדים מוגדרים
        </p>
      )}

      {Object.entries(byDate).map(([date, entries]) => {
        const d = new Date(date + "T00:00:00Z");
        const dayName = DAY_NAMES[d.getUTCDay()];
        const displayDate = `${d.getUTCDate()}/${d.getUTCMonth() + 1}/${d.getUTCFullYear()}`;
        return (
          <div key={date}>
            <div className="text-xs font-semibold text-muted-foreground mb-1.5 px-1">
              {dayName} {displayDate}
            </div>
            {entries.map((entry) => (
              <Card key={entry._id} className="mb-2">
                <CardContent className="py-2.5 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={entry.isClosed ? "destructive" : "secondary"}
                        className="text-xs"
                      >
                        {entry.isClosed
                          ? "סגור"
                          : `${entry.customStart}–${entry.customEnd}`}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {entry.barberId ? barberMap[entry.barberId] : "כל הספרים"}
                      </span>
                      {entry.note && (
                        <span className="text-xs text-muted-foreground">· {entry.note}</span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => remove({ id: entry._id })}
                    className="text-muted-foreground hover:text-destructive transition-colors shrink-0"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </CardContent>
              </Card>
            ))}
          </div>
        );
      })}
    </div>
  );
}
