

"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Doc } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ImageUpload } from "@/components/admin/ImageUpload";
import { WorkingHoursEditor, DayScheduleItem, legacyToSchedules } from "@/components/admin/WorkingHoursEditor";
import { useAdminSession } from "@/contexts/AdminSessionContext";

export function BusinessSettings({ business }: { business: Doc<"businesses"> }) {
  const updateBusiness = useMutation(api.businesses.update);
  const { session, revalidate } = useAdminSession();

  const [nameHe, setNameHe] = useState(business.name.he);
  const [nameAr, setNameAr] = useState(business.name.ar);
  const [descHe, setDescHe] = useState(business.description.he);
  const [descAr, setDescAr] = useState(business.description.ar);
  const [address, setAddress] = useState(business.address);
  const [phone, setPhone] = useState(business.phone);
  const [logoUrl, setLogoUrl] = useState(business.logoUrl ?? "");
  const [imageUrl, setImageUrl] = useState(business.imageUrl ?? "");
  const [schedules, setSchedules] = useState<DayScheduleItem[]>(
    legacyToSchedules(business.workingHours)
  );
  const [interval, setInterval] = useState(business.workingHours.slotIntervalMinutes ?? 30);
  const [announcement, setAnnouncement] = useState(business.announcement ?? "");

  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [announceStatus, setAnnounceStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  async function handleSave() {
    setStatus("saving");
    try {
      await updateBusiness({
        businessId: business._id,
        token: session?.token ?? "",
        name: { he: nameHe, ar: nameAr },
        description: { he: descHe, ar: descAr },
        address,
        phone,
        workingHours: { daySchedules: schedules, slotIntervalMinutes: interval },
        // Always send image fields — an empty string means "remove image" and
        // the server treats it as an explicit unset.
        logoUrl,
        imageUrl,
        // Include the announcement so the primary "save changes" button also
        // persists it — otherwise it only saves via its own dedicated button,
        // which is easy to miss.
        announcement,
      });
      setStatus("saved");
      setTimeout(() => setStatus("idle"), 2500);
    } catch {
      // A failure is most often an expired/rotated session. Re-check it: if it's
      // invalid, revalidate() clears it and the admin page redirects to login.
      // Otherwise it's a transient error — surface it instead of swallowing.
      const stillValid = await revalidate();
      if (stillValid) setStatus("error");
    }
  }

  async function handleSaveAnnouncement() {
    setAnnounceStatus("saving");
    try {
      // Empty string is sent intentionally — the server unsets the field, which
      // hides the notice on the customer page.
      await updateBusiness({
        businessId: business._id,
        token: session?.token ?? "",
        announcement,
      });
      setAnnounceStatus("saved");
      setTimeout(() => setAnnounceStatus("idle"), 2500);
    } catch {
      const stillValid = await revalidate();
      if (stillValid) setAnnounceStatus("error");
    }
  }

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">פרטי העסק</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Field label="שם — עברית">
              <Input value={nameHe} onChange={(e) => setNameHe(e.target.value)} />
            </Field>
            <Field label="اسم — عربي">
              <Input value={nameAr} onChange={(e) => setNameAr(e.target.value)} dir="rtl" />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="תיאור — עברית">
              <Input value={descHe} onChange={(e) => setDescHe(e.target.value)} />
            </Field>
            <Field label="وصف — عربي">
              <Input value={descAr} onChange={(e) => setDescAr(e.target.value)} dir="rtl" />
            </Field>
          </div>
          <Field label="כתובת">
            <Input value={address} onChange={(e) => setAddress(e.target.value)} />
          </Field>
          <Field label="טלפון">
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} dir="ltr" className="text-left" />
          </Field>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">לוגו העסק</Label>
            <ImageUpload value={logoUrl} onChange={setLogoUrl} shape="square" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">תמונת כותרת</Label>
            <ImageUpload value={imageUrl} onChange={setImageUrl} shape="banner" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">הודעה ללקוחות</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Field label="הודעה שתוצג בראש דף הלקוחות (למשל: נא להגיע בזמן)">
            <Input
              value={announcement}
              onChange={(e) => setAnnouncement(e.target.value)}
              placeholder="נא להגיע בזמן"
              maxLength={280}
            />
          </Field>
          <div className="flex items-center gap-3">
            <Button size="sm" onClick={handleSaveAnnouncement} disabled={announceStatus === "saving"}>
              {announceStatus === "saving" ? "שומר..." : "שמור הודעה"}
            </Button>
            {announceStatus === "saved" && (
              <span className="text-sm text-green-600 font-medium">נשמר בהצלחה ✓</span>
            )}
            {announceStatus === "error" && (
              <span className="text-sm text-destructive font-medium">השמירה נכשלה. נסי שוב.</span>
            )}
            {announcement && (
              <button
                type="button"
                onClick={() => { setAnnouncement(""); }}
                className="text-xs text-muted-foreground underline hover:text-foreground"
              >
                נקה
              </button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            כדי להסיר את ההודעה, נקי את השדה ושמרי.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">שעות עבודה</CardTitle>
        </CardHeader>
        <CardContent>
          <WorkingHoursEditor
            schedules={schedules}
            interval={interval}
            onChange={(s, iv) => { setSchedules(s); setInterval(iv); }}
          />
        </CardContent>
      </Card>

      <div className="flex items-center gap-3">
        <Button onClick={handleSave} disabled={status === "saving"}>
          {status === "saving" ? "שומר..." : "שמור שינויים"}
        </Button>
        {status === "saved" && (
          <span className="text-sm text-green-600 font-medium">נשמר בהצלחה ✓</span>
        )}
        {status === "error" && (
          <span className="text-sm text-destructive font-medium">
            השמירה נכשלה. בדקי את החיבור לאינטרנט ונסי שוב.
          </span>
        )}
      </div>
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
