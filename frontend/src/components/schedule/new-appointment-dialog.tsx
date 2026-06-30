"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, Label } from "@/components/ui/select";
import { PatientPicker } from "@/components/patient-picker";
import {
  AppointmentType,
  Operatory,
  PatientSummary,
  Procedure,
  Provider,
  api,
  appointmentApi,
} from "@/lib/api";
import { fmtMoney } from "@/lib/format";

const APPOINTMENT_STEP_MIN = 10;

interface NewAppointmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  operatories: Operatory[];
  providers: Provider[];
  appointmentTypes: AppointmentType[];
  /** Prefill when the dialog is opened by clicking an empty schedule slot. */
  defaultDateTime?: string; // "yyyy-MM-ddTHH:mm"
  defaultOperatoryNum?: number;
  defaultMinutes?: number;
  /** Prefill when booking from a patient page or recall list. */
  defaultPatient?: PatientSummary | null;
  /** When booking from the recall list, the recall row to mark as scheduled. */
  recallNum?: number;
  onBooked: () => void;
}

function splitDateTime(value?: string): { date: string; time: string } {
  if (!value) return { date: "", time: "" };
  const [date = "", time = ""] = value.split("T");
  return { date, time: time.slice(0, 5) };
}

function normalizeDuration(value: number) {
  if (!Number.isFinite(value) || value <= 0) return 60;
  return Math.min(540, Math.max(APPOINTMENT_STEP_MIN, Math.ceil(value / APPOINTMENT_STEP_MIN) * APPOINTMENT_STEP_MIN));
}

