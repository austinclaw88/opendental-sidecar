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

interface NewAppointmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  operatories: Operatory[];
  providers: Provider[];
  appointmentTypes: AppointmentType[];
  /** Prefill when the dialog is opened by clicking an empty schedule slot. */
  defaultDateTime?: string; // "yyyy-MM-ddTHH:mm"
  defaultOperatoryNum?: number;
  /** Prefill when booking from a patient page or recall list. */
  defaultPatient?: PatientSummary | null;
  /** When booking from the recall list, the recall row to mark as scheduled. */
  recallNum?: number;
  onBooked: () => void;
}

export function NewAppointmentDialog({
  open,
  onOpenChange,
  operatories,
  providers,
  appointmentTypes,
  defaultDateTime,
  defaultOperatoryNum,
  defaultPatient,
  recallNum,
  onBooked,
}: NewAppointmentDialogProps) {
  const [patient, setPatient] = useState<PatientSummary | null>(null);
  const [dateTime, setDateTime] = useState("");
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
    setPatient(defaultPatient ?? null);
    setDateTime(defaultDateTime ?? "");
    setMinutes(60);
    setOperatoryNum(defaultOperatoryNum ?? operatories[0]?.operatoryNum ?? 0);
    setProvNum(0);
    setApptTypeNum(0);
    setIsNewPatient(false);
    setIsHygiene(false);
    setNote("");
    setSelectedProcs(new Set());
    setError("");
  }, [open, defaultDateTime, defaultOperatoryNum, defaultPatient, operatories]);

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
    if (t?.pattern) setMinutes(t.pattern.length * 5);
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
    if (!dateTime) return setError("Pick a date and time.");
    if (!operatoryNum) return setError("Pick an operatory.");
    setSaving(true);
    setError("");
    try {
      const selected = tpProcedures.filter((p) => selectedProcs.has(p.procNum));
      await appointmentApi.create({
        patNum: patient.patNum,
        aptDateTime: dateTime,
        minutes,
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
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>New Appointment</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Patient</Label>
            <PatientPicker value={patient} onChange={setPatient} autoFocus={!defaultPatient} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Date and time</Label>
              <Input
                type="datetime-local"
                value={dateTime}
                onChange={(e) => setDateTime(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Length (minutes)</Label>
              <Input
                type="number"
                min={5}
                max={540}
                step={5}
                value={minutes}
                onChange={(e) => setMinutes(parseInt(e.target.value) || 60)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
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
            <div className="space-y-1.5">
              <Label>Provider</Label>
              <Select value={provNum} onChange={(e) => setProvNum(parseInt(e.target.value))}>
                <option value={0}>Auto (operatory / patient default)</option>
                {providers.map((p) => (
                  <option key={p.provNum} value={p.provNum}>
                    {p.abbr} ({p.lName})
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
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
            <div className="flex items-end gap-4 pb-1.5">
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
                  <label key={p.procNum} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-primary"
                      checked={selectedProcs.has(p.procNum)}
                      onChange={(e) => {
                        const next = new Set(selectedProcs);
                        if (e.target.checked) next.add(p.procNum);
                        else next.delete(p.procNum);
                        setSelectedProcs(next);
                      }}
                    />
                    <span className="font-mono text-xs">{p.procCode}</span>
                    <span className="flex-1 truncate">{p.descript}</span>
                    {p.toothNum && <span className="text-xs text-muted-foreground">#{p.toothNum}</span>}
                    <span className="text-xs text-muted-foreground">{fmtMoney(p.procFee)}</span>
                  </label>
                ))}
              </div>
              {selectedProcs.size > 0 && (
                <p className="text-xs text-muted-foreground">
                  {selectedProcs.size} selected · {fmtMoney(procFeeTotal)}
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
