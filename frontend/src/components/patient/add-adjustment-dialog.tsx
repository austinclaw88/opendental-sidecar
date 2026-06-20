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
import { Definition, adjustmentApi, referenceApi } from "@/lib/api";
import { toDateInput } from "@/lib/format";

interface AddAdjustmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patNum: number;
  patientName: string;
  onSaved: () => void;
}

export function AddAdjustmentDialog({
  open,
  onOpenChange,
  patNum,
  patientName,
  onSaved,
}: AddAdjustmentDialogProps) {
  const [adjTypes, setAdjTypes] = useState<Definition[]>([]);
  const [amount, setAmount] = useState("");
  const [direction, setDirection] = useState<"credit" | "charge">("credit");
  const [adjType, setAdjType] = useState(0);
  const [adjDate, setAdjDate] = useState(() => toDateInput(new Date()));
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    referenceApi.getAdjustmentTypes().then((t) => {
      setAdjTypes(t);
      if (t.length > 0) setAdjType((prev) => prev || t[0].defNum);
    });
  }, []);

  useEffect(() => {
    if (!open) return;
    setAmount("");
    setDirection("credit");
    setAdjDate(toDateInput(new Date()));
    setNote("");
    setError("");
  }, [open]);

  const submit = async () => {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) return setError("Enter an adjustment amount.");
    if (!adjType) return setError("Pick an adjustment type.");
    setSaving(true);
    setError("");
    try {
      await adjustmentApi.create({
        patNum,
        adjAmt: direction === "credit" ? -amt : amt,
        adjType,
        adjDate,
        note: note || undefined,
      });
      onOpenChange(false);
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Adjustment failed.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Add Adjustment</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">For {patientName}</p>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Amount</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label>Direction</Label>
              <Select
                value={direction}
                onChange={(e) => setDirection(e.target.value as "credit" | "charge")}
              >
                <option value="credit">Credit (reduce balance)</option>
                <option value="charge">Charge (add to balance)</option>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select value={adjType} onChange={(e) => setAdjType(parseInt(e.target.value))}>
                {adjTypes.map((t) => (
                  <option key={t.defNum} value={t.defNum}>
                    {t.itemName}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Date</Label>
              <Input type="date" value={adjDate} onChange={(e) => setAdjDate(e.target.value)} />
            </div>
          </div>
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
            {saving ? "Posting..." : "Post Adjustment"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
