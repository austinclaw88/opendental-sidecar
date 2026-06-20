"use client";

import { useEffect, useState } from "react";
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
import {
  Carrier,
  FamilyMember,
  InsuranceCoverage,
  insuranceApi,
} from "@/lib/api";

const RELATIONSHIPS: { value: number; label: string }[] = [
  { value: 0, label: "Self" },
  { value: 1, label: "Spouse" },
  { value: 2, label: "Child" },
  { value: 4, label: "Handicap Dep" },
  { value: 5, label: "Signif Other" },
  { value: 7, label: "Life Partner" },
  { value: 8, label: "Dependent" },
];

interface InsuranceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patNum: number;
  patientName: string;
  family: FamilyMember[];
  /** When set, the dialog edits this coverage instead of adding a new one. */
  editing?: InsuranceCoverage | null;
  onSaved: () => void;
}

export function InsuranceDialog({
  open,
  onOpenChange,
  patNum,
  patientName,
  family,
  editing,
  onSaved,
}: InsuranceDialogProps) {
  // Carrier search (add mode only)
  const [carrierQuery, setCarrierQuery] = useState("");
  const [carrierResults, setCarrierResults] = useState<Carrier[]>([]);
  const [carrierNum, setCarrierNum] = useState<number | null>(null);
  const [electId, setElectId] = useState("");
  const [carrierPhone, setCarrierPhone] = useState("");

  const [groupName, setGroupName] = useState("");
  const [groupNum, setGroupNum] = useState("");
  const [subscriberPatNum, setSubscriberPatNum] = useState(patNum);
  const [subscriberId, setSubscriberId] = useState("");
  const [relationship, setRelationship] = useState(0);
  const [ordinal, setOrdinal] = useState<number>(0);
  const [dateEffective, setDateEffective] = useState("");
  const [dateTerm, setDateTerm] = useState("");
  const [subscNote, setSubscNote] = useState("");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const isEdit = !!editing;

  // Reset form each time the dialog opens.
  useEffect(() => {
    if (!open) return;
    setCarrierQuery(editing?.carrierName ?? "");
    setCarrierResults([]);
    setCarrierNum(editing?.carrierNum ?? null);
    setElectId(editing?.electId ?? "");
    setCarrierPhone(editing?.carrierPhone ?? "");
    setGroupName(editing?.groupName ?? "");
    setGroupNum(editing?.groupNum ?? "");
    setSubscriberPatNum(editing?.subscriberPatNum ?? patNum);
    setSubscriberId(editing?.subscriberId ?? "");
    setRelationship(editing?.relationship ?? 0);
    setOrdinal(editing?.ordinal ?? 0);
    setDateEffective("");
    setDateTerm(editing?.dateTerm ? editing.dateTerm.slice(0, 10) : "");
    setSubscNote(editing?.subscNote ?? "");
    setError("");
  }, [open, editing, patNum]);

  // Carrier typeahead (add mode only).
  useEffect(() => {
    if (!open || isEdit) return;
    const q = carrierQuery.trim();
    if (q.length < 2) {
      setCarrierResults([]);
      return;
    }
    const t = setTimeout(() => {
      insuranceApi
        .searchCarriers(q)
        .then(setCarrierResults)
        .catch(() => setCarrierResults([]));
    }, 250);
    return () => clearTimeout(t);
  }, [carrierQuery, open, isEdit]);

  const submit = async () => {
    setError("");
    setSaving(true);
    try {
      if (isEdit && editing) {
        await insuranceApi.updateCoverage(editing.patPlanNum, {
          ordinal: ordinal > 0 ? ordinal : undefined,
          relationship,
          subscriberId,
          dateTerm: dateTerm || undefined,
          subscNote,
        });
      } else {
        if (!carrierNum && carrierQuery.trim().length === 0) {
          setError("Pick or type a carrier name.");
          setSaving(false);
          return;
        }
        await insuranceApi.addCoverage(patNum, {
          carrierNum: carrierNum ?? undefined,
          carrierName: carrierNum ? undefined : carrierQuery.trim(),
          carrierPhone: carrierPhone || undefined,
          electId: electId || undefined,
          groupName: groupName || undefined,
          groupNum: groupNum || undefined,
          subscriberPatNum,
          subscriberId: subscriberId || undefined,
          dateEffective: dateEffective || undefined,
          subscNote: subscNote || undefined,
          relationship,
          ordinal: ordinal > 0 ? ordinal : undefined,
        });
      }
      onOpenChange(false);
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Insurance" : "Add Insurance"}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">For {patientName}</p>

        <div className="space-y-3">
          {/* Carrier */}
          <div className="space-y-1.5">
            <Label>Carrier</Label>
            {isEdit ? (
              <Input value={carrierQuery} disabled />
            ) : (
              <div className="relative">
                <Input
                  placeholder="Search or type a new carrier name..."
                  value={carrierQuery}
                  onChange={(e) => {
                    setCarrierQuery(e.target.value);
                    setCarrierNum(null);
                  }}
                  autoFocus
                />
                {carrierResults.length > 0 && carrierNum === null && (
                  <div className="absolute z-10 mt-1 w-full rounded-md border bg-popover shadow-md">
                    {carrierResults.slice(0, 8).map((c) => (
                      <button
                        key={c.carrierNum}
                        type="button"
                        className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-muted"
                        onClick={() => {
                          setCarrierNum(c.carrierNum);
                          setCarrierQuery(c.carrierName);
                          setCarrierResults([]);
                          if (c.electId) setElectId(c.electId);
                        }}
                      >
                        <span>{c.carrierName}</span>
                        {c.electId && (
                          <span className="text-xs text-muted-foreground">#{c.electId}</span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {carrierNum
                    ? "Using existing carrier."
                    : carrierQuery.trim().length >= 2
                      ? "No match selected — a new carrier will be created with this name."
                      : ""}
                </p>
              </div>
            )}
          </div>

          {!isEdit && carrierNum === null && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Carrier ID (CDAnet / payer ID)</Label>
                <Input value={electId} onChange={(e) => setElectId(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Carrier phone</Label>
                <Input value={carrierPhone} onChange={(e) => setCarrierPhone(e.target.value)} />
              </div>
            </div>
          )}

          {/* Plan */}
          {!isEdit && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Group name (employer)</Label>
                <Input value={groupName} onChange={(e) => setGroupName(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Group / policy number</Label>
                <Input value={groupNum} onChange={(e) => setGroupNum(e.target.value)} />
              </div>
            </div>
          )}

          {/* Subscriber */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Subscriber</Label>
              {isEdit ? (
                <Input value={editing?.subscriberName ?? ""} disabled />
              ) : (
                <Select
                  value={subscriberPatNum}
                  onChange={(e) => setSubscriberPatNum(parseInt(e.target.value))}
                >
                  {family.map((m) => (
                    <option key={m.patNum} value={m.patNum}>
                      {m.name}
                      {m.patNum === patNum ? " (this patient)" : ""}
                    </option>
                  ))}
                </Select>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Subscriber / member ID</Label>
              <Input value={subscriberId} onChange={(e) => setSubscriberId(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>Relationship to subscriber</Label>
              <Select
                value={relationship}
                onChange={(e) => setRelationship(parseInt(e.target.value))}
              >
                {RELATIONSHIPS.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Order</Label>
              <Select value={ordinal} onChange={(e) => setOrdinal(parseInt(e.target.value))}>
                {!isEdit && <option value={0}>Next available</option>}
                <option value={1}>Primary</option>
                <option value={2}>Secondary</option>
                <option value={3}>Tertiary</option>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>{isEdit ? "Termination date" : "Effective date"}</Label>
              {isEdit ? (
                <Input type="date" value={dateTerm} onChange={(e) => setDateTerm(e.target.value)} />
              ) : (
                <Input
                  type="date"
                  value={dateEffective}
                  onChange={(e) => setDateEffective(e.target.value)}
                />
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Subscriber note</Label>
            <Textarea rows={2} value={subscNote} onChange={(e) => setSubscNote(e.target.value)} />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={saving}>
            {saving ? "Saving..." : isEdit ? "Save Changes" : "Add Coverage"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
