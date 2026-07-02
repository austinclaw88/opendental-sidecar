"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { RefreshCcw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  AppointmentType,
  Definition,
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
import {
  fmtMinuteLabel,
  fmtMinuteRange,
  PX_PER_MIN,
  scheduleBounds,
  SNAP_MIN,
} from "@/lib/schedule-calculations";
import { NewAppointmentDialog } from "@/components/schedule/new-appointment-dialog";
import { AppointmentSheet } from "@/components/schedule/appointment-sheet";
import { AppointmentModulePanel } from "@/components/schedule/appointment-module-panel";
import { ScheduleToolbar, ScheduleView } from "@/components/schedule/schedule-toolbar";
import { ScheduleWeekView } from "@/components/schedule/schedule-week-view";

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

export default function SchedulePage() {
  const [date, setDate] = useState(() => toDateInput(new Date()));
  const [view, setView] = useState<ScheduleView>("day");
  const [day, setDay] = useState<ScheduleDay | null>(null);
  const [week, setWeek] = useState<ScheduleDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [providers, setProviders] = useState<Provider[]>([]);
  const [apptTypes, setApptTypes] = useState<AppointmentType[]>([]);
  const [confirmStatuses, setConfirmStatuses] = useState<Definition[]>([]);

  const [bookOpen, setBookOpen] = useState(false);
  const [bookDefaults, setBookDefaults] = useState<{ dateTime?: string; opNum?: number; minutes?: number }>({});
  const [openSlotMinutes, setOpenSlotMinutes] = useState(60);
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
    setLoadError("");
    if (view === "day") {
      scheduleApi
        .getDay(date)
        .then(setDay)
        .catch((e) => {
          setDay(null);
          setLoadError(e instanceof Error ? e.message : "Could not load the schedule.");
        })
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
        .catch((e) => {
          setWeek([]);
          setLoadError(e instanceof Error ? e.message : "Could not load the schedule.");
        })
        .finally(() => setLoading(false));
    }
  }, [date, view]);

  useEffect(() => {
    const id = window.setTimeout(loadDay, 0);
    return () => window.clearTimeout(id);
  }, [loadDay]);

  useEffect(() => {
    Promise.all([
      referenceApi.getProviders().catch(() => [] as Provider[]),
      referenceApi.getAppointmentTypes().catch(() => [] as AppointmentType[]),
      referenceApi.getConfirmationStatuses().catch(() => [] as Definition[]),
    ]).then(([p, t, c]) => {
      setProviders(p);
      setApptTypes(t);
      setConfirmStatuses(c);
    });
  }, []);

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
  const operatories = day?.operatories ?? [];

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
              {a.providerAbbr && `${a.providerAbbr} - `}
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
      <ScheduleToolbar
        date={date}
        view={view}
        loading={loading}
        onDateChange={setDate}
        onViewChange={setView}
        onRefresh={loadDay}
        onNewAppointment={() => openBooking()}
      />

      {loading && <p className="py-16 text-center text-muted-foreground">Loading schedule...</p>}

      {!loading && loadError && (
        <div className="rounded-lg border border-destructive/30 bg-card px-4 py-5 text-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="font-medium text-destructive">Schedule could not be loaded.</p>
              <p className="mt-1 break-words text-muted-foreground">{loadError}</p>
            </div>
            <Button variant="outline" onClick={loadDay} className="shrink-0">
              <RefreshCcw className="mr-2 h-4 w-4" />
              Retry
            </Button>
          </div>
        </div>
      )}

      {!loading && !loadError && (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="min-w-0 space-y-4">
            {view === "day" && day && day.operatories.length === 0 && (
              <p className="py-16 text-center text-muted-foreground">No operatories configured.</p>
            )}

            {view === "day" && day && day.operatories.length > 0 && (
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

            {view === "week" && (
              <ScheduleWeekView
                week={week}
                onOpenDay={(wdDate) => {
                  setDate(wdDate);
                  setView("day");
                }}
                onSelectAppointment={setSelectedApt}
              />
            )}
          </div>
          <AppointmentModulePanel
            day={day}
            dayStart={dayStart}
            dayEnd={dayEnd}
            openSlotMinutes={openSlotMinutes}
            onOpenSlotMinutesChange={setOpenSlotMinutes}
            onBookSlot={openBooking}
            onSelectAppointment={setSelectedApt}
          />
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
