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
import { Select, Label } from "@/components/ui/select";
import { PatientDetail, patientApi } from "@/lib/api";

interface EditPatientDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patient: PatientDetail;
  onSaved: () => void;
}

export function EditPatientDialog({ open, onOpenChange, patient, onSaved }: EditPatientDialogProps) {
  const [form, setForm] = useState({
    lName: "",
    fName: "",
    preferred: "",
    birthdate: "",
    wirelessPhone: "",
    hmPhone: "",
    wkPhone: "",
    email: "",
    address: "",
    address2: "",
    city: "",
    state: "",
    zip: "",
    patStatus: 0,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setForm({
      lName: patient.lName ?? "",
      fName: patient.fName ?? "",
      preferred: patient.preferred ?? "",
      birthdate: patient.birthdate ? patient.birthdate.substring(0, 10) : "",
      wirelessPhone: patient.wirelessPhone ?? "",
      hmPhone: patient.hmPhone ?? "",
      wkPhone: patient.wkPhone ?? "",
      email: patient.email ?? "",
      address: patient.address ?? "",
      address2: patient.address2 ?? "",
      city: patient.city ?? "",
      state: patient.state ?? "",
      zip: patient.zip ?? "",
      patStatus: patient.patStatus,
    });
    setError("");
  }, [open, patient]);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm({ ...form, [k]: e.target.value });

  const submit = async () => {
    setSaving(true);
    setError("");
    try {
      await patientApi.update(patient.patNum, {
        lName: form.lName,
        fName: form.fName,
        preferred: form.preferred,
        birthdate: form.birthdate || undefined,
        wirelessPhone: form.wirelessPhone,
        hmPhone: form.hmPhone,
        wkPhone: form.wkPhone,
        email: form.email,
        address: form.address,
        address2: form.address2,
        city: form.city,
        state: form.state,
        zip: form.zip,
        patStatus: Number(form.patStatus),
      });
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
          <DialogTitle>Edit Patient</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Last name</Label>
            <Input value={form.lName} onChange={set("lName")} />
          </div>
          <div className="space-y-1.5">
            <Label>First name</Label>
            <Input value={form.fName} onChange={set("fName")} />
          </div>
          <div className="space-y-1.5">
            <Label>Preferred</Label>
            <Input value={form.preferred} onChange={set("preferred")} />
          </div>
          <div className="space-y-1.5">
            <Label>Birthdate</Label>
            <Input type="date" value={form.birthdate} onChange={set("birthdate")} />
          </div>
          <div className="space-y-1.5">
            <Label>Mobile phone</Label>
            <Input value={form.wirelessPhone} onChange={set("wirelessPhone")} />
          </div>
          <div className="space-y-1.5">
            <Label>Home phone</Label>
            <Input value={form.hmPhone} onChange={set("hmPhone")} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Email</Label>
            <Input value={form.email} onChange={set("email")} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Address</Label>
            <Input value={form.address} onChange={set("address")} />
          </div>
          <div className="space-y-1.5">
            <Label>City</Label>
            <Input value={form.city} onChange={set("city")} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label>Prov / State</Label>
              <Input value={form.state} onChange={set("state")} />
            </div>
            <div className="space-y-1.5">
              <Label>Postal</Label>
              <Input value={form.zip} onChange={set("zip")} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select value={form.patStatus} onChange={set("patStatus")}>
              <option value={0}>Patient</option>
              <option value={1}>Non-Patient</option>
              <option value={2}>Inactive</option>
              <option value={3}>Archived</option>
              <option value={5}>Prospective</option>
            </Select>
          </div>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={saving}>
            {saving ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
