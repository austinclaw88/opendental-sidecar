"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, Label } from "@/components/ui/select";
import { PatientPicker } from "@/components/patient-picker";
import { Definition, PatientSummary, Provider, patientApi, referenceApi } from "@/lib/api";

const CONTACT_METHODS = [
  { value: 0, label: "No preference" },
  { value: 4, label: "Mobile phone" },
  { value: 2, label: "Home phone" },
  { value: 3, label: "Work phone" },
  { value: 5, label: "Email" },
  { value: 8, label: "Text message" },
  { value: 6, label: "See notes" },
];

export default function NewPatientPage() {
  const router = useRouter();
  const [providers, setProviders] = useState<Provider[]>([]);
  const [billingTypes, setBillingTypes] = useState<Definition[]>([]);
  const [saving, setSaving] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    lName: "",
    fName: "",
    middleI: "",
    preferred: "",
    title: "",
    birthdate: "",
    gender: 2,
    position: 0,
    ssn: "",
    chartNumber: "",
    wirelessPhone: "",
    hmPhone: "",
    wkPhone: "",
    email: "",
    txtMsgOk: 0,
    preferContactMethod: 0,
    preferConfirmMethod: 0,
    preferRecallMethod: 0,
    address: "",
    address2: "",
    city: "",
    state: "BC",
    zip: "",
    country: "Canada",
    language: "",
    priProv: 0,
    secProv: 0,
    billingType: 0,
    addrNote: "",
    medUrgNote: "",
    apptModNote: "",
  });
  const [guarantor, setGuarantor] = useState<PatientSummary | null>(null);

  useEffect(() => {
    referenceApi.getProviders().then(setProviders).catch(() => {});
    referenceApi.getBillingTypes?.().then(setBillingTypes).catch(() => {});
  }, []);

  const set =
    (k: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm({ ...form, [k]: e.target.value });

  const num = (v: string | number) => Number(v) || undefined;

  const submit = async () => {
    if (!form.lName.trim() || !form.fName.trim()) {
      setError("First and last name are required.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const result = await patientApi.create({
        lName: form.lName.trim(),
        fName: form.fName.trim(),
        middleI: form.middleI || undefined,
        preferred: form.preferred || undefined,
        title: form.title || undefined,
        birthdate: form.birthdate || undefined,
        gender: Number(form.gender),
        position: num(form.position),
        ssn: form.ssn || undefined,
        chartNumber: form.chartNumber || undefined,
        wirelessPhone: form.wirelessPhone || undefined,
        hmPhone: form.hmPhone || undefined,
        wkPhone: form.wkPhone || undefined,
        email: form.email || undefined,
        txtMsgOk: num(form.txtMsgOk),
        preferContactMethod: num(form.preferContactMethod),
        preferConfirmMethod: num(form.preferConfirmMethod),
        preferRecallMethod: num(form.preferRecallMethod),
        address: form.address || undefined,
        address2: form.address2 || undefined,
        city: form.city || undefined,
        state: form.state || undefined,
        zip: form.zip || undefined,
        country: form.country || undefined,
        language: form.language || undefined,
        priProv: num(form.priProv),
        secProv: num(form.secProv),
        billingType: num(form.billingType),
        addrNote: form.addrNote || undefined,
        medUrgNote: form.medUrgNote || undefined,
        apptModNote: form.apptModNote || undefined,
        guarantor: guarantor?.patNum,
      });
      router.push(`/patients/${result.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create patient.");
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
          <UserPlus className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">New Patient</h1>
          <p className="text-sm text-muted-foreground">Register a patient into OpenDental.</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Identity</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Last name *</Label>
            <Input value={form.lName} onChange={set("lName")} autoFocus />
          </div>
          <div className="space-y-1.5">
            <Label>First name *</Label>
            <Input value={form.fName} onChange={set("fName")} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Middle</Label>
              <Input value={form.middleI} onChange={set("middleI")} />
            </div>
            <div className="space-y-1.5">
              <Label>Title</Label>
              <Input value={form.title} onChange={set("title")} placeholder="Dr, Mr, Ms" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Preferred name</Label>
            <Input value={form.preferred} onChange={set("preferred")} />
          </div>
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
              <option value={3}>Other</option>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select value={form.position} onChange={set("position")}>
              <option value={0}>Single</option>
              <option value={1}>Married</option>
              <option value={2}>Child</option>
              <option value={3}>Widowed</option>
              <option value={4}>Divorced</option>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>SIN (optional)</Label>
            <Input value={form.ssn} onChange={set("ssn")} />
          </div>
          <div className="space-y-1.5">
            <Label>Chart number</Label>
            <Input value={form.chartNumber} onChange={set("chartNumber")} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Contact</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
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
            <Label>Text consent</Label>
            <Select value={form.txtMsgOk} onChange={set("txtMsgOk")}>
              <option value={0}>Not asked</option>
              <option value={1}>OK to text</option>
              <option value={2}>Do not text</option>
            </Select>
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Email</Label>
            <Input type="email" value={form.email} onChange={set("email")} />
          </div>
          <div className="space-y-1.5">
            <Label>Preferred contact</Label>
            <Select value={form.preferContactMethod} onChange={set("preferContactMethod")}>
              {CONTACT_METHODS.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Preferred confirm</Label>
            <Select value={form.preferConfirmMethod} onChange={set("preferConfirmMethod")}>
              {CONTACT_METHODS.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </Select>
          </div>
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
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Province</Label>
              <Input value={form.state} onChange={set("state")} />
            </div>
            <div className="space-y-1.5">
              <Label>Postal code</Label>
              <Input value={form.zip} onChange={set("zip")} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Clinical & Billing</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Primary provider</Label>
            <Select value={form.priProv} onChange={set("priProv")}>
              <option value={0}>Practice default</option>
              {providers.map((p) => (
                <option key={p.provNum} value={p.provNum}>
                  {p.abbr} ({p.lName})
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Secondary provider</Label>
            <Select value={form.secProv} onChange={set("secProv")}>
              <option value={0}>None</option>
              {providers.map((p) => (
                <option key={p.provNum} value={p.provNum}>
                  {p.abbr} ({p.lName})
                </option>
              ))}
            </Select>
          </div>
          {billingTypes.length > 0 && (
            <div className="space-y-1.5">
              <Label>Billing type</Label>
              <Select value={form.billingType} onChange={set("billingType")}>
                <option value={0}>Practice default</option>
                {billingTypes.map((b) => (
                  <option key={b.defNum} value={b.defNum}>{b.itemName}</option>
                ))}
              </Select>
            </div>
          )}
          <div className="space-y-1.5">
            <Label>Preferred recall method</Label>
            <Select value={form.preferRecallMethod} onChange={set("preferRecallMethod")}>
              {CONTACT_METHODS.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </Select>
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Medical alert / urgent note</Label>
            <Textarea rows={2} value={form.medUrgNote} onChange={set("medUrgNote")} />
          </div>
          {showMore && (
            <>
              <div className="space-y-1.5">
                <Label>Language</Label>
                <Input value={form.language} onChange={set("language")} placeholder="English" />
              </div>
              <div className="space-y-1.5">
                <Label>Country</Label>
                <Input value={form.country} onChange={set("country")} />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Address / banner note</Label>
                <Textarea rows={2} value={form.addrNote} onChange={set("addrNote")} />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Appointment note</Label>
                <Textarea rows={2} value={form.apptModNote} onChange={set("apptModNote")} />
              </div>
            </>
          )}
          <button
            type="button"
            className="text-left text-xs text-primary hover:underline sm:col-span-2"
            onClick={() => setShowMore((v) => !v)}
          >
            {showMore ? "Show fewer fields" : "More fields (language, notes)"}
          </button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Family</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Label>Join an existing family (optional)</Label>
          <PatientPicker value={guarantor} onChange={setGuarantor} />
          <p className="text-xs text-muted-foreground">
            Pick the guarantor of an existing family to add this patient to it. Leave empty to make them
            their own guarantor.
          </p>
        </CardContent>
      </Card>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>
        <Button onClick={submit} disabled={saving}>
          {saving ? "Creating..." : "Create Patient"}
        </Button>
      </div>
    </div>
  );
}
