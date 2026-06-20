"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, Label } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ClaimQueueItem, claimQueueApi } from "@/lib/api";
import { fmtDate, fmtMoney } from "@/lib/format";

const STATUS_FILTERS = [
  { value: "open", label: "Open (not received)" },
  { value: "", label: "All claims" },
  { value: "U", label: "Not sent" },
  { value: "W", label: "Waiting to send" },
  { value: "H", label: "On hold" },
  { value: "S", label: "Sent — awaiting payment" },
  { value: "R", label: "Received" },
];

export default function ClaimsPage() {
  const router = useRouter();
  const [status, setStatus] = useState("open");
  const [days, setDays] = useState(365);
  const [claims, setClaims] = useState<ClaimQueueItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    claimQueueApi
      .getQueue(status || undefined, days)
      .then(setClaims)
      .catch(() => setClaims([]))
      .finally(() => setLoading(false));
  }, [status, days]);

  useEffect(load, [load]);

  const claimBadge = (c: ClaimQueueItem) => {
    const cls =
      c.claimStatus === "U" ? "badge-unscheduled"
      : c.claimStatus === "S" || c.claimStatus === "P" ? "badge-sent"
      : c.claimStatus === "R" ? "badge-received"
      : c.claimStatus === "W" ? "badge-estimate"
      : "badge-inactive";
    return <Badge variant="outline" className={cls}>{c.claimStatusDesc}</Badge>;
  };

  const totalFee = claims.reduce((sum, c) => sum + c.claimFee, 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Claims</h1>
          <p className="text-sm text-muted-foreground">
            Clinic-wide claims queue. Click a claim for the full breakdown.
          </p>
        </div>
        <div className="flex items-end gap-2">
          <div className="space-y-1">
            <Label>Status</Label>
            <Select value={status} onChange={(e) => setStatus(e.target.value)} className="w-56">
              {STATUS_FILTERS.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Service window</Label>
            <Select value={days} onChange={(e) => setDays(parseInt(e.target.value))} className="w-36">
              <option value={90}>Last 90 days</option>
              <option value={180}>Last 180 days</option>
              <option value={365}>Last year</option>
              <option value={730}>Last 2 years</option>
            </Select>
          </div>
          <Button variant="outline" onClick={load}>
            Refresh
          </Button>
        </div>
      </div>

      {loading && <p className="py-16 text-center text-muted-foreground">Loading claims...</p>}

      {!loading && claims.length === 0 && (
        <p className="py-16 text-center text-muted-foreground">No claims match this filter.</p>
      )}

      {!loading && claims.length > 0 && (
        <>
          <div className="rounded-lg border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Claim</TableHead>
                  <TableHead>Patient</TableHead>
                  <TableHead>Carrier</TableHead>
                  <TableHead>Service</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Sent</TableHead>
                  <TableHead className="text-right">Fee</TableHead>
                  <TableHead className="text-right">Ins paid</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {claims.map((c) => (
                  <TableRow
                    key={c.claimNum}
                    className="cursor-pointer"
                    onClick={() => router.push(`/claims/${c.claimNum}`)}
                  >
                    <TableCell className="font-mono text-xs">#{c.claimNum}</TableCell>
                    <TableCell>
                      <Link
                        href={`/patients/${c.patNum}`}
                        className="font-medium hover:underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {c.patientName}
                      </Link>
                    </TableCell>
                    <TableCell className="text-sm">{c.carrierName || "—"}</TableCell>
                    <TableCell className="text-sm">{fmtDate(c.dateService)}</TableCell>
                    <TableCell>{claimBadge(c)}</TableCell>
                    <TableCell className="text-sm">
                      {c.dateSent ? (
                        <>
                          {fmtDate(c.dateSent)}
                          {c.daysSinceSent != null && c.claimStatus === "S" && c.daysSinceSent > 30 && (
                            <Badge variant="outline" className="ml-2 border-destructive/40 text-destructive">
                              {c.daysSinceSent}d
                            </Badge>
                          )}
                        </>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right text-sm">{fmtMoney(c.claimFee)}</TableCell>
                    <TableCell className="text-right text-sm">{fmtMoney(c.insPayAmt)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <FileText className="h-3.5 w-3.5" />
            {claims.length} claim{claims.length === 1 ? "" : "s"} · {fmtMoney(totalFee)} total billed.
            Sent claims older than 30 days are flagged for follow-up.
          </p>
        </>
      )}
    </div>
  );
}
