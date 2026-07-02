"use client";

import Link from "next/link";
import { ShieldAlert } from "lucide-react";

// The legacy single-tenant /admin dashboard used to edit `businesses[0]` — the
// oldest row, i.e. the template — which let salon owners accidentally edit the
// wrong business. Multi-tenant admin now lives at /salon/<slug>/admin, reached
// via each salon's personal link. This route is just a signpost.
export default function AdminPage() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-background px-4" dir="rtl">
      <div className="w-full max-w-sm bg-card rounded-2xl shadow-xl border p-8 text-center space-y-4">
        <div className="flex justify-center">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
            <ShieldAlert className="w-7 h-7 text-primary" />
          </div>
        </div>
        <h1 className="text-xl font-bold">ממשק הניהול עבר</h1>
        <p className="text-sm text-muted-foreground">
          ניהול הסלון זמין דרך הקישור האישי שלך:
          <br />
          <span className="font-mono text-foreground">/salon/&lt;הסלון-שלך&gt;/admin</span>
          <br />
          פתחי את דף הסלון שלך ולחצי על "ניהול".
        </p>
        <Link
          href="/"
          className="inline-block text-sm font-medium text-primary hover:underline"
        >
          ← חזרה לדף הבית
        </Link>
      </div>
    </div>
  );
}
