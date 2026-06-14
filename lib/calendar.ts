function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function toICSDateTime(ms: number): string {
  const d = new Date(ms);
  return (
    d.getUTCFullYear() +
    pad(d.getUTCMonth() + 1) +
    pad(d.getUTCDate()) +
    "T" +
    pad(d.getUTCHours()) +
    pad(d.getUTCMinutes()) +
    "00Z"
  );
}

interface ICSOptions {
  uid: string;
  startTime: number;
  endTime: number;
  summary: string;
  description?: string;
  cancelled?: boolean;
  sequence?: number;
}

export function downloadICS(opts: ICSOptions, filename = "appointment.ics"): void {
  const {
    uid, startTime, endTime, summary,
    description = "", cancelled = false, sequence = 0,
  } = opts;

  const stamp = toICSDateTime(Date.now());
  const method = cancelled ? "CANCEL" : "REQUEST";

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//NextInLine//Appointments//HE",
    `METHOD:${method}`,
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${stamp}`,
    `DTSTART:${toICSDateTime(startTime)}`,
    `DTEND:${toICSDateTime(endTime)}`,
    `SUMMARY:${summary}`,
    ...(description ? [`DESCRIPTION:${description}`] : []),
    ...(cancelled ? ["STATUS:CANCELLED"] : ["STATUS:CONFIRMED"]),
    `SEQUENCE:${sequence}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ];

  const ics = lines.join("\r\n");
  const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
