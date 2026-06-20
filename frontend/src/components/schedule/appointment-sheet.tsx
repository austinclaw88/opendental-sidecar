"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, Label } from "@/components/ui/select";
import {
  AppointmentDetail,
  Definition,
  Operatory,
  Provider,
  appointmentApi,
} from "@/lib/api";
import { argbToHex, fmtDateTime, fmtMoney, fmtTime } from "@/lib/format";
import {
  CalendarClock,
  CheckCircle2,
  DoorOpen,
  LogOut,
  Phone,
  UserRound,
  XCircle,
  Zap,
} from "lucide-react";

interface AppointmentSheetProps {
  aptNum: number | null;
  onOpenChange: (open: boolean) => void;
  confirmationStatuses: Definition[];
  operatories: Operatory[];
  providers: Provider[];
  onChanged: () => void;
}

export function AppointmentSheet({
  aptNum,
  onOpenChange,
  confirmationStatuses,
  operatories,
  providers,
  onChanged,
}: AppointmentSheetProps) {
  const [apt, setApt] = useState<AppointmentDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(false);
  const [breaking, setBreaking] = useState<3 | 5 | null>(null);
  const [breakReason, setBreakReason] = useState("");

  // Edit form state
  const [editDateTime, setEditDateTime] = useState("");
  const [editMinutes, setEditMinutes] = useState(60);
  const [editOp, setEditOp] = useState(0);
  const [editProv, setEditProv] = useState(0);
  const [editNote, setEditNote] = useState("");

  const reload = () => {
    if (!aptNum) return;
    setLoading(true);
    appointmentApi
      .getDetail(aptNum)
      .then(setApt)
      .catch(() => setApt(null))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    setApt(null);
    setEditing(false);
    setBreaking(null);
    setBreakReason("");
    setError("");
    if (aptNum) reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aptNum]);

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError("");
    try {
      await fn();
      reload();
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed.");
    } finally {
      setBusy(false);
    }
  };

  const startEdit = () => {
    if (!apt) return;
    const d = new Date(apt.aptDateTime);
    const pad = (n: number) => `${n}`.padStart(2, "0");
    setEditDateTime(
      `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
    );
    setEditMinutes(apt.minutes);
    setEditOp(apt.operatoryNum);
    setEditProv(apt.provNum ?? 0);
    setEditNote(apt.note ?? "");
    setEditing(true);
  };

  const saveEdit = () =>
    run(async () => {
      if (!apt) return;
      await appointmentApi.update(apt.aptNum, {
        aptDateTime: editDateTime,
        minutes: editMinutes,
        operatoryNum: editOp,
        provNum: editProv || undefined,
        note: editNote,
      });
      setEditing(false);
    });

  const flowButton = (
    milestone: "arrived" | "seated" | "dismissed",
    stamped: string | undefined,
    icon: React.ReactNode,
    label: string
  ) => {
    const isSet = stamped && new Date(stamped).getFullYear() > 1;
    return (
      <Button
        variant={isSet ? "secondary" : "outline"}
        size="sm"
        disabled={busy}
        onClick={() => run(() => appointmentApi.setFlowTime(apt!.aptNum, milestone, !!isSet))}
        className="flex-1"
      >
        {icon}
        <span className="ml-1.5">{isSet ? `${label} ${fmtTime(stamped)}` : label}</span>
      </Button>
    );
  };

  return (
    <Sheet open={aptNum != null} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        {loading && <p className="py-10 text-center text-sm text-muted-foreground">Loading...</p>}
        {!loading && apt && (
          <>
            <SheetHeader>
              <SheetTitle className="flex items-center gap-2">
                <UserRound className="h-5 w-5 text-primary" />
                <Link href={`/patients/${apt.patNum}`} className="hover:underline">
                  {apt.patientName}
                </Link>
              </SheetTitle>
            </SheetHeader>

            <div className="space-y-4 px-4 pb-6">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">{apt.aptStatusDesc}</Badge>
                {apt.confirmedDesc && (
                  <Badge
                    variant="outline"
                    style={{ borderColor: argbToHex(apt.confirmedColor), color: argbToHex(apt.confirmedColor) }}
                  >
                    {apt.confirmedDesc}
                  </Badge>
                )}
                {apt.isNewPatient && <Badge>New Patient</Badge>}
                {apt.isHygiene && <Badge variant="secondary">Hygiene</Badge>}
              </div>

              <div className="space-y-1 text-sm">
                <p className="flex items-center gap-2">
                  <CalendarClock className="h-4 w-4 text-muted-foreground" />
                  {fmtDateTime(apt.aptDateTime)} · {apt.minutes} min
                </p>
                <p className="text-muted-foreground">
                  Op {operatories.find((o) => o.operatoryNum === apt.operatoryNum)?.abbrev ?? apt.operatoryNum}
                  {apt.providerAbbr && ` · ${apt.providerAbbr}`}
                  {apt.appointmentTypeName && ` · ${apt.appointmentTypeName}`}
                </p>
                {apt.patientPhone && (
                  <p className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    {apt.patientPhone}
                  </p>
                )}
                {apt.procDescript && <p className="text-muted-foreground">{apt.procDescript}</p>}
                {apt.note && <p className="rounded-md bg-muted/50 p-2 text-xs">{apt.note}</p>}
              </div>

              {apt.procedures.length > 0 && (
                <div>
                  <Label>Attached procedures</Label>
                  <div className="mt-1 space-y-1">
                    {apt.procedures.map((p) => (
                      <div key={p.procNum} className="flex items-center gap-2 text-sm">
                        <span className="font-mono text-xs">{p.procCode}</span>
                        <span className="flex-1 truncate">{p.descript}</span>
                        <span className="text-xs text-muted-foreground">{fmtMoney(p.procFee)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <Separator />

              {/* Confirmation */}
              <div className="space-y-1.5">
                <Label>Confirmation status</Label>
                <Select
                  value={apt.confirmedDefNum}
                  disabled={busy}
                  onChange={(e) =>
                    run(() => appointmentApi.setConfirmation(apt.aptNum, parseInt(e.target.value)))
                  }
                >
                  {confirmationStatuses.map((d) => (
                    <option key={d.defNum} value={d.defNum}>
                      {d.itemName}
                    </option>
                  ))}
                </Select>
              </div>

              {/* Office flow */}
              <div className="space-y-1.5">
                <Label>Office flow (tap again to undo)</Label>
                <div className="flex gap-2">
                  {flowButton("arrived", apt.dateTimeArrived, <DoorOpen className="h-3.5 w-3.5" />, "Arrived")}
                  {flowButton("seated", apt.dateTimeSeated, <UserRound className="h-3.5 w-3.5" />, "Seated")}
                  {flowButton("dismissed", apt.dateTimeDismissed, <LogOut className="h-3.5 w-3.5" />, "Out")}
                </div>
              </div>

              <Separator />

              {/* Reschedule / edit */}
              {!editing ? (
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" onClick={startEdit} disabled={busy}>
                    <CalendarClock className="h-3.5 w-3.5" />
                    <span className="ml-1.5">Move / Edit</span>
                  </Button>
                  {apt.aptStatus !== 2 && (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={busy}
                      onClick={() => run(() => appointmentApi.setStatus(apt.aptNum, 2))}
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      <span className="ml-1.5">Complete</span>
                    </Button>
                  )}
                  {apt.aptStatus === 1 && (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={busy}
                        onClick={() => {
                          setBreaking(5);
                          setBreakReason("");
                        }}
                      >
                        <XCircle className="h-3.5 w-3.5" />
                        <span className="ml-1.5">Broken</span>
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={busy}
                        onClick={() => {
                          setBreaking(3);
                          setBreakReason("");
                        }}
                      >
                        <span>Send to Unscheduled</span>
                      </Button>
                    </>
                  )}
                  {(apt.aptStatus === 3 || apt.aptStatus === 5) && (
                    <Button
                      size="sm"
                      disabled={busy}
                      onClick={() => run(() => appointmentApi.setStatus(apt.aptNum, 1))}
                    >
                      Restore to Scheduled
                    </Button>
                  )}
                  <Button
                    variant={apt.priority === 1 ? "secondary" : "outline"}
                    size="sm"
                    disabled={busy}
                    title={apt.priority === 1 ? "Remove from ASAP list" : "Flag for the ASAP list"}
                    onClick={() => run(() => appointmentApi.setPriority(apt.aptNum, apt.priority === 1 ? 0 : 1))}
                  >
                    <Zap className="h-3.5 w-3.5" />
                    <span className="ml-1.5">{apt.priority === 1 ? "ASAP ✓" : "ASAP"}</span>
                  </Button>
                  {breaking !== null && (
                    <div className="w-full space-y-2 rounded-md border bg-muted/30 p-3">
                      <Label>
                        {breaking === 5 ? "Reason for breaking" : "Reason for unscheduling"} (logged to comm log)
                      </Label>
                      <Textarea
                        rows={2}
                        placeholder="e.g. Patient called to cancel — sick. Wants to rebook next week."
                        value={breakReason}
                        onChange={(e) => setBreakReason(e.target.value)}
                        autoFocus
                      />
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" size="sm" onClick={() => setBreaking(null)}>
                          Cancel
                        </Button>
                        <Button
                          size="sm"
                          disabled={busy}
                          onClick={() =>
                            run(async () => {
                              await appointmentApi.setStatus(apt.aptNum, breaking, breakReason || undefined);
                              setBreaking(null);
                            })
                          }
                        >
                          {breaking === 5 ? "Mark Broken" : "Unschedule"}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-3 rounded-md border p-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label>Date and time</Label>
                      <Input
                        type="datetime-local"
                        value={editDateTime}
                        onChange={(e) => setEditDateTime(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Minutes</Label>
                      <Input
                        type="number"
                        min={5}
                        max={540}
                        step={5}
                        value={editMinutes}
                        onChange={(e) => setEditMinutes(parseInt(e.target.value) || 60)}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label>Operatory</Label>
                      <Select value={editOp} onChange={(e) => setEditOp(parseInt(e.target.value))}>
                        {operatories.map((o) => (
                          <option key={o.operatoryNum} value={o.operatoryNum}>
                            {o.abbrev || o.opName}
                          </option>
                        ))}
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Provider</Label>
                      <Select value={editProv} onChange={(e) => setEditProv(parseInt(e.target.value))}>
                        <option value={0}>Keep current</option>
                        {providers.map((p) => (
                          <option key={p.provNum} value={p.provNum}>
                            {p.abbr}
                          </option>
                        ))}
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Note</Label>
                    <Textarea rows={2} value={editNote} onChange={(e) => setEditNote(e.target.value)} />
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" size="sm" onClick={() => setEditing(false)}>
                      Cancel
                    </Button>
                    <Button size="sm" onClick={saveEdit} disabled={busy}>
                      {busy ? "Saving..." : "Save"}
                    </Button>
                  </div>
                </div>
              )}

              {error && <p className="text-sm text-destructive">{error}</p>}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
