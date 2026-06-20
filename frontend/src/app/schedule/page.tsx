"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AppointmentType,
  Definition,
  Operatory,
  Provider,
  ScheduleDay,
  referenceApi,
  scheduleApi,
} from "@/lib/api";
import {
  addDays,
  argbToHex,
  minutesSinceMidnight,
  timeSpanToMinutes,
  toDateInput,
} from "@/lib/format";
import { NewAppointmentDialog } from "@/components/schedule/new-appointment-dialog";
import { AppointmentSheet } from "@/components/schedule/appointment-sheet";

const DAY_START = 7 * 60; // 7:00
const DAY_END = 19 * 60; // 19:00
const PX_PER_MIN = 2; // 1 hour = 120px

export default function SchedulePage() {
  const [date, setDate] = useState(() => toDateInput(new Date()));
  const [view, setView] = useState<"day" | "week">("day");
  const [day, setDay] = useState<ScheduleDay | null>(null);
  const [week, setWeek] = useState<ScheduleDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [operatories, setOperatories] = useState<Operatory[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [apptTypes, setApptTypes] = useState<AppointmentType[]>([]);
  const [confirmStatuses, setConfirmStatuses] = useState<Definition[]>([]);

  const [bookOpen, setBookOpen] = useState(false);
  const [bookDefaults, setBookDefaults] = useState<{ dateTime?: string; opNum?: number }>({});
  const [selectedApt, setSelectedApt] = useState<number | null>(null);

  const loadDay = useCallback(() => {
    setLoading(true);
    if (view === "day") {
      scheduleApi
        .getDay(date)
        .then(setDay)
        .catch(() => setDay(null))
        .finally(() => setLoading(false));
    } else {
      // Monday-start week containing the selected date.
      const d = new Date(`${date}T00:00`);
      const dow = (d.getDay() + 6) % 7; // 0 = Monday
      const monday = addDays(d, -dow);
      const from = toDateInput(monday);
      const to = toDateInput(addDays(monday, 6));
      scheduleApi
        .getRange(from, to)
        .then((days) => {
          setWeek(days);
          if (days.length > 0) setDay(days[0]); // keep operatories fresh
        })
        .catch(() => setWeek([]))
        .finally(() => setLoading(false));
    }
  }, [date, view]);

  useEffect(loadDay, [loadDay]);

  useEffect(() => {
    Promise.all([
      referenceApi.getProviders(),
      referenceApi.getAppointmentTypes(),
      referenceApi.getConfirmationStatuses(),
    ]).then(([p, t, c]) => {
      setProviders(p);
      setApptTypes(t);
      setConfirmStatuses(c);
    });
  }, []);

  useEffect(() => {
    if (day) setOperatories(day.operatories);
  }, [day]);

  const hours = useMemo(() => {
    const list: number[] = [];
    for (let m = DAY_START; m < DAY_END; m += 60) list.push(m);
    return list;
  }, []);

  const openBooking = (opNum?: number, minute?: number) => {
    let dateTime: string | undefined;
    if (minute != null) {
      const h = `${Math.floor(minute / 60)}`.padStart(2, "0");
      const m = `${minute % 60}`.padStart(2, "0");
      dateTime = `${date}T${h}:${m}`;
    }
    setBookDefaults({ dateTime, opNum });
    setBookOpen(true);
  };

  const gridHeight = (DAY_END - DAY_START) * PX_PER_MIN;

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Schedule</h1>
          <p className="text-sm text-muted-foreground">
            {new Date(`${date}T00:00`).toLocaleDateString("en-CA", {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-md border">
            <Button
              variant={view === "day" ? "secondary" : "ghost"}
              size="sm"
              className="rounded-r-none"
              onClick={() => setView("day")}
            >
              Day
            </Button>
            <Button
              variant={view === "week" ? "secondary" : "ghost"}
              size="sm"
              className="rounded-l-none"
              onClick={() => setView("week")}
            >
              Week
            </Button>
          </div>
          <Button variant="outline" size="icon" onClick={() => setDate(toDateInput(addDays(new Date(`${date}T00:00`), view === "week" ? -7 : -1)))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Input
            type="date"
            value={date}
            onChange={(e) => e.target.value && setDate(e.target.value)}
            className="w-40"
          />
          <Button variant="outline" size="icon" onClick={() => setDate(toDateInput(addDays(new Date(`${date}T00:00`), view === "week" ? 7 : 1)))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="outline" onClick={() => setDate(toDateInput(new Date()))}>
            Today
          </Button>
          <Button onClick={() => openBooking()}>
            <Plus className="h-4 w-4" />
            <span className="ml-1.5">New Appointment</span>
          </Button>
        </div>
      </div>

      {loading && <p className="py-16 text-center text-muted-foreground">Loading schedule...</p>}

      {!loading && view === "day" && day && day.operatories.length === 0 && (
        <p className="py-16 text-center text-muted-foreground">No operatories configured.</p>
      )}

      {!loading && view === "day" && day && day.operatories.length > 0 && (
        <div className="overflow-x-auto rounded-lg border bg-card">
          <div className="flex" style={{ minWidth: day.operatories.length * 180 + 56 }}>
            {/* Time column */}
            <div className="sticky left-0 z-20 w-14 shrink-0 border-r bg-card">
              <div className="h-10 border-b" />
              <div className="relative" style={{ height: gridHeight }}>
                {hours.map((m) => (
                  <div
                    key={m}
                    className="absolute w-full pr-1.5 text-right text-[11px] text-muted-foreground"
                    style={{ top: (m - DAY_START) * PX_PER_MIN - 7 }}
                  >
                    {Math.floor(m / 60) % 12 === 0 ? 12 : Math.floor(m / 60) % 12}
                    {Math.floor(m / 60) < 12 ? "a" : "p"}
                  </div>
                ))}
              </div>
            </div>

            {/* Operatory columns */}
            {day.operatories.map((op) => {
              const opApts = day.appointments.filter((a) => a.operatoryNum === op.operatoryNum);
              const opBlocks = day.blocks.filter(
                (b) => b.schedType === 2 && (b.ops.length === 0 || b.ops.includes(op.operatoryNum))
              );
              const provSegments = day.blocks.filter(
                (b) => b.schedType === 1 && b.ops.includes(op.operatoryNum)
              );
              return (
                <div key={op.operatoryNum} className="min-w-[180px] flex-1 border-r last:border-r-0">
                  <div className="flex h-10 items-center justify-center border-b bg-muted/40 px-2">
                    <span className="truncate text-sm font-medium">{op.abbrev || op.opName}</span>
                    {op.isHygiene && <span className="ml-1.5 text-[10px] text-muted-foreground">HYG</span>}
                  </div>
                  <div
                    className="relative cursor-pointer"
                    style={{ height: gridHeight }}
                    onClick={(e) => {
                      // Click an empty slot to book, snapped to 10 minutes.
                      const rect = e.currentTarget.getBoundingClientRect();
                      const minute = DAY_START + Math.round((e.clientY - rect.top) / PX_PER_MIN / 10) * 10;
                      openBooking(op.operatoryNum, minute);
                    }}
                  >
                    {/* Hour lines */}
                    {hours.map((m) => (
                      <div
                        key={m}
                        className="absolute w-full border-t border-border/60"
                        style={{ top: (m - DAY_START) * PX_PER_MIN }}
                      />
                    ))}
                    {hours.map((m) => (
                      <div
                        key={`h-${m}`}
                        className="absolute w-full border-t border-dashed border-border/30"
                        style={{ top: (m + 30 - DAY_START) * PX_PER_MIN }}
                      />
                    ))}

                    {/* Provider schedule background */}
                    {provSegments.map((b) => {
                      const top = (timeSpanToMinutes(b.startTime) - DAY_START) * PX_PER_MIN;
                      const height = (timeSpanToMinutes(b.stopTime) - timeSpanToMinutes(b.startTime)) * PX_PER_MIN;
                      return (
                        <div
                          key={`prov-${b.scheduleNum}`}
                          className="absolute inset-x-0 bg-primary/5"
                          style={{ top, height }}
                        />
                      );
                    })}

                    {/* Blockouts */}
                    {opBlocks.map((b) => {
                      const top = (timeSpanToMinutes(b.startTime) - DAY_START) * PX_PER_MIN;
                      const height = (timeSpanToMinutes(b.stopTime) - timeSpanToMinutes(b.startTime)) * PX_PER_MIN;
                      return (
                        <div
                          key={`block-${b.scheduleNum}`}
                          className="absolute inset-x-0.5 z-10 flex items-start justify-center overflow-hidden rounded-sm px-1 py-0.5 text-[10px] opacity-80"
                          style={{
                            top,
                            height,
                            background: `repeating-linear-gradient(45deg, ${argbToHex(b.blockoutColor, "#cbd5e1")}33, ${argbToHex(b.blockoutColor, "#cbd5e1")}33 6px, transparent 6px, transparent 12px)`,
                            border: `1px dashed ${argbToHex(b.blockoutColor, "#cbd5e1")}`,
                          }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <span className="truncate text-muted-foreground">{b.blockoutDesc || b.note}</span>
                        </div>
                      );
                    })}

                    {/* Appointments */}
                    {opApts.map((a) => {
                      const start = minutesSinceMidnight(a.aptDateTime);
                      const top = (start - DAY_START) * PX_PER_MIN;
                      const height = Math.max(a.minutes * PX_PER_MIN, 24);
                      const color = argbToHex(a.providerColor, "#2f6b4f");
                      const confirmColor = argbToHex(a.confirmedColor, "transparent");
                      return (
                        <button
                          key={a.aptNum}
                          type="button"
                          className="absolute inset-x-1 z-20 overflow-hidden rounded-md border bg-card text-left shadow-sm transition-shadow hover:shadow-md"
                          style={{ top, height, borderLeft: `4px solid ${color}` }}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedApt(a.aptNum);
                          }}
                        >
                          <div className="flex h-full flex-col px-1.5 py-1">
                            <div className="flex items-center gap-1">
                              {a.confirmedDesc && (
                                <span
                                  className="h-2 w-2 shrink-0 rounded-full"
                                  style={{ background: confirmColor }}
                                  title={a.confirmedDesc}
                                />
                              )}
                              <span className="truncate text-xs font-medium leading-tight">
                                {a.patientName}
                              </span>
                              {a.isNewPatient && (
                                <span className="rounded bg-primary/15 px-1 text-[9px] font-semibold text-primary">NP</span>
                              )}
                            </div>
                            {height >= 40 && (
                              <span className="truncate text-[10px] text-muted-foreground">
                                {a.providerAbbr && `${a.providerAbbr} · `}
                                {a.procDescript || a.appointmentTypeName || `${a.minutes} min`}
                              </span>
                            )}
                            {height >= 56 && a.aptStatus === 2 && (
                              <span className="text-[10px] font-medium text-primary">Completed</span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {!loading && view === "week" && (
        <div className="grid gap-3 lg:grid-cols-7 md:grid-cols-4 grid-cols-2">
          {week.map((wd) => {
            const wdDate = String(wd.date);
            const isToday = wdDate === toDateInput(new Date());
            const apts = [...wd.appointments].sort(
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
                  onClick={() => {
                    setDate(wdDate);
                    setView("day");
                  }}
                  title="Open day view"
                >
                  <span className="text-xs font-medium">
                    {new Date(`${wdDate}T00:00`).toLocaleDateString("en-CA", { weekday: "short", month: "short", day: "numeric" })}
                  </span>
                  <span className="ml-1.5 text-[10px] text-muted-foreground">
                    {apts.length > 0 ? `${apts.length} appt${apts.length === 1 ? "" : "s"}` : ""}
                  </span>
                </button>
                <div className="flex-1 space-y-1 p-1.5">
                  {apts.length === 0 && (
                    <p className="px-1 py-2 text-[11px] text-muted-foreground">No appointments</p>
                  )}
                  {apts.map((a) => (
                    <button
                      key={a.aptNum}
                      type="button"
                      className="block w-full overflow-hidden rounded border bg-card px-1.5 py-1 text-left text-[11px] shadow-sm hover:shadow"
                      style={{ borderLeft: `3px solid ${argbToHex(a.providerColor, "#2f6b4f")}` }}
                      onClick={() => setSelectedApt(a.aptNum)}
                    >
                      <span className="font-medium">
                        {new Date(a.aptDateTime).toLocaleTimeString("en-CA", { hour: "numeric", minute: "2-digit" })}
                      </span>
                      <span className="ml-1 truncate">{a.patientName}</span>
                      {a.providerAbbr && (
                        <span className="ml-1 text-muted-foreground">· {a.providerAbbr}</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <NewAppointmentDialog
        open={bookOpen}
        onOpenChange={setBookOpen}
        operatories={operatories}
        providers={providers}
        appointmentTypes={apptTypes}
        defaultDateTime={bookDefaults.dateTime}
        defaultOperatoryNum={bookDefaults.opNum}
        onBooked={loadDay}
      />

      <AppointmentSheet
        aptNum={selectedApt}
        onOpenChange={(open) => !open && setSelectedApt(null)}
        confirmationStatuses={confirmStatuses}
        operatories={operatories}
        providers={providers}
        onChanged={loadDay}
      />
    </div>
  );
}
