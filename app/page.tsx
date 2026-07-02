"use client";
import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useLang } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import BookingWizard from "@/components/booking/BookingWizard";
import AuthWidget from "@/components/AuthWidget";
import { AdminPasswordModal } from "@/components/AdminPasswordModal";
import { UpcomingAppointmentsBanner } from "@/components/booking/UpcomingAppointmentsBanner";
import { Sparkles, MapPin, Phone, AlertCircle } from "lucide-react";
import { GallerySection } from "@/components/GallerySection";
import { GalleryPreviewButton } from "@/components/GalleryPreviewButton";
import Image from "next/image";

function LanguageToggle() {
  const { lang, setLang } = useLang();
  return (
    <button
      onClick={() => setLang(lang === "he" ? "ar" : "he")}
      className="glass-badge flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold"
      aria-label="Toggle language"
    >
      {lang === "he" ? "العربية" : "עברית"}
    </button>
  );
}

export default function Home() {
  const { t } = useLang();
  const { user } = useAuth();
  const businesses = useQuery(api.businesses.getAll);
  const business = businesses?.[0];
  const [adminModalOpen, setAdminModalOpen] = useState(false);
  const [showGallery, setShowGallery] = useState(false);

  return (
    <main className="min-h-screen">
      {/* Sticky header */}
      <header className="sticky top-0 z-20 glass-header">
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
            <button
              onClick={() => setAdminModalOpen(true)}
              className="glass-badge text-xs text-muted-foreground hover:text-foreground rounded-full px-3 py-1.5 font-medium"
            >
              ניהול
            </button>
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
            {/* Gallery preview button */}
            <GalleryPreviewButton
              businessId={business._id}
              onClick={() => setShowGallery(true)}
            />
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

      {/* Gallery — shown only when user clicks the preview button */}
      {business && showGallery && (
        <GallerySection
          businessId={business._id}
          onClose={() => setShowGallery(false)}
        />
      )}

      {/* Upcoming appointments & waiting list — shown to logged-in users */}
      {business && user && (
        <div className="w-full max-w-2xl mx-auto px-4 pb-4">
          <UpcomingAppointmentsBanner customerPhone={user.phone} businessId={business._id} />
        </div>
      )}

      {/* Booking wizard — only when shop is active */}
      {business && business.isActive !== false && (
        <BookingWizard businessId={business._id} />
      )}

      {/* Suspended shop message */}
      {business && business.isActive === false && (
        <div className="flex flex-col items-center justify-center py-24 px-4 text-center">
          <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
            <AlertCircle className="w-8 h-8 text-muted-foreground" />
          </div>
          <h2 className="text-lg font-semibold mb-2">העמוד אינו זמין כרגע</h2>
          <p className="text-sm text-muted-foreground max-w-xs">
            דף ההזמנות אינו זמין כרגע. אנא נסי שנית מאוחר יותר.
          </p>
        </div>
      )}

      <AdminPasswordModal
        open={adminModalOpen}
        onOpenChange={setAdminModalOpen}
        businessId={business?._id}
        onAuthenticated={(token) => {
          if (!business) return;
          localStorage.setItem(
            `adminSession_${business._id}`,
            JSON.stringify({ businessId: business._id, token })
          );
        }}
      />
    </main>
  );
}
