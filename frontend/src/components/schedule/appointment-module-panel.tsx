"use client";

import { useMemo } from "react";
import {
  Activity,
  CalendarClock,
  Clock,
  DoorOpen,
  ListChecks,
  Search,
  Zap,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { ScheduleAppointment, ScheduleDay } from "@/lib/api";
import {
  buildAppointmentDayStats,
  buildAppointmentModuleQueues,
  findOpenSlots,
  fmtCompactMinuteLabel,
  fmtMinuteRange,
  SNAP_MIN,
} from "@/lib/schedule-calculations";
import { minutesSinceMidnight } from "@/lib/format";

type AppointmentModulePanelProps = {
  day: ScheduleDay | null;
  dayStart: number;
  dayEnd: number;
  openSlotMinutes: number;
  onOpenSlotMinutesChange: (minutes: number) => void;
  onBookSlot: (opNum: number, startMinute: number, minutes: number) => void;
  onSelectAppointment: (aptNum: number) => void;
};

function normalizeSlotMinutes(value: string): number {
  const parsed = Number(value || SNAP_MIN);
  if (!Number.isFinite(parsed)) return SNAP_MIN;
  return Math.max(SNAP_MIN, Math.ceil(parsed / SNAP_MIN) * SNAP_MIN);
}

function QueueList({
  items,
  empty,
  onSelectAppointment,
}: {
  items: ScheduleAppointment[];
  empty: string;
  onSelectAppointment: (aptNum: number) => void;
}) {
  return (
    <div className="space-y-1">
      {items.length === 0 && <p className="px-2 py-2 text-xs text-muted-foreground">{empty}</p>}
      {items.map((a) => (
        <button
          key={a.aptNum}
          type="button"
          className="grid w-full grid-cols-[auto_1fr] gap-x-2 rounded-md px-2 py-1.5 text-left text-xs hover:bg-muted"
          onClick={() => onSelectAppointment(a.aptNum)}
        >
          <span className="font-medium tabular-nums text-muted-foreground">
            {fmtCompactMinuteLabel(minutesSinceMidnight(a.aptDateTime))}
          </span>
          <span className="min-w-0">
            <span className="block truncate font-medium">{a.patientName}</span>
            <span className="block truncate text-muted-foreground">
              {a.providerAbbr && `${a.providerAbbr} - `}
              {a.procDescript || a.appointmentTypeName || `${a.minutes} min`}
            </span>
          </span>
        </button>
      ))}
    </div>
  );
}

export function AppointmentModulePanel({
  day,
  dayStart,
  dayEnd,
  openSlotMinutes,
  onOpenSlotMinutesChange,
  onBookSlot,
  onSelectAppointment,
}: AppointmentModulePanelProps) {
  const appointments = useMemo(() => day?.appointments ?? [], [day]);
  const stats = useMemo(() => buildAppointmentDayStats(appointments), [appointments]);
  const queues = useMemo(() => buildAppointmentModuleQueues(appointments), [appointments]);
  const openSlots = useMemo(
    () => findOpenSlots(day, dayStart, dayEnd, openSlotMinutes),
    [day, dayStart, dayEnd, openSlotMinutes]
  );

  return (
    <aside className="space-y-3 xl:sticky xl:top-4 xl:self-start">
      <div className="rounded-lg border bg-card">
        <div className="flex items-center gap-2 border-b px-3 py-2">
          <CalendarClock className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold">Appointment Module</h2>
        </div>
        <div className="grid grid-cols-2 gap-2 p-3 text-xs">
          <div className="rounded-md border px-2 py-2">
            <span className="block text-muted-foreground">Scheduled</span>
            <span className="text-lg font-semibold tabular-nums">{stats.scheduled}</span>
          </div>
          <div className="rounded-md border px-2 py-2">
            <span className="block text-muted-foreground">Complete</span>
            <span className="text-lg font-semibold tabular-nums">{stats.completed}</span>
          </div>
          <div className="rounded-md border px-2 py-2">
            <span className="block text-muted-foreground">Broken/Unsched</span>
            <span className="text-lg font-semibold tabular-nums">{stats.brokenOrUnscheduled}</span>
          </div>
          <div className="rounded-md border px-2 py-2">
            <span className="block text-muted-foreground">New Patients</span>
            <span className="text-lg font-semibold tabular-nums">{stats.newPatients}</span>
          </div>
        </div>
      </div>

      <div className="rounded-lg border bg-card">
        <div className="flex items-center gap-2 border-b px-3 py-2">
          <Search className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold">Find Openings</h2>
        </div>
        <div className="space-y-2 p-3">
          <label className="grid grid-cols-[1fr_5.5rem] items-center gap-2 text-xs">
            <span className="text-muted-foreground">Length</span>
            <Input
              type="number"
              min={SNAP_MIN}
              step={SNAP_MIN}
              value={openSlotMinutes}
              onChange={(e) => onOpenSlotMinutesChange(normalizeSlotMinutes(e.target.value))}
              className="h-8 text-xs"
            />
          </label>
          <div className="space-y-1">
            {openSlots.length === 0 && (
              <p className="px-2 py-2 text-xs text-muted-foreground">No matching openings on this day.</p>
            )}
            {openSlots.map((slot) => (
              <button
                key={`${slot.op.operatoryNum}-${slot.startMinute}`}
                type="button"
                className="grid w-full grid-cols-[auto_1fr_auto] items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs hover:bg-muted"
                onClick={() => onBookSlot(slot.op.operatoryNum, slot.startMinute, openSlotMinutes)}
              >
                <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="min-w-0">
                  <span className="block truncate font-medium">{slot.op.abbrev || slot.op.opName}</span>
                  <span className="block truncate text-muted-foreground">
                    {fmtMinuteRange(slot.startMinute, openSlotMinutes)}
                  </span>
                </span>
                <span className="text-[10px] tabular-nums text-muted-foreground">{slot.minutes}m</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-lg border bg-card">
        <div className="flex items-center gap-2 border-b px-3 py-2">
          <DoorOpen className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold">Waiting Room</h2>
        </div>
        <div className="p-2">
          <QueueList items={queues.waiting} empty="No patients waiting." onSelectAppointment={onSelectAppointment} />
        </div>
      </div>

      <div className="rounded-lg border bg-card">
        <div className="flex items-center gap-2 border-b px-3 py-2">
          <Activity className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold">In Treatment</h2>
        </div>
        <div className="p-2">
          <QueueList items={queues.inTreatment} empty="No active treatment visits." onSelectAppointment={onSelectAppointment} />
        </div>
      </div>

      <div className="rounded-lg border bg-card">
        <div className="flex items-center gap-2 border-b px-3 py-2">
          <ListChecks className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold">Needs Confirmation</h2>
        </div>
        <div className="p-2">
          <QueueList items={queues.needsConfirmation} empty="No unconfirmed appointments." onSelectAppointment={onSelectAppointment} />
        </div>
      </div>

      <div className="rounded-lg border bg-card">
        <div className="flex items-center gap-2 border-b px-3 py-2">
          <Zap className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold">ASAP List</h2>
        </div>
        <div className="p-2">
          <QueueList items={queues.asap} empty="No ASAP appointments today." onSelectAppointment={onSelectAppointment} />
        </div>
      </div>
    </aside>
  );
}
