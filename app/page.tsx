"use client";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useLang } from "@/contexts/LanguageContext";
import BookingWizard from "@/components/booking/BookingWizard";
import AuthWidget from "@/components/AuthWidget";
import { Sparkles, MapPin, Phone } from "lucide-react";
import Image from "next/image";

function LanguageToggle() {
  const { lang, setLang } = useLang();
  return (
    <button
      onClick={() => setLang(lang === "he" ? "ar" : "he")}
      className="flex items-center gap-1.5 rounded-full border border-border/60 px-3 py-1.5 text-xs font-semibold hover:bg-accent transition-colors"
      aria-label="Toggle language"
    >
      {lang === "he" ? "العربية" : "עברית"}
    </button>
  );
}

export default function Home() {
  const { t } = useLang();
  const businesses = useQuery(api.businesses.getAll);
  const business = businesses?.[0];

  return (
    <main className="min-h-screen bg-background">
      {/* Sticky header */}
      <header className="sticky top-0 z-20 border-b bg-card/90 backdrop-blur-sm">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            {business?.logoUrl ? (
              <Image
                src={business.logoUrl}
                alt="לוגו"
                width={28}
                height={28}
                className="rounded-md object-cover shrink-0"
              />
            ) : (
              <Sparkles className="w-4 h-4 text-primary shrink-0" />
            )}
            <span className="font-bold text-base truncate">
              {business ? t(business.name) : "NextInLine"}
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <AuthWidget />
            <LanguageToggle />
            <a
              href="/admin"
              className="text-xs text-muted-foreground hover:text-foreground transition-colors border border-border/60 rounded-full px-3 py-1.5 font-medium"
            >
              ניהול
            </a>
          </div>
        </div>
      </header>

      {/* Hero banner */}
      {business && (
        <div className="pb-6 text-center">
          {/* Header image */}
          {business.imageUrl && (
            <div className="relative w-full aspect-[3/1] overflow-hidden">
              <Image
                src={business.imageUrl}
                alt={t(business.name)}
                fill
                className="object-cover"
                sizes="100vw"
                priority
              />
              <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-background/80" />
            </div>
          )}

          {/* Identity row */}
          <div className={business.imageUrl ? "-mt-10 relative z-10 px-4" : "bg-gradient-to-b from-primary/8 via-primary/4 to-transparent pt-10 px-4"}>
            {business.logoUrl && (
              <Image
                src={business.logoUrl}
                alt="לוגו"
                width={72}
                height={72}
                className="rounded-2xl object-cover mx-auto mb-3 shadow-md border-2 border-card"
              />
            )}
            <h1 className="text-3xl font-bold mb-1">{t(business.name)}</h1>
            <p className="text-muted-foreground text-sm mb-3 max-w-sm mx-auto">{t(business.description)}</p>
            <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground flex-wrap">
              {business.address && (
                <span className="flex items-center gap-1">
                  <MapPin className="w-3 h-3" />
                  {business.address}
                </span>
              )}
              {business.phone && (
                <span className="flex items-center gap-1">
                  <Phone className="w-3 h-3" />
                  <a href={`tel:${business.phone}`} className="hover:text-foreground transition-colors">
                    {business.phone}
                  </a>
                </span>
              )}
            </div>
            <a
              href="/admin"
              className="mt-4 inline-block text-xs text-muted-foreground/60 hover:text-muted-foreground transition-colors"
            >
              ניהול העסק
            </a>
          </div>
        </div>
      )}

      {/* Loading spinner */}
      {businesses === undefined && (
        <div className="flex justify-center items-center py-24">
          <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        </div>
      )}

      {/* No business seeded yet */}
      {businesses?.length === 0 && (
        <div className="text-center py-24 px-4 text-muted-foreground">
          <Sparkles className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">אין עסק רשום במערכת | لا يوجد عمل مسجل في النظام</p>
        </div>
      )}

      {/* Booking wizard */}
      {business && <BookingWizard businessId={business._id} />}
    </main>
  );
}
