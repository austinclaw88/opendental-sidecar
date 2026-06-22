"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { ChevronLeft, ChevronRight, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  AppointmentType,
  Definition,
  Operatory,
  Provider,
  ScheduleAppointment,
  ScheduleDay,
  appointmentApi,
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

const DEFAULT_DAY_START = 7 * 60; // 7:00
const DEFAULT_DAY_END = 19 * 60; // 19:00
const MIN_DAY_START = 0;
const MAX_DAY_END = 24 * 60;
const PX_PER_MIN = 2; // 1 hour = 120px
const SNAP_MIN = 10;

type DragState = {
  apt: ScheduleAppointment;
  targetOp: number;
  startMinute: number;
};

type SelectionState = {
  op: number;
  startMinute: number;
  endMinute: number;
};

/** Immutably patch a single appointment in a day. Pure, safe for concurrent optimistic updates. */
function patchApt(
  d: ScheduleDay | null,
  aptNum: number,
  patch: Partial<ScheduleAppointment>
): ScheduleDay | null {
  if (!d) return d;
  return {
    ...d,
    appointments: d.appointments.map((a) => (a.aptNum === aptNum ? { ...a, ...patch } : a)),
  };
}

function fmtMinuteLabel(min: number): string {
  const h24 = Math.floor(min / 60);
  const m = min % 60;
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  const ampm = h24 < 12 ? "am" : "pm";
  return `${h12}:${`${m}`.padStart(2, "0")}${ampm}`;
}

function fmtCompactMinuteLabel(min: number): string {
  const h24 = Math.floor(min / 60);
  const m = min % 60;
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  const suffix = h24 < 12 ? "a" : "p";
  return m === 0 ? `${h12}${suffix}` : `${h12}:${`${m}`.padStart(2, "0")}${suffix}`;
}

function fmtMinuteRange(start: number, minutes: number): string {
  return `${fmtCompactMinuteLabel(start)}-${fmtCompactMinuteLabel(start + minutes)}`;
}