export function NewAppointmentDialog({
  open,
  onOpenChange,
  operatories,
  providers,
  appointmentTypes,
  defaultDateTime,
  defaultOperatoryNum,
  defaultMinutes,
  defaultPatient,
  recallNum,
  onBooked,
}: NewAppointmentDialogProps) {
  const [patient, setPatient] = useState<PatientSummary | null>(null);
  const [appointmentDate, setAppointmentDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [minutes, setMinutes] = useState(60);
  const [operatoryNum, setOperatoryNum] = useState<number>(0);
  const [provNum, setProvNum] = useState<number>(0);
  const [apptTypeNum, setApptTypeNum] = useState<number>(0);
  const [isNewPatient, setIsNewPatient] = useState(false);
  const [isHygiene, setIsHygiene] = useState(false);
  const [note, setNote] = useState("");
  const [tpProcedures, setTpProcedures] = useState<Procedure[]>([]);
  const [selectedProcs, setSelectedProcs] = useState<Set<number>>(new Set());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Reset form each time the dialog opens.
  useEffect(() => {
    if (!open) return;
    const defaultParts = splitDateTime(defaultDateTime);
    setPatient(defaultPatient ?? null);
    setAppointmentDate(defaultParts.date);
    setStartTime(defaultParts.time);
    setMinutes(normalizeDuration(defaultMinutes ?? 60));
    setOperatoryNum(defaultOperatoryNum ?? operatories[0]?.operatoryNum ?? 0);
    setProvNum(0);
    setApptTypeNum(0);
    setIsNewPatient(false);
    setIsHygiene(false);
    setNote("");
    setSelectedProcs(new Set());
    setError("");
  }, [open, defaultDateTime, defaultOperatoryNum, defaultMinutes, defaultPatient, operatories]);

  // Load treatment-planned procedures when a patient is chosen.
  useEffect(() => {
    if (!patient) {
      setTpProcedures([]);
      return;
    }
    api
      .getProcedures(patient.patNum)
      .then((procs) =>
        setTpProcedures(
          procs.filter((p) => p.procStatusDesc.toLowerCase().includes("treatment"))
        )
      )
      .catch(() => setTpProcedures([]));
  }, [patient]);

  // When an appointment type with a pattern is chosen, adopt its length.
  const handleTypeChange = (num: number) => {
    setApptTypeNum(num);
    const t = appointmentTypes.find((x) => x.appointmentTypeNum === num);
    if (t?.pattern) setMinutes(normalizeDuration(t.pattern.length * 5));
  };

  const procFeeTotal = useMemo(
    () =>
      tpProcedures
        .filter((p) => selectedProcs.has(p.procNum))
        .reduce((sum, p) => sum + p.procFee, 0),
    [tpProcedures, selectedProcs]
  );

  const submit = async () => {
    if (!patient) return setError("Choose a patient first.");
    if (!appointmentDate || !startTime) return setError("Pick a date and start time.");
    if (!operatoryNum) return setError("Pick an operatory.");
    const [, minutePart = "0"] = startTime.split(":");
    if (parseInt(minutePart, 10) % APPOINTMENT_STEP_MIN !== 0)
      return setError("Start time must be on a 10-minute interval.");
    const normalizedMinutes = normalizeDuration(minutes);
    setSaving(true);
    setError("");
    try {
      const selected = tpProcedures.filter((p) => selectedProcs.has(p.procNum));
      await appointmentApi.create({
        patNum: patient.patNum,
        aptDateTime: `${appointmentDate}T${startTime}`,
        minutes: normalizedMinutes,
        operatoryNum,
        provNum: provNum || undefined,
        appointmentTypeNum: apptTypeNum || undefined,
        isNewPatient,
        isHygiene,
        note: note || undefined,
        procDescript:
          selected.length > 0
            ? selected.map((p) => p.procCode).join(", ")
            : undefined,
        procNums: selected.length > 0 ? selected.map((p) => p.procNum) : undefined,
        recallNum: recallNum || undefined,
      });
      onOpenChange(false);
      onBooked();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Booking failed.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-lg overflow-hidden">
        <DialogHeader className="min-w-0 pr-8">
          <DialogTitle>New Appointment</DialogTitle>
        </DialogHeader>

        <div className="min-w-0 space-y-4">
          <div className="space-y-1.5">
            <Label>Patient</Label>
            <PatientPicker value={patient} onChange={setPatient} autoFocus={!defaultPatient} />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Date</Label>
              <Input
                type="date"
                value={appointmentDate}
                onChange={(e) => setAppointmentDate(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Start time</Label>
              <Input
                type="time"
                step={APPOINTMENT_STEP_MIN * 60}
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Length (minutes)</Label>
              <Input
                type="number"
                min={APPOINTMENT_STEP_MIN}
                max={540}
                step={APPOINTMENT_STEP_MIN}
                value={minutes}
                onChange={(e) => setMinutes(normalizeDuration(parseInt(e.target.value, 10)))}
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="min-w-0 space-y-1.5">
              <Label>Operatory</Label>
              <Select
                value={operatoryNum}
                onChange={(e) => setOperatoryNum(parseInt(e.target.value))}
              >
                {operatories.map((op) => (
                  <option key={op.operatoryNum} value={op.operatoryNum}>
                    {op.abbrev || op.opName}
                  </option>
                ))}
              </Select>
            </div>
            <div className="min-w-0 space-y-1.5">
              <Label>Provider</Label>
              <Select value={provNum} onChange={(e) => setProvNum(parseInt(e.target.value))}>
                <option value={0}>Auto (default)</option>
                {providers.map((p) => (
                  <option key={p.provNum} value={p.provNum}>
                    {p.abbr} ({p.lName})
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="min-w-0 space-y-1.5">
              <Label>Appointment type</Label>
              <Select
                value={apptTypeNum}
                onChange={(e) => handleTypeChange(parseInt(e.target.value))}
              >
                <option value={0}>None</option>
                {appointmentTypes.map((t) => (
                  <option key={t.appointmentTypeNum} value={t.appointmentTypeNum}>
                    {t.appointmentTypeName}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex min-w-0 flex-wrap items-end gap-x-4 gap-y-2 pb-1.5">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={isNewPatient}
                  onChange={(e) => setIsNewPatient(e.target.checked)}
                  className="h-4 w-4 accent-primary"
                />
                New patient
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={isHygiene}
                  onChange={(e) => setIsHygiene(e.target.checked)}
                  className="h-4 w-4 accent-primary"
                />
                Hygiene
              </label>
            </div>
          </div>

          {tpProcedures.length > 0 && (
            <div className="space-y-1.5">
              <Label>Attach treatment-planned procedures</Label>
              <div className="max-h-36 space-y-1 overflow-y-auto rounded-md border p-2">
                {tpProcedures.map((p) => (
                  <label
                    key={p.procNum}
                    className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-start gap-x-2 gap-y-0.5 rounded px-1 py-1 text-sm hover:bg-muted sm:grid-cols-[auto_minmax(0,1fr)_auto]"
                  >
                    <input
                      type="checkbox"
                      className="mt-0.5 h-4 w-4 accent-primary"
                      checked={selectedProcs.has(p.procNum)}
                      onChange={(e) => {
                        const next = new Set(selectedProcs);
                        if (e.target.checked) next.add(p.procNum);
                        else next.delete(p.procNum);
                        setSelectedProcs(next);
                      }}
                    />
                    <span className="min-w-0">
                      <span className="flex min-w-0 flex-wrap items-baseline gap-x-2">
                        <span className="shrink-0 font-mono text-xs">{p.procCode}</span>
                        <span className="min-w-0 flex-1 truncate">{p.descript}</span>
                      </span>
                      {p.toothNum && <span className="block text-xs text-muted-foreground">#{p.toothNum}</span>}
                    </span>
                    <span className="col-start-2 text-xs text-muted-foreground sm:col-start-auto sm:text-right">
                      {fmtMoney(p.procFee)}
                    </span>
                  </label>
                ))}
              </div>
              {selectedProcs.size > 0 && (
                <p className="text-xs text-muted-foreground">
                  {selectedProcs.size} selected - {fmtMoney(procFeeTotal)}
                </p>
              )}
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Note</Label>
            <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={saving}>
            {saving ? "Booking..." : "Book Appointment"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
