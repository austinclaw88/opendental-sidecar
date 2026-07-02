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
  Definition,
  PatientDetail,
  Provider,
  patientApi,
  referenceApi,
} from "@/lib/api";

interface EditPatientDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patient: PatientDetail;
  onSaved: () => void;
}

const EMPTY = {
  lName: "",
  fName: "",
  middleI: "",
  preferred: "",
  birthdate: "",
  gender: 0,
  wirelessPhone: "",
  hmPhone: "",
  wkPhone: "",
  email: "",
  preferContactMethod: 0,
  txtMsgOk: 0,
  address: "",
  address2: "",
  city: "",
  state: "",
  zip: "",
  patStatus: 0,
  chartNumber: "",
  priProv: 0,
  billingType: 0,
  apptModNote: "",
  medUrgNote: "",
  famFinUrgNote: "",
};

export function EditPatientDialog({ open, onOpenChange, patient, onSaved }: EditPatientDialogProps) {
  const [form, setForm] = useState({ ...EMPTY });
  const [providers, setProviders] = useState<Provider[]>([]);
  const [billingTypes, setBillingTypes] = useState<Definition[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setForm({
      lName: patient.lName ?? "",
      fName: patient.fName ?? "",
      middleI: patient.middleI ?? "",
      preferred: patient.preferred ?? "",
      birthdate: patient.birthdate ? patient.birthdate.substring(0, 10) : "",
      gender: patient.gender ?? 0,
      wirelessPhone: patient.wirelessPhone ?? "",
      hmPhone: patient.hmPhone ?? "",
      wkPhone: patient.wkPhone ?? "",
      email: patient.email ?? "",
      preferContactMethod: patient.preferContactMethod ?? 0,
      txtMsgOk: patient.txtMsgOk ?? 0,
      address: patient.address ?? "",
      address2: patient.address2 ?? "",
      city: patient.city ?? "",
      state: patient.state ?? "",
      zip: patient.zip ?? "",
      patStatus: patient.patStatus,
      chartNumber: patient.chartNumber ?? "",
      priProv: patient.preferredProvider ?? 0,
      billingType: patient.billingType ?? 0,
      apptModNote: patient.apptModNote ?? "",
      medUrgNote: patient.medUrgNote ?? "",
      famFinUrgNote: patient.famFinUrgNote ?? "",
    });
    setError("");
  }, [open, patient]);

  useEffect(() => {
    if (!open) return;
    if (providers.length === 0) referenceApi.getProviders().then(setProviders).catch(() => {});
    if (billingTypes.length === 0) referenceApi.getBillingTypes().then(setBillingTypes).catch(() => {});
  }, [open, providers.length, billingTypes.length]);

  const set =
    (k: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async () => {
    setSaving(true);
    setError("");
    try {
      await patientApi.update(patient.patNum, {
        lName: form.lName,
        fName: form.fName,
        middleI: form.middleI,
        preferred: form.preferred,
        birthdate: form.birthdate || undefined,
        gender: Number(form.gender),
        wirelessPhone: form.wirelessPhone,
        hmPhone: form.hmPhone,
        wkPhone: form.wkPhone,
        email: form.email,
        preferContactMethod: Number(form.preferContactMethod),
        txtMsgOk: Number(form.txtMsgOk),
        address: form.address,
        address2: form.address2,
        city: form.city,
        state: form.state,
        zip: form.zip,
        patStatus: Number(form.patStatus),
        chartNumber: form.chartNumber,
        priProv: Number(form.priProv) || undefined,
        billingType: Number(form.billingType) || undefined,
        apptModNote: form.apptModNote,
        medUrgNote: form.medUrgNote,
        famFinUrgNote: form.famFinUrgNote,
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
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Patient</DialogTitle>
        </DialogHeader>

        {/* Identity */}
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Last name</Label>
            <Input value={form.lName} onChange={set("lName")} />
          </div>
          <div className="space-y-1.5">
            <Label>First name</Label>
            <Input value={form.fName} onChange={set("fName")} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label>Middle</Label>
              <Input value={form.middleI} onChange={set("middleI")} />
            </div>
            <div className="space-y-1.5">
              <Label>Preferred</Label>
              <Input value={form.preferred} onChange={set("preferred")} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label>Birthdate</Label>
              <Input type="date" value={form.birthdate} onChange={set("birthdate")} />
            </div>
            <div className="space-y-1.5">
              <Label>Gender</Label>
              <Select value={form.gender} onChange={set("gender")}>
                <option value={0}>Male</option>
                <option value={1}>Female</option>
                <option value={2}>Unknown</option>
              </Select>
            </div>
          </div>
        </div>

        {/* Contact */}
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Mobile phone</Label>
            <Input value={form.wirelessPhone} onChange={set("wirelessPhone")} />
          </div>
          <div className="space-y-1.5">
            <Label>Home phone</Label>
            <Input value={form.hmPhone} onChange={set("hmPhone")} />
          </div>
          <div className="space-y-1.5">
            <Label>Work phone</Label>
            <Input value={form.wkPhone} onChange={set("wkPhone")} />
          </div>
          <div className="space-y-1.5">
            <Label>Email</Label>
            <Input value={form.email} onChange={set("email")} />
          </div>
          <div className="space-y-1.5">
            <Label>Preferred contact</Label>
            <Select value={form.preferContactMethod} onChange={set("preferContactMethod")}>
              <option value={0}>None</option>
              <option value={2}>Home phone</option>
              <option value={3}>Work phone</option>
              <option value={4}>Mobile</option>
              <option value={5}>Email</option>
              <option value={8}>Text message</option>
              <option value={6}>See notes</option>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Text messaging</Label>
            <Select value={form.txtMsgOk} onChange={set("txtMsgOk")}>
              <option value={0}>Unknown / default</option>
              <option value={1}>OK to text</option>
              <option value={2}>Do not text</option>
            </Select>
          </div>
        </div>

        {/* Address */}
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Address</Label>
            <Input value={form.address} onChange={set("address")} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Address line 2</Label>
            <Input value={form.address2} onChange={set("address2")} />
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
        </div>

        {/* Admin */}
        <div className="grid gap-3 sm:grid-cols-2">
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
          <div className="space-y-1.5">
            <Label>Chart number</Label>
            <Input value={form.chartNumber} onChange={set("chartNumber")} />
          </div>
          <div className="space-y-1.5">
            <Label>Primary provider</Label>
            <Select value={form.priProv} onChange={set("priProv")}>
              <option value={0}>None</option>
              {providers
                .filter((p) => !p.isHidden)
                .map((p) => (
                  <option key={p.provNum} value={p.provNum}>
                    {p.abbr || `${p.lName}, ${p.fName}`}
                  </option>
                ))}
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Billing type</Label>
            <Select value={form.billingType} onChange={set("billingType")}>
              <option value={0}>None</option>
              {billingTypes.map((b) => (
                <option key={b.defNum} value={b.defNum}>
                  {b.itemName}
                </option>
              ))}
            </Select>
          </div>
        </div>

        {/* Notes */}
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Appointment note</Label>
            <Textarea rows={2} value={form.apptModNote} onChange={set("apptModNote")} />
          </div>
          <div className="space-y-1.5">
            <Label>Medical / urgent note</Label>
            <Textarea rows={2} value={form.medUrgNote} onChange={set("medUrgNote")} />
          </div>
          <div className="space-y-1.5">
            <Label>Financial / urgent note</Label>
            <Textarea rows={2} value={form.famFinUrgNote} onChange={set("famFinUrgNote")} />
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
