"use client";

import { useRouter } from "next/navigation";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import { Paper } from "@mui/material";

export type CalendarWidgetEvent = {
  id: string; title: string; start: string; end?: string; allDay: boolean; url: string;
  backgroundColor: string; borderColor: string;
  extendedProps: { subtitle?: unknown; propertyName?: unknown; module?: unknown };
};

export default function CalendarWidget({ events, loading, onRangeChange }: {
  events: CalendarWidgetEvent[]; loading: boolean;
  onRangeChange: (range: { start: string; end: string }) => void;
}) {
  const router = useRouter();
  return <Paper variant="outlined" sx={{ p: { xs: 1, md: 2 }, borderRadius: 3, opacity: loading ? .65 : 1, overflow: "hidden", "& .fc": { color: "text.primary", "--fc-border-color": "var(--border)", "--fc-page-bg-color": "var(--surface)", "--fc-neutral-bg-color": "var(--surface-2)", "--fc-today-bg-color": "rgba(220,38,38,.08)" }, "& .fc .fc-button-primary": { bgcolor: "primary.main", borderColor: "primary.main", textTransform: "capitalize" }, "& .fc .fc-toolbar": { flexWrap: "wrap", gap: 1 }, "& .fc .fc-toolbar-title": { fontSize: { xs: "1rem", md: "1.25rem" }, fontWeight: 800 }, "& .fc-event": { cursor: "pointer", borderRadius: 1, px: .25 } }}>
    <FullCalendar
      plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
      initialView="dayGridMonth"
      headerToolbar={{ left: "prev,next today", center: "title", right: "dayGridMonth,timeGridWeek,timeGridDay" }}
      buttonText={{ today: "Today", month: "Month", week: "Week", day: "Day" }}
      events={events}
      height="auto"
      dayMaxEvents={3}
      nowIndicator
      eventTimeFormat={{ hour: "2-digit", minute: "2-digit", hour12: true }}
      datesSet={(info) => {
        const end = new Date(info.end); end.setDate(end.getDate() - 1);
        onRangeChange({ start: info.start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) });
      }}
      eventClick={(info) => { info.jsEvent.preventDefault(); if (info.event.url) router.push(info.event.url); }}
      eventDidMount={(info) => { info.el.title = [info.event.title, String(info.event.extendedProps.subtitle ?? ""), String(info.event.extendedProps.propertyName ?? "")].filter(Boolean).join(" · "); }}
    />
  </Paper>;
}
