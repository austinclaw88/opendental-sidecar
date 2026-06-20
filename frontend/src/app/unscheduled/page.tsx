"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { CalendarX2, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ConfirmationItem, appointmentApi } from "@/lib/api";
import { fmtDateTime } from "@/lib/format";

export default function UnscheduledPage() {
  const [items, setItems] = useState<ConfirmationItem[]>([]);
  const [asap, setAsap] = useState<ConfirmationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyApt, setBusyApt] = useState<number | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      appointmentApi.getUnscheduled().catch(() => [] as ConfirmationItem[]),
      appointmentApi.getAsap().catch(() => [] as ConfirmationItem[]),
    ])
      .then(([u, a]) => {
        setItems(u);
        setAsap(a);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(load, [load]);

  const togglePriority = async (item: ConfirmationItem) => {
    setBusyApt(item.aptNum);
    try {
      await appointmentApi.setPriority(item.aptNum, item.priority === 1 ? 0 : 1);
      load();
    } finally {
      setBusyApt(null);
    }
  };

  const statusBadge = (item: ConfirmationItem) => {
    const desc = item.aptStatusDesc ?? "";
    const cls =
      item.aptStatus === 5 ? "badge-broken"
      : item.aptStatus === 3 ? "badge-unscheduled"
      : item.aptStatus === 1 ? "badge-scheduled"
      : "badge-inactive";
    return <Badge variant="outline" className={cls}>{desc || `Status ${item.aptStatus}`}</Badge>;
  };

  const renderTable = (rows: ConfirmationItem[], isAsapTab: boolean) => (
    <div className="rounded-lg border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Patient</TableHead>
            <TableHead>{isAsapTab ? "Current time" : "Original time"}</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Phone</TableHead>
            <TableHead>Procedures</TableHead>
            <TableHead className="w-28"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((item) => (
            <TableRow key={item.aptNum}>
              <TableCell>
                <Link href={`/patients/${item.patNum}`} className="font-medium hover:underline">
                  {item.patientName}
                </Link>
                {item.priority === 1 && !isAsapTab && (
                  <Badge variant="outline" className="ml-2 badge-scheduled">
                    <Zap className="mr-1 h-3 w-3" />
                    ASAP
                  </Badge>
                )}
              </TableCell>
              <TableCell className="text-sm">
                {fmtDateTime(item.aptDateTime) || <span className="text-muted-foreground">None</span>}
              </TableCell>
              <TableCell className="text-sm">{statusBadge(item)}</TableCell>
              <TableCell className="text-sm">
                {item.wirelessPhone || item.hmPhone || <span className="text-muted-foreground">No phone</span>}
              </TableCell>
              <TableCell className="max-w-56 truncate text-sm text-muted-foreground">
                {item.procDescript}
              </TableCell>
              <TableCell>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busyApt === item.aptNum}
                  onClick={() => togglePriority(item)}
                  title={item.priority === 1 ? "Remove ASAP flag" : "Flag as ASAP"}
                >
                  <Zap className="h-3.5 w-3.5" />
                  <span className="ml-1">{item.priority === 1 ? "Unflag" : "ASAP"}</span>
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Lists</h1>
        <p className="text-sm text-muted-foreground">
          Broken and unscheduled appointments waiting to be rebooked, and patients flagged for an earlier opening.
        </p>
      </div>

      {loading && <p className="py-16 text-center text-muted-foreground">Loading...</p>}

      {!loading && (
        <Tabs defaultValue="unscheduled">
          <TabsList>
            <TabsTrigger value="unscheduled">Unscheduled ({items.length})</TabsTrigger>
            <TabsTrigger value="asap">ASAP ({asap.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="unscheduled" className="mt-4 space-y-3">
            {items.length === 0 ? (
              <p className="py-16 text-center text-muted-foreground">Nothing on the unscheduled list.</p>
            ) : (
              <>
                {renderTable(items, false)}
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <CalendarX2 className="h-3.5 w-3.5" />
                  {items.length} appointment{items.length === 1 ? "" : "s"} waiting. Open the patient to book a new time.
                </p>
              </>
            )}
          </TabsContent>

          <TabsContent value="asap" className="mt-4 space-y-3">
            {asap.length === 0 ? (
              <p className="py-16 text-center text-muted-foreground">
                No one is flagged ASAP. Flag an appointment from its detail sheet or the unscheduled list.
              </p>
            ) : (
              <>
                {renderTable(asap, true)}
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Zap className="h-3.5 w-3.5" />
                  Call these patients first when a cancellation opens up the book.
                </p>
              </>
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
