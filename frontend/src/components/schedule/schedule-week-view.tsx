"use client";

import { ScheduleDay } from "@/lib/api";
import { argbToHex, toDateInput } from "@/lib/format";

type ScheduleWeekViewProps = {
  week: ScheduleDay[];
  onOpenDay: (date: string) => void;
  onSelectAppointment: (aptNum: number) => void;
};

export function ScheduleWeekView({
  week,
  onOpenDay,
  onSelectAppointment,
}: ScheduleWeekViewProps) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-7">
      {week.map((wd) => {
        const wdDate = String(wd.date);
        const isToday = wdDate === toDateInput(new Date());
        const appointments = [...wd.appointments].sort(
          (a, b) => new Date(a.aptDateTime).getTime() - new Date(b.aptDateTime).getTime()
        );

        return (
          <div
            key={wdDate}
            className={`flex min-h-[200px] flex-col rounded-lg border bg-card ${isToday ? "border-primary" : ""}`}
          >
            <button
              type="button"
              className="border-b px-2 py-1.5 text-left hover:bg-muted/40"
              onClick={() => onOpenDay(wdDate)}
              title="Open day view"
            >
              <span className="text-xs font-medium">
                {new Date(`${wdDate}T00:00`).toLocaleDateString("en-CA", {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                })}
              </span>
              <span className="ml-1.5 text-[10px] text-muted-foreground">
                {appointments.length > 0 ? `${appointments.length} appt${appointments.length === 1 ? "" : "s"}` : ""}
              </span>
            </button>
            <div className="flex-1 space-y-1 p-1.5">
              {appointments.length === 0 && (
                <p className="px-1 py-2 text-[11px] text-muted-foreground">No appointments</p>
              )}
              {appointments.map((a) => (
                <button
                  key={a.aptNum}
                  type="button"
                  className="block w-full overflow-hidden rounded border bg-card px-1.5 py-1 text-left text-[11px] shadow-sm hover:shadow"
                  style={{ borderLeft: `3px solid ${argbToHex(a.providerColor, "#2f6b4f")}` }}
                  onClick={() => onSelectAppointment(a.aptNum)}
                >
                  <span className="font-medium">
                    {new Date(a.aptDateTime).toLocaleTimeString("en-CA", {
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </span>
                  <span className="ml-1 truncate">{a.patientName}</span>
                  {a.providerAbbr && (
                    <span className="ml-1 text-muted-foreground">- {a.providerAbbr}</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