function scheduleBounds(d: ScheduleDay | null): { start: number; end: number } {
  if (!d) return { start: DEFAULT_DAY_START, end: DEFAULT_DAY_END };

  const starts = [DEFAULT_DAY_START];
  const ends = [DEFAULT_DAY_END];

  for (const a of d.appointments) {
    const start = minutesSinceMidnight(a.aptDateTime);
    starts.push(start);
    ends.push(start + a.minutes);
  }

  for (const b of d.blocks) {
    starts.push(timeSpanToMinutes(b.startTime));
    ends.push(timeSpanToMinutes(b.stopTime));
  }

  const start = Math.max(MIN_DAY_START, Math.floor(Math.min(...starts) / 60) * 60);
  const end = Math.min(MAX_DAY_END, Math.ceil(Math.max(...ends) / 60) * 60);
  return { start, end: Math.max(end, start + 60) };
}

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
  const [bookDefaults, setBookDefaults] = useState<{ dateTime?: string; opNum?: number; minutes?: number }>({});
  const [selectedApt, setSelectedApt] = useState<number | null>(null);
  const hydrated = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );

  // Drag-to-reschedule state.
  const [drag, setDrag] = useState<DragState | null>(null);
  const [selection, setSelection] = useState<SelectionState | null>(null);
  const [saving, setSaving] = useState<Set<number>>(new Set());
  const [toast, setToast] = useState<string | null>(null);
  const colRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const suppressClickRef = useRef(false); // swallow the click that follows a drag
  const cleanupRef = useRef<(() => void) | null>(null);

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

  // Tear down any in-flight drag listeners if we unmount mid-drag.
  useEffect(() => () => cleanupRef.current?.(), []);

  // Auto-dismiss the error toast.
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(t);
  }, [toast]);

  const { start: dayStart, end: dayEnd } = useMemo(() => scheduleBounds(day), [day]);

  const hours = useMemo(() => {
    const list: number[] = [];
    for (let m = dayStart; m < dayEnd; m += 60) list.push(m);
    return list;
  }, [dayStart, dayEnd]);

  const openBooking = (opNum?: number, minute?: number, minutes?: number) => {
    let dateTime: string | undefined;
    if (minute != null) {
      const h = `${Math.floor(minute / 60)}`.padStart(2, "0");
      const m = `${minute % 60}`.padStart(2, "0");
      dateTime = `${date}T${h}:${m}`;
    }
    setBookDefaults({ dateTime, opNum, minutes });
    setBookOpen(true);
  };

  const minuteFromColumnY = (el: HTMLElement, clientY: number, snap = SNAP_MIN) => {
    const rect = el.getBoundingClientRect();
    const minute = dayStart + Math.round((clientY - rect.top) / PX_PER_MIN / snap) * snap;
    return Math.max(dayStart, Math.min(minute, dayEnd));
  };

  // Resolve a pointer position to a target operatory + snapped start minute.
  const resolveDrop = (
    clientX: number,
    clientY: number,
    grabDy: number,
    minutes: number
  ): { op: number; minute: number } | null => {
    const entries = [...colRefs.current.entries()];
    if (entries.length === 0) return null;

    let chosen: { op: number; rect: DOMRect } | null = null;
    for (const [opNum, el] of entries) {
      const r = el.getBoundingClientRect();
      if (clientX >= r.left && clientX <= r.right) {
        chosen = { op: opNum, rect: r };
        break;
      }
    }
    if (!chosen) {
      // Pointer is in the time gutter or past the last column: snap to the nearest column.
      let best = Infinity;
      for (const [opNum, el] of entries) {
        const r = el.getBoundingClientRect();
        const cx = (r.left + r.right) / 2;
        const dist = Math.abs(clientX - cx);
        if (dist < best) {
          best = dist;
          chosen = { op: opNum, rect: r };
        }
      }
    }
    if (!chosen) return null;

    const topPx = clientY - chosen.rect.top - grabDy;
    let minute = dayStart + Math.round(topPx / PX_PER_MIN / SNAP_MIN) * SNAP_MIN;
    minute = Math.max(dayStart, Math.min(minute, dayEnd - minutes));
    return { op: chosen.op, minute };
  };

  const beginDrag = (e: React.PointerEvent<HTMLDivElement>, apt: ScheduleAppointment) => {
    if (e.button !== 0) return; // left button only
    e.stopPropagation();
    if (apt.aptStatus === 2) return; // completed appointments are click-to-open, not draggable
    if (saving.has(apt.aptNum)) return; // already persisting a move

    suppressClickRef.current = false;
    const startX = e.clientX;
    const startY = e.clientY;
    const blockRect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const grabDy = startY - blockRect.top;
    let moved = false;

    const onMove = (ev: PointerEvent) => {
      if (!moved && Math.hypot(ev.clientX - startX, ev.clientY - startY) < 4) return;
      moved = true;
      const drop = resolveDrop(ev.clientX, ev.clientY, grabDy, apt.minutes);
      if (drop) setDrag({ apt, targetOp: drop.op, startMinute: drop.minute });
    };

    const cleanup = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onCancel);
      cleanupRef.current = null;
    };

    const onUp = (ev: PointerEvent) => {
      cleanup();
      setDrag(null);
      if (!moved) return; // a click, not a drag: let onClick open the sheet
      suppressClickRef.current = true; // swallow the trailing click
      const drop = resolveDrop(ev.clientX, ev.clientY, grabDy, apt.minutes);
      if (!drop) return;
      const origMinute = minutesSinceMidnight(apt.aptDateTime);
      if (drop.op === apt.operatoryNum && drop.minute === origMinute) return; // no change
      void commitMove(apt, drop.op, drop.minute);
    };

    const onCancel = () => {
      cleanup();
      setDrag(null);
    };

    cleanupRef.current = cleanup;
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onCancel);
  };

  const beginSelection = (e: React.PointerEvent<HTMLDivElement>, opNum: number) => {
    if (e.button !== 0) return;
    if ((e.target as HTMLElement).closest("[data-apt-card], [data-blockout]")) return;

    const col = e.currentTarget;
    const startX = e.clientX;
    const startY = e.clientY;
    const anchor = minuteFromColumnY(col, e.clientY);
    let moved = false;

    const selectionFrom = (clientY: number) => {
      const raw = minuteFromColumnY(col, clientY);
      const start = Math.min(anchor, raw);
      const end = Math.max(anchor, raw);
      return {
        op: opNum,
        startMinute: start,
        endMinute: Math.min(dayEnd, Math.max(start + SNAP_MIN, end)),
      };
    };

    const onMove = (ev: PointerEvent) => {
      if (!moved && Math.hypot(ev.clientX - startX, ev.clientY - startY) < 4) return;
      moved = true;
      setSelection(selectionFrom(ev.clientY));
    };

    const cleanup = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onCancel);
      cleanupRef.current = null;
    };

    const onUp = (ev: PointerEvent) => {
      cleanup();
      const finalSelection = moved ? selectionFrom(ev.clientY) : null;
      setSelection(null);
      if (!finalSelection) return;

      suppressClickRef.current = true;
      openBooking(
        finalSelection.op,
        finalSelection.startMinute,
        finalSelection.endMinute - finalSelection.startMinute
      );
    };

    const onCancel = () => {
      cleanup();
      setSelection(null);
    };

    cleanupRef.current?.();
    cleanupRef.current = cleanup;
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onCancel);
  };

  const commitMove = async (apt: ScheduleAppointment, op: number, minute: number) => {
    const hh = `${Math.floor(minute / 60)}`.padStart(2, "0");
    const mm = `${minute % 60}`.padStart(2, "0");
    const newDateTime = `${date}T${hh}:${mm}`;
    const optimisticDt = `${date}T${hh}:${mm}:00`;
    const orig = { op: apt.operatoryNum, dt: apt.aptDateTime };

    // Optimistic: move it immediately so the grid feels instant.
    setDay((d) => patchApt(d, apt.aptNum, { operatoryNum: op, aptDateTime: optimisticDt }));
    setSaving((s) => new Set(s).add(apt.aptNum));

    try {
      await appointmentApi.update(apt.aptNum, { aptDateTime: newDateTime, operatoryNum: op });
    } catch (err) {
      // Roll back to where it was and tell the user why.
      setDay((d) => patchApt(d, apt.aptNum, { operatoryNum: orig.op, aptDateTime: orig.dt }));
      const msg = err instanceof Error ? err.message : "Unknown error";
      setToast(`Could not move ${apt.patientName}: ${msg}`);
    } finally {
      setSaving((s) => {
        const n = new Set(s);
        n.delete(apt.aptNum);
        return n;
      });
    }
  };

  const gridHeight = (dayEnd - dayStart) * PX_PER_MIN;

  // Renders one appointment block. `preview` is the floating copy shown while dragging.
  const renderApt = (
    a: ScheduleAppointment,
    opts?: { preview?: boolean; minute?: number }
  ) => {
    const preview = opts?.preview ?? false;
    const startMin = opts?.minute ?? minutesSinceMidnight(a.aptDateTime);
    const top = (startMin - dayStart) * PX_PER_MIN;
    const height = Math.max(a.minutes * PX_PER_MIN, 24);
    const color = argbToHex(a.providerColor, "#2f6b4f");
    const confirmColor = argbToHex(a.confirmedColor, "transparent");
    const isSaving = saving.has(a.aptNum);
    const locked = a.aptStatus === 2; // completed

    return (
      <div
        key={preview ? `preview-${a.aptNum}` : a.aptNum}
        role="button"
        tabIndex={preview ? -1 : 0}
        onPointerDown={preview ? undefined : (e) => beginDrag(e, a)}
        onClick={(e) => {
          e.stopPropagation();
          if (preview) return;
          if (suppressClickRef.current) {
            suppressClickRef.current = false;
            return;
          }
          setSelectedApt(a.aptNum);
        }}
        onKeyDown={(e) => {
          if (preview) return;
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setSelectedApt(a.aptNum);
          }
        }}
        className={cn(
          "absolute inset-x-1 overflow-hidden rounded-md border bg-card text-left shadow-sm transition-shadow select-none",
          preview
            ? "z-40 opacity-95 shadow-lg ring-2 ring-primary"
            : "z-20 hover:shadow-md",
          locked ? "cursor-pointer" : "cursor-grab active:cursor-grabbing",
          isSaving && !preview && "opacity-60"
        )}
        data-apt-card
        style={{ top, height, borderLeft: `4px solid ${color}`, touchAction: "none" }}
      >
        <div className="flex h-full min-w-0 flex-col px-1.5 py-1">
          <div className="flex min-w-0 items-center gap-1">
            {a.confirmedDesc && (
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ background: confirmColor }}
                title={a.confirmedDesc}
              />
            )}
            <span className="min-w-0 flex-1 truncate text-[11px] font-medium leading-tight">{a.patientName}</span>
            {a.isNewPatient && (
              <span className="shrink-0 rounded bg-primary/15 px-1 text-[9px] font-semibold text-primary">
                NP
              </span>
            )}
            {preview && (
              <span className="ml-auto shrink-0 rounded bg-primary px-1 text-[9px] font-semibold text-primary-foreground">
                {fmtMinuteLabel(startMin)}
              </span>
            )}
          </div>
          {height >= 36 && (
            <span className="truncate text-[10px] leading-tight font-medium text-foreground/70">
              {fmtMinuteRange(startMin, a.minutes)}
            </span>
          )}
          {height >= 58 && (
            <span className="truncate text-[10px] leading-tight text-muted-foreground">
              {a.providerAbbr && `${a.providerAbbr} · `}
              {a.procDescript || a.appointmentTypeName || `${a.minutes} min`}
            </span>
          )}
          {height >= 76 && a.aptStatus === 2 && (
            <span className="truncate text-[10px] leading-tight font-medium text-primary">Completed</span>
          )}
        </div>
      </div>
    );
  };

  if (!hydrated) {
    return <p className="py-16 text-center text-muted-foreground">Loading schedule...</p>;
  }

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
            <div className="sticky left-0 z-30 w-14 shrink-0 border-r bg-card">
              <div className="h-10 border-b" />
              <div className="relative" style={{ height: gridHeight }}>
                {hours.map((m) => (
                  <div
                    key={m}
                    className="absolute w-full pr-1.5 text-right text-[11px] text-muted-foreground"
                    style={{ top: (m - dayStart) * PX_PER_MIN - 7 }}
                  >
                    {Math.floor(m / 60) % 12 === 0 ? 12 : Math.floor(m / 60) % 12}
                    {Math.floor(m / 60) < 12 ? "a" : "p"}
                  </div>
                ))}
              </div>
            </div>

            {/* Operatory columns */}
            {day.operatories.map((op) => {
              const draggingId = drag?.apt.aptNum ?? null;
              const opApts = day.appointments.filter(
                (a) => a.operatoryNum === op.operatoryNum && a.aptNum !== draggingId
              );
              const opBlocks = day.blocks.filter(
                (b) => b.schedType === 2 && (b.ops.length === 0 || b.ops.includes(op.operatoryNum))
              );
              const provSegments = day.blocks.filter(
                (b) => b.schedType === 1 && b.ops.includes(op.operatoryNum)
              );
              const isDropTarget = drag?.targetOp === op.operatoryNum;
              const activeSelection = selection?.op === op.operatoryNum ? selection : null;
              return (
                <div key={op.operatoryNum} className="min-w-[180px] flex-1 border-r last:border-r-0">
                  <div className="flex h-10 items-center justify-center border-b bg-muted/40 px-2">
                    <span className="truncate text-sm font-medium">{op.abbrev || op.opName}</span>
                    {op.isHygiene && <span className="ml-1.5 text-[10px] text-muted-foreground">HYG</span>}
                  </div>
                  <div
                    ref={(el) => {
                      if (el) colRefs.current.set(op.operatoryNum, el);
                      else colRefs.current.delete(op.operatoryNum);
                    }}
                    className={cn(
                      "relative cursor-pointer",
                      isDropTarget && "bg-primary/5"
                    )}
                    style={{ height: gridHeight }}
                    onPointerDown={(e) => beginSelection(e, op.operatoryNum)}
                    onClick={(e) => {
                      if (drag || selection) return;
                      if (suppressClickRef.current) {
                        suppressClickRef.current = false;
                        return;
                      }
                      // Click an empty slot to book, snapped to 10 minutes.
                      const rect = e.currentTarget.getBoundingClientRect();
                      const minute = dayStart + Math.round((e.clientY - rect.top) / PX_PER_MIN / 10) * 10;
                      openBooking(op.operatoryNum, minute);
                    }}
                  >
                    {/* Hour lines */}
                    {hours.map((m) => (
                      <div
                        key={m}
                        className="pointer-events-none absolute w-full border-t border-border/60"
                        style={{ top: (m - dayStart) * PX_PER_MIN }}
                      />
                    ))}
                    {hours.map((m) => (
                      <div
                        key={`h-${m}`}
                        className="pointer-events-none absolute w-full border-t border-dashed border-border/30"
                        style={{ top: (m + 30 - dayStart) * PX_PER_MIN }}
                      />
                    ))}

                    {/* Provider schedule background */}
                    {provSegments.map((b) => {
                      const top = (timeSpanToMinutes(b.startTime) - dayStart) * PX_PER_MIN;
                      const height = (timeSpanToMinutes(b.stopTime) - timeSpanToMinutes(b.startTime)) * PX_PER_MIN;
                      return (
                        <div
                          key={`prov-${b.scheduleNum}`}
                          className="pointer-events-none absolute inset-x-0 bg-primary/5"
                          style={{ top, height }}
                        />
                      );
                    })}

                    {/* Blockouts */}
                    {opBlocks.map((b) => {
                      const top = (timeSpanToMinutes(b.startTime) - dayStart) * PX_PER_MIN;
                      const height = (timeSpanToMinutes(b.stopTime) - timeSpanToMinutes(b.startTime)) * PX_PER_MIN;
                      return (
                        <div
                          key={`block-${b.scheduleNum}`}
                          className="absolute inset-x-0.5 z-10 flex items-start justify-center overflow-hidden rounded-sm px-1 py-0.5 text-[10px] opacity-80"
                          data-blockout
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
                    {opApts.map((a) => renderApt(a))}

                    {/* Empty-slot selection preview */}
                    {activeSelection && (
                      <div
                        className="pointer-events-none absolute inset-x-1 z-30 overflow-hidden rounded-md border border-primary bg-primary/15 px-2 py-1 text-[10px] font-medium text-primary shadow-sm ring-1 ring-primary/30"
                        style={{
                          top: (activeSelection.startMinute - dayStart) * PX_PER_MIN,
                          height: Math.max(
                            (activeSelection.endMinute - activeSelection.startMinute) * PX_PER_MIN,
                            24
                          ),
                        }}
                      >
                        <div className="truncate">
                          {fmtMinuteRange(
                            activeSelection.startMinute,
                            activeSelection.endMinute - activeSelection.startMinute
                          )}
                        </div>
                        <div className="truncate text-[9px]">
                          {activeSelection.endMinute - activeSelection.startMinute} min
                        </div>
                      </div>
                    )}

                    {/* Floating drag preview lands here */}
                    {isDropTarget && drag && renderApt(drag.apt, { preview: true, minute: drag.startMinute })}
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

      {/* Move-failed toast */}
      {toast && (
        <div className="fixed bottom-4 right-4 z-50 flex max-w-sm items-start gap-2 rounded-lg border border-destructive/40 bg-card px-4 py-3 text-sm shadow-lg">
          <span className="text-destructive">{toast}</span>
          <button
            type="button"
            onClick={() => setToast(null)}
            className="ml-auto text-muted-foreground hover:text-foreground"
            aria-label="Dismiss"
          >
            <X className="h-4 w-4" />
          </button>
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
        defaultMinutes={bookDefaults.minutes}
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
