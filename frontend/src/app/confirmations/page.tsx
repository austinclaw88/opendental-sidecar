"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { PhoneCall, MessageSquarePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Select, Label } from "@/components/ui/select";
import {
  ConfirmationItem,
  Definition,
  appointmentApi,
  commlogApi,
  referenceApi,
  scheduleApi,
} from "@/lib/api";
import { addDays, argbToHex, fmtDateTime, toDateInput } from "@/lib/format";

export default function ConfirmationsPage() {
  const [from, setFrom] = useState(() => toDateInput(addDays(new Date(), 1)));
  const [to, setTo] = useState(() => toDateInput(addDays(new Date(), 1)));
  const [items, setItems] = useState<ConfirmationItem[]>([]);
  const [statuses, setStatuses] = useState<Definition[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyApt, setBusyApt] = useState<number | null>(null);
  const [loggedApt, setLoggedApt] = useState<Set<number>>(new Set());

  const load = useCallback(() => {
    setLoading(true);
    scheduleApi
      .getConfirmations(from, to)
      .then(setItems)
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [from, to]);

  useEffect(load, [load]);
  useEffect(() => {
    referenceApi.getConfirmationStatuses().then(setStatuses).catch(() => {});
  }, []);

  const setConfirmation = async (item: ConfirmationItem, defNum: number) => {
    setBusyApt(item.aptNum);
    try {
      await appointmentApi.setConfirmation(item.aptNum, defNum);
      load();
    } finally {
      setBusyApt(null);
    }
  };

  const logCall = async (item: ConfirmationItem) => {
    setBusyApt(item.aptNum);
    try {
      await commlogApi.create({
        patNum: item.patNum,
        note: `Confirmation call for appointment on ${fmtDateTime(item.aptDateTime)}.`,
        mode: 3,
        sentOrReceived: 1,
      });
      setLoggedApt((prev) => new Set(prev).add(item.aptNum));
    } finally {
      setBusyApt(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Confirmations</h1>
          <p className="text-sm text-muted-foreground">
            Work the call list and set confirmation statuses without leaving the page.
          </p>
        </div>
        <div className="flex items-end gap-2">
          <div className="space-y-1">
            <Label>From</Label>
            <Input type="date" value={from} onChange={(e) => e.target.value && setFrom(e.target.value)} className="w-38" />
          </div>
          <div className="space-y-1">
            <Label>To</Label>
            <Input type="date" value={to} onChange={(e) => e.target.value && setTo(e.target.value)} className="w-38" />
          </div>
          <Button
            variant="outline"
            onClick={() => {
              const t = toDateInput(addDays(new Date(), 1));
              setFrom(t);
              setTo(t);
            }}
          >
            Tomorrow
          </Button>
        </div>
      </div>

      {loading && <p className="py-16 text-center text-muted-foreground">Loading...</p>}

      {!loading && items.length === 0 && (
        <p className="py-16 text-center text-muted-foreground">
          No appointments in this date range. Nice and quiet.
        </p>
      )}

      {!loading && items.length > 0 && (
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Patient</TableHead>
                <TableHead>Appointment</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Procedures</TableHead>
                <TableHead className="w-44">Status</TableHead>
                <TableHead className="w-28">Log</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.aptNum}>
                  <TableCell>
                    <Link href={`/patients/${item.patNum}`} className="font-medium hover:underline">
                      {item.patientName}
                    </Link>
                    {item.apptPhoneNote && (
                      <p className="text-xs text-muted-foreground">{item.apptPhoneNote}</p>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">
                    {fmtDateTime(item.aptDateTime)}
                    <p className="text-xs text-muted-foreground">
                      {item.minutes} min
                      {item.providerAbbr && ` · ${item.providerAbbr}`}
                      {item.operatoryAbbrev && ` · ${item.operatoryAbbrev}`}
                    </p>
                  </TableCell>
                  <TableCell className="text-sm">
                    {item.wirelessPhone || item.hmPhone || (
                      <span className="text-muted-foreground">No phone</span>
                    )}
                  </TableCell>
                  <TableCell className="max-w-48 truncate text-sm text-muted-foreground">
                    {item.procDescript}
                  </TableCell>
                  <TableCell>
                    <Select
                      value={item.confirmedDefNum}
                      disabled={busyApt === item.aptNum}
                      onChange={(e) => setConfirmation(item, parseInt(e.target.value))}
                    >
                      {statuses.map((s) => (
                        <option key={s.defNum} value={s.defNum}>
                          {s.itemName}
                        </option>
                      ))}
                    </Select>
                  </TableCell>
                  <TableCell>
                    {loggedApt.has(item.aptNum) ? (
                      <Badge variant="outline" className="text-primary">
                        Logged
                      </Badge>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={busyApt === item.aptNum}
                        onClick={() => logCall(item)}
                        title="Add a phone commlog for this call"
                      >
                        <MessageSquarePlus className="h-4 w-4" />
                        <span className="ml-1">Call</span>
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {!loading && items.length > 0 && (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <PhoneCall className="h-3.5 w-3.5" />
          {items.length} appointment{items.length === 1 ? "" : "s"} in range. Status colors:{" "}
          {statuses.slice(0, 6).map((s) => (
            <span key={s.defNum} className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-full" style={{ background: argbToHex(s.itemColor) }} />
              {s.itemName}
            </span>
          ))}
        </p>
      )}
    </div>
  );
}
