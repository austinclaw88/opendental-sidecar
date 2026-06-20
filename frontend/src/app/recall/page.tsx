"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { BellRing } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Label } from "@/components/ui/select";
import {
  AppointmentType,
  Operatory,
  PatientSummary,
  Provider,
  RecallDue,
  recallApi,
  referenceApi,
} from "@/lib/api";
import { NewAppointmentDialog } from "@/components/schedule/new-appointment-dialog";
import { addDays, fmtDate, toDateInput } from "@/lib/format";

export default function RecallPage() {
  const [from, setFrom] = useState(() => toDateInput(addDays(new Date(), -180)));
  const [to, setTo] = useState(() => toDateInput(addDays(new Date(), 30)));
  const [includeScheduled, setIncludeScheduled] = useState(false);
  const [items, setItems] = useState<RecallDue[]>([]);
  const [loading, setLoading] = useState(true);
  const [operatories, setOperatories] = useState<Operatory[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [apptTypes, setApptTypes] = useState<AppointmentType[]>([]);
  const [booking, setBooking] = useState<RecallDue | null>(null);

  useEffect(() => {
    Promise.all([
      referenceApi.getOperatories(),
      referenceApi.getProviders(),
      referenceApi.getAppointmentTypes(),
    ]).then(([o, p, t]) => {
      setOperatories(o);
      setProviders(p);
      setApptTypes(t);
    });
  }, []);

  const bookingPatient: PatientSummary | null = booking
    ? {
        patNum: booking.patNum,
        lName: booking.patientName.split(",")[0]?.trim() ?? booking.patientName,
        fName: booking.patientName.split(",")[1]?.trim() ?? "",
        hmPhone: booking.hmPhone,
        wirelessPhone: booking.wirelessPhone,
        email: booking.email,
        patStatus: 0,
        patStatusDesc: "Patient",
      }
    : null;

  const load = useCallback(() => {
    setLoading(true);
    recallApi
      .getDue(from, to, includeScheduled)
      .then(setItems)
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [from, to, includeScheduled]);

  useEffect(load, [load]);

  const overdueDays = (due?: string) => {
    if (!due) return null;
    const diff = Math.floor((Date.now() - new Date(due).getTime()) / 86400000);
    return diff;
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Recall</h1>
          <p className="text-sm text-muted-foreground">
            Patients due or overdue for hygiene and exam recall.
          </p>
        </div>
        <div className="flex items-end gap-2">
          <div className="space-y-1">
            <Label>Due from</Label>
            <Input type="date" value={from} onChange={(e) => e.target.value && setFrom(e.target.value)} className="w-38" />
          </div>
          <div className="space-y-1">
            <Label>Due to</Label>
            <Input type="date" value={to} onChange={(e) => e.target.value && setTo(e.target.value)} className="w-38" />
          </div>
          <label className="flex h-9 items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="h-4 w-4 accent-primary"
              checked={includeScheduled}
              onChange={(e) => setIncludeScheduled(e.target.checked)}
            />
            Include scheduled
          </label>
          <Button variant="outline" onClick={load}>
            Refresh
          </Button>
        </div>
      </div>

      {loading && <p className="py-16 text-center text-muted-foreground">Loading...</p>}

      {!loading && items.length === 0 && (
        <p className="py-16 text-center text-muted-foreground">No recall due in this range.</p>
      )}

      {!loading && items.length > 0 && (
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Patient</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Due</TableHead>
                <TableHead>Last visit</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Scheduled</TableHead>
                <TableHead className="w-24"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((r) => {
                const days = overdueDays(r.dateDue);
                return (
                  <TableRow key={r.recallNum}>
                    <TableCell>
                      <Link href={`/patients/${r.patNum}`} className="font-medium hover:underline">
                        {r.patientName}
                      </Link>
                      {r.note && <p className="text-xs text-muted-foreground">{r.note}</p>}
                    </TableCell>
                    <TableCell className="text-sm">{r.recallTypeDesc}</TableCell>
                    <TableCell className="text-sm">
                      {fmtDate(r.dateDue)}
                      {days != null && days > 0 && (
                        <Badge variant="outline" className="ml-2 border-destructive/40 text-destructive">
                          {days}d overdue
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{fmtDate(r.datePrevious)}</TableCell>
                    <TableCell className="text-sm">
                      {r.wirelessPhone || r.hmPhone || <span className="text-muted-foreground">No phone</span>}
                    </TableCell>
                    <TableCell className="text-sm">
                      {r.dateScheduled ? (
                        <Badge variant="outline" className="text-primary">{fmtDate(r.dateScheduled)}</Badge>
                      ) : (
                        <span className="text-muted-foreground">Not booked</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {!r.dateScheduled && !r.isDisabled && (
                        <Button size="sm" variant="outline" onClick={() => setBooking(r)}>
                          Book
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {!loading && items.length > 0 && (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <BellRing className="h-3.5 w-3.5" />
          {items.length} patient{items.length === 1 ? "" : "s"} due. Book directly from the list — the recall is marked scheduled automatically.
        </p>
      )}

      <NewAppointmentDialog
        open={booking !== null}
        onOpenChange={(open) => !open && setBooking(null)}
        operatories={operatories}
        providers={providers}
        appointmentTypes={apptTypes}
        defaultPatient={bookingPatient}
        recallNum={booking?.recallNum}
        onBooked={load}
      />
    </div>
  );
}
