"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Doc, Id } from "@/convex/_generated/dataModel";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, X } from "lucide-react";
import { ImageUpload } from "@/components/admin/ImageUpload";
import {
  WorkingHoursEditor,
  DayScheduleItem,
  legacyToSchedules,
} from "@/components/admin/WorkingHoursEditor";

type BarberForm = {
  nameHe: string;
  nameAr: string;
  roleHe: string;
  roleAr: string;
  avatarUrl: string;
  specializedServices: string[];
  hasCustomHours: boolean;
  schedules: DayScheduleItem[];
  interval: number;
};

const EMPTY_FORM: BarberForm = {
  nameHe: "",
  nameAr: "",
  roleHe: "",
  roleAr: "",
  avatarUrl: "",
  specializedServices: [],
  hasCustomHours: false,
  schedules: [0, 1, 2, 3, 4].map((day) => ({ day, start: "09:00", end: "17:00" })),
  interval: 30,
};

function docToForm(b: Doc<"barbers">): BarberForm {
  return {
    nameHe: b.name.he,
    nameAr: b.name.ar,
    roleHe: b.role.he,
    roleAr: b.role.ar,
    avatarUrl: b.avatarUrl ?? "",
    specializedServices: b.specializedServices,
    hasCustomHours: !!b.workingHours,
    schedules: b.workingHours
      ? legacyToSchedules(b.workingHours)
      : EMPTY_FORM.schedules,
    interval: b.workingHours?.slotIntervalMinutes ?? 30,
  };
}

export function BarbersManager({ businessId }: { businessId: Id<"businesses"> }) {
  const barbers = useQuery(api.barbers.getAllByBusiness, { businessId });
  const services = useQuery(api.services.getAllByBusiness, { businessId });
  const create = useMutation(api.barbers.create);
  const update = useMutation(api.barbers.update);

  const [editing, setEditing] = useState<Id<"barbers"> | "new" | null>(null);
  const [form, setForm] = useState<BarberForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  function set<K extends keyof BarberForm>(k: K, v: BarberForm[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  function openNew() { setForm(EMPTY_FORM); setEditing("new"); }
  function openEdit(b: Doc<"barbers">) { setForm(docToForm(b)); setEditing(b._id); }

  async function handleSubmit() {
    setSaving(true);
    try {
      const base = {
        name: { he: form.nameHe, ar: form.nameAr },
        role: { he: form.roleHe, ar: form.roleAr },
        specializedServices: form.specializedServices,
        ...(form.avatarUrl ? { avatarUrl: form.avatarUrl } : {}),
        ...(form.hasCustomHours
          ? {
              workingHours: {
                daySchedules: form.schedules,
                slotIntervalMinutes: form.interval,
              },
            }
          : {}),
      };
      if (editing === "new") {
        await create({ businessId, ...base });
      } else if (editing) {
        await update({ barberId: editing, ...base });
      }
      setEditing(null);
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(b: Doc<"barbers">) {
    await update({ barberId: b._id, isActive: !b.isActive });
  }

  if (!barbers || !services) {
    return <div className="text-muted-foreground text-sm">טוען ספרים...</div>;
  }

  const serviceMap = Object.fromEntries(services.map((s) => [s._id, s.name.he]));

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="font-semibold">{barbers.length} ספרים</h2>
        <Button size="sm" onClick={openNew}>
          <Plus className="h-4 w-4 ml-1" />
          ספר חדש
        </Button>
      </div>

      {barbers.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-8">אין ספרים עדיין</p>
      )}

      {barbers.map((b) => {
        const daySchedules = b.workingHours
          ? legacyToSchedules(b.workingHours)
          : null;
        return (
          <Card key={b._id} className={cn(!b.isActive && "opacity-50")}>
            <CardContent className="py-3 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm">{b.name.he}</div>
                <div className="text-xs text-muted-foreground">{b.role.he}</div>
                {b.specializedServices.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {b.specializedServices.map((id) => (
                      <Badge key={id} variant="outline" className="text-xs py-0">
                        {serviceMap[id] ?? id}
                      </Badge>
                    ))}
                  </div>
                )}
                {daySchedules && (
                  <div className="text-xs text-muted-foreground mt-1">
                    שעות אישיות:{" "}
                    {daySchedules.map((s) => `${["א","ב","ג","ד","ה","ו","ש"][s.day]} ${s.start}–${s.end}`).join(" · ")}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Badge
                  variant={b.isActive ? "default" : "secondary"}
                  className="cursor-pointer select-none text-xs"
                  onClick={() => toggleActive(b)}
                >
                  {b.isActive ? "פעיל" : "מושבת"}
                </Badge>
                <Button variant="ghost" size="sm" onClick={() => openEdit(b)}>
                  <Pencil className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })}

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div
            className="bg-card rounded-xl shadow-2xl w-full max-w-md p-6 space-y-4 max-h-[90vh] overflow-y-auto"
            dir="rtl"
          >
            <div className="flex justify-between items-center">
              <h3 className="font-semibold text-base">
                {editing === "new" ? "ספר חדש" : "עריכת ספר"}
              </h3>
              <button
                onClick={() => setEditing(null)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <Field label="שם — עברית">
                  <Input value={form.nameHe} onChange={(e) => set("nameHe", e.target.value)} />
                </Field>
                <Field label="اسم — عربي">
                  <Input value={form.nameAr} onChange={(e) => set("nameAr", e.target.value)} dir="rtl" />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="תפקיד — עברית">
                  <Input value={form.roleHe} onChange={(e) => set("roleHe", e.target.value)} />
                </Field>
                <Field label="دور — عربي">
                  <Input value={form.roleAr} onChange={(e) => set("roleAr", e.target.value)} dir="rtl" />
                </Field>
              </div>

              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">תמונת פרופיל</Label>
                <ImageUpload
                  value={form.avatarUrl}
                  onChange={(url) => set("avatarUrl", url)}
                  shape="circle"
                />
              </div>

              <div>
                <Label className="text-xs text-muted-foreground mb-2 block">שירותים מתמחים</Label>
                <div className="flex flex-wrap gap-2">
                  {services.map((s) => {
                    const active = form.specializedServices.includes(s._id);
                    return (
                      <button
                        key={s._id}
                        type="button"
                        onClick={() => {
                          const cur = form.specializedServices;
                          set(
                            "specializedServices",
                            active ? cur.filter((x) => x !== s._id) : [...cur, s._id]
                          );
                        }}
                        className={cn(
                          "px-3 h-8 rounded-full border text-xs font-medium transition-colors",
                          active
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-background border-border text-muted-foreground hover:border-primary"
                        )}
                      >
                        {s.name.he}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="border rounded-md p-3 space-y-3">
                <label className="flex items-center gap-2 cursor-pointer text-sm select-none">
                  <input
                    type="checkbox"
                    checked={form.hasCustomHours}
                    onChange={(e) => set("hasCustomHours", e.target.checked)}
                    className="rounded"
                  />
                  שעות עבודה שונות מהעסק
                </label>

                {form.hasCustomHours && (
                  <WorkingHoursEditor
                    schedules={form.schedules}
                    interval={form.interval}
                    onChange={(s, iv) => {
                      set("schedules", s);
                      set("interval", iv);
                    }}
                  />
                )}
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <Button onClick={handleSubmit} disabled={saving} className="flex-1">
                {saving ? "שומר..." : "שמור"}
              </Button>
              <Button variant="outline" onClick={() => setEditing(null)}>
                ביטול
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
