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
import { Textarea } from "@/components/ui/textarea";
import { Select, Label } from "@/components/ui/select";
import { Definition, commlogApi, referenceApi } from "@/lib/api";

interface AddCommlogDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patNum: number;
  onSaved: () => void;
}

const MODES = [
  { value: 3, label: "Phone" },
  { value: 5, label: "Text" },
  { value: 1, label: "Email" },
  { value: 4, label: "In person" },
  { value: 2, label: "Mail" },
  { value: 0, label: "Other" },
];

export function AddCommlogDialog({ open, onOpenChange, patNum, onSaved }: AddCommlogDialogProps) {
  const [types, setTypes] = useState<Definition[]>([]);
  const [commType, setCommType] = useState(0);
  const [mode, setMode] = useState(3);
  const [sentOrReceived, setSentOrReceived] = useState(1);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    referenceApi.getCommlogTypes().then(setTypes).catch(() => {});
  }, []);

  useEffect(() => {
    if (!open) return;
    setNote("");
    setMode(3);
    setSentOrReceived(1);
    setError("");
  }, [open]);

  const submit = async () => {
    if (!note.trim()) return setError("Write a note first.");
    setSaving(true);
    setError("");
    try {
      await commlogApi.create({
        patNum,
        note: note.trim(),
        commType: commType || undefined,
        mode,
        sentOrReceived,
      });
      onOpenChange(false);
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save commlog.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>New Comm Log Entry</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Mode</Label>
              <Select value={mode} onChange={(e) => setMode(parseInt(e.target.value))}>
                {MODES.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Direction</Label>
              <Select
                value={sentOrReceived}
                onChange={(e) => setSentOrReceived(parseInt(e.target.value))}
              >
                <option value={1}>We contacted them</option>
                <option value={2}>They contacted us</option>
                <option value={0}>Unknown</option>
              </Select>
            </div>
          </div>
          {types.length > 0 && (
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select value={commType} onChange={(e) => setCommType(parseInt(e.target.value))}>
                <option value={0}>None</option>
                {types.map((t) => (
                  <option key={t.defNum} value={t.defNum}>
                    {t.itemName}
                  </option>
                ))}
              </Select>
            </div>
          )}
          <div className="space-y-1.5">
            <Label>Note</Label>
            <Textarea
              rows={4}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Called to confirm Tuesday's hygiene visit. Left voicemail."
              autoFocus
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={saving}>
            {saving ? "Saving..." : "Save Entry"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
