import { Operatory, ScheduleAppointment, ScheduleDay } from "@/lib/api";
import { minutesSinceMidnight, timeSpanToMinutes } from "@/lib/format";

export const DEFAULT_DAY_START = 7 * 60;
export const DEFAULT_DAY_END = 19 * 60;
export const MIN_DAY_START = 0;
export const MAX_DAY_END = 24 * 60;
export const PX_PER_MIN = 2;
export const SNAP_MIN = 10;

export type OpenSlot = {
  op: Operatory;
  startMinute: number;
  minutes: number;
};

export type AppointmentModuleQueues = {
  waiting: ScheduleAppointment[];
  inTreatment: ScheduleAppointment[];
  needsConfirmation: ScheduleAppointment[];
  asap: ScheduleAppointment[];
};

export type AppointmentDayStats = {
  scheduled: number;
  completed: number;
  brokenOrUnscheduled: number;
  newPatients: number;
};

export function fmtMinuteLabel(min: number): string {
  const h24 = Math.floor(min / 60);
  const m = min % 60;
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  const ampm = h24 < 12 ? "am" : "pm";
  return `${h12}:${`${m}`.padStart(2, "0")}${ampm}`;
}

export function fmtCompactMinuteLabel(min: number): string {
  const h24 = Math.floor(min / 60);
  const m = min % 60;
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  const suffix = h24 < 12 ? "a" : "p";
  return m === 0 ? `${h12}${suffix}` : `${h12}:${`${m}`.padStart(2, "0")}${suffix}`;
}

export function fmtMinuteRange(start: number, minutes: number): string {
  return `${fmtCompactMinuteLabel(start)}-${fmtCompactMinuteLabel(start + minutes)}`;
}

export function scheduleBounds(d: ScheduleDay | null): { start: number; end: number } {
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

export function hasRealDateTime(value?: string): boolean {
  return !!value && new Date(value).getFullYear() > 1;
}

export function sortAppointments(appointments: ScheduleAppointment[]): ScheduleAppointment[] {
  return [...appointments].sort(
    (a, b) => new Date(a.aptDateTime).getTime() - new Date(b.aptDateTime).getTime()
  );
}

export function buildAppointmentModuleQueues(
  appointments: ScheduleAppointment[]
): AppointmentModuleQueues {
  const sorted = sortAppointments(appointments);
  const active = sorted.filter((a) => a.aptStatus === 1 || a.aptStatus === 2);

  return {
    waiting: active.filter((a) => hasRealDateTime(a.dateTimeArrived) && !hasRealDateTime(a.dateTimeSeated)),
    inTreatment: active.filter((a) => hasRealDateTime(a.dateTimeSeated) && !hasRealDateTime(a.dateTimeDismissed)),
    needsConfirmation: active.filter((a) => (a.confirmedDesc ?? "").toLowerCase().includes("unconfirmed")),
    asap: active.filter((a) => a.priority === 1),
  };
}

export function buildAppointmentDayStats(appointments: ScheduleAppointment[]): AppointmentDayStats {
  return {
    scheduled: appointments.filter((a) => a.aptStatus === 1).length,
    completed: appointments.filter((a) => a.aptStatus === 2).length,
    brokenOrUnscheduled: appointments.filter((a) => a.aptStatus === 3 || a.aptStatus === 5).length,
    newPatients: appointments.filter((a) => a.isNewPatient).length,
  };
}

export function findOpenSlots(
  day: ScheduleDay | null,
  dayStart: number,
  dayEnd: number,
  requestedMinutes: number
): OpenSlot[] {
  if (!day) return [];

  const slots: OpenSlot[] = [];
  const wanted = Math.max(SNAP_MIN, Math.ceil(requestedMinutes / SNAP_MIN) * SNAP_MIN);

  for (const op of day.operatories) {
    const busy = [
      ...day.appointments
        .filter((a) => a.operatoryNum === op.operatoryNum && a.aptStatus !== 3 && a.aptStatus !== 5)
        .map((a) => {
          const start = minutesSinceMidnight(a.aptDateTime);
          return { start, end: start + a.minutes };
        }),
      ...day.blocks
        .filter((b) => b.schedType === 2 && (b.ops.length === 0 || b.ops.includes(op.operatoryNum)))
        .map((b) => ({
          start: timeSpanToMinutes(b.startTime),
          end: timeSpanToMinutes(b.stopTime),
        })),
    ].sort((a, b) => a.start - b.start);

    let cursor = dayStart;
    for (const item of busy) {
      const start = Math.max(dayStart, item.start);
      const end = Math.min(dayEnd, item.end);
      if (start - cursor >= wanted) {
        slots.push({ op, startMinute: cursor, minutes: start - cursor });
      }
      cursor = Math.max(cursor, end);
    }

    if (dayEnd - cursor >= wanted) {
      slots.push({ op, startMinute: cursor, minutes: dayEnd - cursor });
    }
  }

  return slots
    .sort((a, b) => a.startMinute - b.startMinute || a.op.itemOrder - b.op.itemOrder)
    .slice(0, 12);
}
