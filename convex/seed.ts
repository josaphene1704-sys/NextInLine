import { internalMutation, MutationCtx } from "./_generated/server";

async function seedData(ctx: MutationCtx) {
  const businessId = await ctx.db.insert("businesses", {
    name: { he: "סטודיו לוקס", ar: "لوكس ستوديو" },
    description: {
      he: "סלון שיער יוקרתי לנשים – תספורות, צביעה, בלייאז' וטיפולים מתקדמים",
      ar: "صالون شعر فاخر للسيدات – قص، صباغة، بلايج وعلاجات متقدمة",
    },
    address: "רחוב דיזנגוף 45, תל אביב | شارع ديزنغوف 45، تل أبيب",
    phone: "03-555-0199",
    imageUrl: "https://images.unsplash.com/photo-1560066984-138dadb4c035?w=1200&q=80",
    timezone: "Asia/Jerusalem",
    workingHours: {
      days: [0, 1, 2, 3, 4], // Sun–Thu
      start: "09:00",
      end: "20:00",
      slotIntervalMinutes: 30,
    },
  });

  // ── Services ────────────────────────────────────────────────────────────────
  const haircutStyling = await ctx.db.insert("services", {
    businessId,
    name: { he: "תספורת ועיצוב", ar: "قصة شعر وتصفيف" },
    description: {
      he: "תספורת מקצועית לנשים בשילוב עיצוב ופן מושלם",
      ar: "قصة شعر احترافية للسيدات مع تصفيف وسشوار متقن",
    },
    duration: 60,
    price: 25000, // 250 ₪
    isActive: true,
  });

  const colorHighlights = await ctx.db.insert("services", {
    businessId,
    name: { he: "צבע והיילייטס", ar: "صباغة وهايلايت" },
    description: {
      he: "צביעת שיער מלאה או היילייטס מקצועיים עם מוצרים איכותיים",
      ar: "صباغة شاملة أو هايلايت احترافي بمواد عالية الجودة",
    },
    duration: 120,
    price: 45000, // 450 ₪
    isActive: true,
  });

  const balayage = await ctx.db.insert("services", {
    businessId,
    name: { he: "בלייאז'", ar: "بلايج" },
    description: {
      he: "טכניקת בלייאז' מתקדמת לצבע טבעי ומדורג עם מראה אורבני",
      ar: "تقنية البلايج المتقدمة للحصول على لون طبيعي ومتدرج بمظهر عصري",
    },
    duration: 150,
    price: 60000, // 600 ₪
    isActive: true,
  });

  const keratin = await ctx.db.insert("services", {
    businessId,
    name: { he: "טיפול קרטין", ar: "علاج الكيراتين" },
    description: {
      he: "טיפול קרטין מקצועי לשיער חלק, מבריק ובריא לאורך זמן",
      ar: "علاج كيراتين احترافي لشعر ناعم ولامع وصحي لفترة طويلة",
    },
    duration: 180,
    price: 70000, // 700 ₪
    isActive: true,
  });

  const bridalStyling = await ctx.db.insert("services", {
    businessId,
    name: { he: "עיצוב לאירועים", ar: "تسريحة للمناسبات" },
    description: {
      he: "עיצוב שיער מיוחד לכלות, ערבים ואירועים – תסרוקות רומנטיות ומרהיבות",
      ar: "تسريحات خاصة للعرائس والسهرات والمناسبات – أعمال رومانسية ومذهلة",
    },
    duration: 90,
    price: 80000, // 800 ₪
    isActive: true,
  });

  // ── Stylists ─────────────────────────────────────────────────────────────────
  await ctx.db.insert("barbers", {
    businessId,
    name: { he: "נועה כהן", ar: "نوا كوهين" },
    role: { he: "מעצבת שיער בכירה", ar: "مصففة شعر أولى" },
    specializedServices: [haircutStyling, colorHighlights, balayage, keratin, bridalStyling],
    isActive: true,
  });

  await ctx.db.insert("barbers", {
    businessId,
    name: { he: "יסמין לוי", ar: "ياسمين ليفي" },
    role: { he: "מומחית צבע ובלייאז'", ar: "خبيرة صباغة وبلايج" },
    specializedServices: [haircutStyling, colorHighlights, balayage],
    workingHours: {
      days: [0, 1, 2, 4], // Sun, Mon, Tue, Thu
      start: "10:00",
      end: "19:00",
      slotIntervalMinutes: 30,
    },
    isActive: true,
  });

  return { businessId, seeded: true };
}

export const run = internalMutation({
  args: {},
  handler: async (ctx) => {
    const existing = await ctx.db.query("businesses").first();
    if (existing) return { skipped: true };
    return await seedData(ctx);
  },
});

export const forceRun = internalMutation({
  args: {},
  handler: async (ctx) => {
    const businesses = await ctx.db.query("businesses").take(100);
    for (const b of businesses) {
      const appointments = await ctx.db
        .query("appointments")
        .withIndex("by_business", (q) => q.eq("businessId", b._id))
        .take(1000);
      for (const a of appointments) await ctx.db.delete(a._id);

      const schedules = await ctx.db
        .query("specialSchedules")
        .withIndex("by_business_date", (q) => q.eq("businessId", b._id))
        .take(1000);
      for (const s of schedules) await ctx.db.delete(s._id);

      const barbers = await ctx.db
        .query("barbers")
        .withIndex("by_business", (q) => q.eq("businessId", b._id))
        .take(100);
      for (const ba of barbers) await ctx.db.delete(ba._id);

      const services = await ctx.db
        .query("services")
        .withIndex("by_business", (q) => q.eq("businessId", b._id))
        .take(100);
      for (const sv of services) await ctx.db.delete(sv._id);

      await ctx.db.delete(b._id);
    }
    return await seedData(ctx);
  },
});
