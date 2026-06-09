"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, User, Phone, Mail, MapPin, CalendarDays, Shield, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PatientDetail, Appointment, Procedure, ClaimDto, api } from "@/lib/api";

export default function PatientDetailPage() {
  const { patNum } = useParams<{ patNum: string }>();
  const router = useRouter();
  const [patient, setPatient] = useState<PatientDetail | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [procedures, setProcedures] = useState<Procedure[]>([]);
  const [claims, setClaims] = useState<ClaimDto[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!patNum) return;
    const n = parseInt(patNum);
    Promise.all([
      api.getPatient(n),
      api.getAppointments(n),
      api.getProcedures(n),
      api.getClaims(n),
    ]).then(([p, a, pr, c]) => {
      setPatient(p);
      setAppointments(a);
      setProcedures(pr);
      setClaims(c);
    }).finally(() => setLoading(false));
  }, [patNum]);

  if (loading) {
    return <div className="flex items-center justify-center py-20 text-muted-foreground">Loading patient...</div>;
  }
  if (!patient) {
    return <div className="py-20 text-center text-muted-foreground">Patient not found.</div>;
  }

  const statusBadge = (desc: string) => {
    const cls = desc.toLowerCase() === "patient" ? "badge-patient"
      : desc.toLowerCase() === "inactive" ? "badge-inactive"
      : desc.toLowerCase() === "archived" ? "badge-archived"
      : "badge-inactive";
    return <Badge variant="outline" className={cls}>{desc}</Badge>;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.push("/")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
          <User className="h-6 w-6 text-primary" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">
              {patient.lName}, {patient.fName}
              {patient.preferred && <span className="ml-2 text-lg text-muted-foreground">({patient.preferred})</span>}
            </h1>
            {statusBadge(patient.patStatusDesc)}
          </div>
          <p className="text-sm text-muted-foreground">
            Patient #{patient.patNum}
            {patient.birthdate && ` · Born ${new Date(patient.birthdate).toLocaleDateString()}`}
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Demographics */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Demographics</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {patient.address && (
              <div className="flex items-start gap-2">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                <span>{patient.address}{patient.address2 && <>, {patient.address2}</>}<br />{patient.city}, {patient.state} {patient.zip}</span>
              </div>
            )}
            {patient.hmPhone && (
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span>{patient.hmPhone}</span>
              </div>
            )}
            {patient.wkPhone && (
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="text-muted-foreground">Work: {patient.wkPhone}</span>
              </div>
            )}
            {patient.wirelessPhone && (
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span>{patient.wirelessPhone}</span>
              </div>
            )}
            {patient.email && (
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span>{patient.email}</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Guarantor & Provider */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Relationships</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {patient.guarantorName && (
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span>Guarantor: <strong>{patient.guarantorName}</strong></span>
              </div>
            )}
            {patient.preferredProviderName && (
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span>Preferred Provider: <strong>{patient.preferredProviderName}</strong></span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Insurance */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Insurance</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {patient.insurancePlans.length === 0 && (
              <p className="text-muted-foreground">No insurance on file.</p>
            )}
            {patient.insurancePlans.map((ins) => (
              <div key={ins.planNum} className="flex items-start gap-2 rounded-lg border p-3">
                <Shield className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <div className="min-w-0">
                  <p className="font-medium">{ins.carrierName}</p>
                  {ins.groupName && <p className="text-xs text-muted-foreground">{ins.groupName}</p>}
                  {ins.subscriberName && <p className="text-xs text-muted-foreground">Sub: {ins.subscriberName} (ID: {ins.subscriberId})</p>}
                  <Badge variant="outline" className="mt-1 text-[10px]">Priority {ins.ordinal}</Badge>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Tabs: Appointments, Procedures, Claims */}
      <Tabs defaultValue="appointments">
        <TabsList>
          <TabsTrigger value="appointments">Appointments ({appointments.length})</TabsTrigger>
          <TabsTrigger value="procedures">Procedures ({procedures.length})</TabsTrigger>
          <TabsTrigger value="claims">Claims ({claims.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="appointments" className="mt-4">
          <AppointmentsTable appointments={appointments} />
        </TabsContent>
        <TabsContent value="procedures" className="mt-4">
          <ProceduresTable procedures={procedures} />
        </TabsContent>
        <TabsContent value="claims" className="mt-4">
          <ClaimsTable claims={claims} router={router} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ── Appointments Table ──────────────────────────────────────────

function AppointmentsTable({ appointments }: { appointments: Appointment[] }) {
  const aptBadge = (desc: string) => {
    const d = desc.toLowerCase();
    const cls = d === "scheduled" || d === "asap" || d === "held" || d === "waiting" ? "badge-scheduled"
      : d === "complete" ? "badge-complete"
      : d === "cancelled" ? "badge-cancelled"
      : d === "broken" ? "badge-broken"
      : d === "unschedlist" || d === "unschedall" || d === "onbreak" ? "badge-unscheduled"
      : "badge-inactive";
    return <Badge variant="outline" className={cls}>{desc}</Badge>;
  };

  if (appointments.length === 0) return <p className="py-8 text-center text-sm text-muted-foreground">No appointments found.</p>;

  return (
    <div className="rounded-lg border">
      <table className="w-full">
        <thead>
          <tr className="border-b bg-muted/50 text-left text-xs font-medium text-muted-foreground">
            <th className="px-4 py-3">Date/Time</th>
            <th className="px-4 py-3">Provider</th>
            <th className="px-4 py-3">Operatory</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">Procedures</th>
          </tr>
        </thead>
        <tbody>
          {appointments.map((a) => (
            <tr key={a.aptNum} className="border-b text-sm last:border-0 hover:bg-muted/30">
              <td className="px-4 py-3 font-medium">{new Date(a.aptDateTime).toLocaleString()}</td>
              <td className="px-4 py-3">{a.providerName || "—"}</td>
              <td className="px-4 py-3">{a.operatoryName || `#${a.operatoryNum}` || "—"}</td>
              <td className="px-4 py-3">{aptBadge(a.aptStatusDesc)}</td>
              <td className="px-4 py-3 text-muted-foreground">{a.procDescript || "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Procedures Table ────────────────────────────────────────────

function ProceduresTable({ procedures }: { procedures: Procedure[] }) {
  const procBadge = (desc: string) => {
    const d = desc.toLowerCase();
    const cls = d === "complete" ? "badge-complete"
      : d === "treatment planned" ? "badge-tp"
      : d === "existing current" || d === "existing other" ? "badge-estimate"
      : d === "deleted" ? "badge-inactive"
      : d === "condition" || d === "referred" ? "badge-unscheduled"
      : "badge-inactive";
    return <Badge variant="outline" className={cls}>{desc}</Badge>;
  };

  if (procedures.length === 0) return <p className="py-8 text-center text-sm text-muted-foreground">No procedures found.</p>;

  return (
    <div className="rounded-lg border">
      <table className="w-full">
        <thead>
          <tr className="border-b bg-muted/50 text-left text-xs font-medium text-muted-foreground">
            <th className="px-4 py-3">Date</th>
            <th className="px-4 py-3">Code</th>
            <th className="px-4 py-3">Description</th>
            <th className="px-4 py-3">Tooth</th>
            <th className="px-4 py-3">Fee</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">Provider</th>
          </tr>
        </thead>
        <tbody>
          {procedures.map((p) => (
            <tr key={p.procNum} className="border-b text-sm last:border-0 hover:bg-muted/30">
              <td className="px-4 py-3">{new Date(p.procDate).toLocaleDateString()}</td>
              <td className="px-4 py-3 font-mono text-xs">{p.procCode}</td>
              <td className="px-4 py-3 max-w-[200px] truncate" title={p.descript}>{p.descript}</td>
              <td className="px-4 py-3">{p.toothNum || p.toothRange || "—"}</td>
              <td className="px-4 py-3">${p.procFee.toFixed(2)}</td>
              <td className="px-4 py-3">{procBadge(p.procStatusDesc)}</td>
              <td className="px-4 py-3 text-muted-foreground">{p.providerName || "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Claims Table ────────────────────────────────────────────────

function ClaimsTable({ claims, router }: { claims: ClaimDto[]; router: ReturnType<typeof useRouter> }) {
  const claimBadge = (desc: string) => {
    const d = desc.toLowerCase();
    const cls = d === "not sent" ? "badge-unscheduled"
      : d === "sent" ? "badge-sent"
      : d === "received" ? "badge-received"
      : d === "denied" ? "badge-denied"
      : d === "estimate" ? "badge-estimate"
      : d === "adjustment" || d === "supplemental" ? "badge-inactive"
      : "badge-inactive";
    return <Badge variant="outline" className={cls}>{desc}</Badge>;
  };

  if (claims.length === 0) return <p className="py-8 text-center text-sm text-muted-foreground">No claims found.</p>;

  return (
    <div className="rounded-lg border">
      <table className="w-full">
        <thead>
          <tr className="border-b bg-muted/50 text-left text-xs font-medium text-muted-foreground">
            <th className="px-4 py-3">Claim#</th>
            <th className="px-4 py-3">Carrier</th>
            <th className="px-4 py-3">Service Date</th>
            <th className="px-4 py-3">Fee</th>
            <th className="px-4 py-3">Ins Paid</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">Sent</th>
          </tr>
        </thead>
        <tbody>
          {claims.map((c) => (
            <tr
              key={c.claimNum}
              className="cursor-pointer border-b text-sm last:border-0 hover:bg-muted/30"
              onClick={() => router.push(`/claims/${c.claimNum}`)}
            >
              <td className="px-4 py-3 font-mono text-xs">#{c.claimNum}</td>
              <td className="px-4 py-3">{c.carrierName || "—"}</td>
              <td className="px-4 py-3">{c.dateService ? new Date(c.dateService).toLocaleDateString() : "—"}</td>
              <td className="px-4 py-3">${c.claimFee.toFixed(2)}</td>
              <td className="px-4 py-3">${c.insPayAmt.toFixed(2)}</td>
              <td className="px-4 py-3">{claimBadge(c.claimStatusDesc)}</td>
              <td className="px-4 py-3 text-muted-foreground">{c.dateSent ? new Date(c.dateSent).toLocaleDateString() : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
