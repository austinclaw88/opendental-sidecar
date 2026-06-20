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
import { Definition, paymentApi, referenceApi } from "@/lib/api";
import { toDateInput } from "@/lib/format";

interface TakePaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patNum: number;
  patientName: string;
  suggestedAmount?: number;
  onSaved: () => void;
}

export function TakePaymentDialog({
  open,
  onOpenChange,
  patNum,
  patientName,
  suggestedAmount,
  onSaved,
}: TakePaymentDialogProps) {
  const [payTypes, setPayTypes] = useState<Definition[]>([]);
  const [amount, setAmount] = useState("");
  const [payType, setPayType] = useState(0);
  const [payDate, setPayDate] = useState(() => toDateInput(new Date()));
  const [checkNum, setCheckNum] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    referenceApi.getPaymentTypes().then((t) => {
      setPayTypes(t);
      if (t.length > 0) setPayType((prev) => prev || t[0].defNum);
    });
  }, []);

  useEffect(() => {
    if (!open) return;
    setAmount(suggestedAmount && suggestedAmount > 0 ? suggestedAmount.toFixed(2) : "");
    setPayDate(toDateInput(new Date()));
    setCheckNum("");
    setNote("");
    setError("");
  }, [open, suggestedAmount]);

  const submit = async () => {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) return setError("Enter a payment amount.");
    if (!payType) return setError("Pick a payment type.");
    setSaving(true);
    setError("");
    try {
      await paymentApi.create({
        patNum,
        payAmt: amt,
        payType,
        payDate,
        checkNum: checkNum || undefined,
        payNote: note || undefined,
      });
      onOpenChange(false);
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Payment failed.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Take Payment</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">From {patientName}</p>
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
              <Label>Date</Label>
              <Input type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Payment type</Label>
            <Select value={payType} onChange={(e) => setPayType(parseInt(e.target.value))}>
              {payTypes.map((t) => (
                <option key={t.defNum} value={t.defNum}>
                  {t.itemName}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Check / reference number</Label>
            <Input value={checkNum} onChange={(e) => setCheckNum(e.target.value)} />
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
            {saving ? "Posting..." : "Post Payment"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
