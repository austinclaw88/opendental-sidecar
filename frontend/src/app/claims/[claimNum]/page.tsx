"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, FileText, Building2, User, CalendarDays, DollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ClaimDetail as ClaimDetailType, api } from "@/lib/api";

export default function ClaimDetailPage() {
  const { claimNum } = useParams<{ claimNum: string }>();
  const router = useRouter();
  const [claim, setClaim] = useState<ClaimDetailType | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!claimNum) return;
    api.getClaimDetail(parseInt(claimNum))
      .then(setClaim)
      .finally(() => setLoading(false));
  }, [claimNum]);

  if (loading) return <div className="flex items-center justify-center py-20 text-muted-foreground">Loading claim...</div>;
  if (!claim) return <div className="py-20 text-center text-muted-foreground">Claim not found.</div>;

  const statusBadge = (desc: string) => {
    const d = desc.toLowerCase();
    const cls = d === "not sent" ? "badge-unscheduled"
      : d === "sent" ? "badge-sent"
      : d === "received" ? "badge-received"
      : d === "denied" ? "badge-denied"
      : d === "estimate" ? "badge-estimate"
      : "badge-inactive";
    return <Badge variant="outline" className={cls}>{desc}</Badge>;
  };

  const procStatusBadge = (desc: string) => {
    const d = desc.toLowerCase();
    const cls = d === "received" ? "badge-received"
      : d === "estimate" ? "badge-estimate"
      : d === "rejected" || d === "claim denied" ? "badge-denied"
      : d === "not received" ? "badge-unscheduled"
      : d.includes("existing") || d === "cap claim" ? "badge-inactive"
      : d === "adjustment" ? "badge-sent"
      : "badge-inactive";
    return <Badge variant="outline" className={cls}>{desc}</Badge>;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
          <FileText className="h-6 w-6 text-primary" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">Claim #{claim.claimNum}</h1>
            {statusBadge(claim.claimStatusDesc)}
          </div>
          <p className="text-sm text-muted-foreground">
            {claim.carrierName || "No carrier"} · {claim.providerName || "No provider"}
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <DollarSign className="h-3 w-3" /> Claim Fee
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">${claim.claimFee.toFixed(2)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <DollarSign className="h-3 w-3" /> Insurance Paid
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold text-green-600">${claim.insPayAmt.toFixed(2)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <DollarSign className="h-3 w-3" /> Write-off
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold text-orange-600">${claim.writeOff.toFixed(2)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <DollarSign className="h-3 w-3" /> Balance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">${claim.balanceRemaining.toFixed(2)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Details */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-sm font-medium">Claim Details</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Service Date</span><span>{claim.dateService ? new Date(claim.dateService).toLocaleDateString() : "—"}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Date Sent</span><span>{claim.dateSent ? new Date(claim.dateSent).toLocaleDateString() : "—"}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Date Received</span><span>{claim.dateReceived ? new Date(claim.dateReceived).toLocaleDateString() : "—"}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Carrier</span><span>{claim.carrierName || "—"}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Provider</span><span>{claim.providerName || "—"}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Claim Form</span><span>{claim.claimForm != null ? `Type ${claim.claimForm}` : "—"}</span></div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm font-medium">Payment Summary</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Total Fee</span><span className="font-medium">${claim.claimFee.toFixed(2)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Insurance Estimate</span><span className="text-purple-600">${claim.insEstimate.toFixed(2)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Insurance Paid</span><span className="text-green-600">${claim.insPayAmt.toFixed(2)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Deductible Applied</span><span className="text-orange-600">${claim.dedApplied.toFixed(2)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Write-off</span><span className="text-orange-600">${claim.writeOff.toFixed(2)}</span></div>
            <div className="flex justify-between border-t pt-2"><span className="font-medium">Balance</span><span className="font-semibold">${claim.balanceRemaining.toFixed(2)}</span></div>
          </CardContent>
        </Card>
      </div>

      {/* Procedures on Claim */}
      <Card>
        <CardHeader><CardTitle className="text-sm font-medium">Procedures ({claim.procedures.length})</CardTitle></CardHeader>
        <CardContent className="p-0">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-muted/50 text-left text-xs font-medium text-muted-foreground">
                <th className="px-4 py-3">Code</th>
                <th className="px-4 py-3">Description</th>
                <th className="px-4 py-3">Tooth</th>
                <th className="px-4 py-3">Fee</th>
                <th className="px-4 py-3">Ins Paid</th>
                <th className="px-4 py-3">Ded Applied</th>
                <th className="px-4 py-3">Write-off</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {claim.procedures.map((cp) => (
                <tr key={cp.claimProcNum} className="border-b text-sm last:border-0 hover:bg-muted/30">
                  <td className="px-4 py-3 font-mono text-xs">{cp.procCode}</td>
                  <td className="px-4 py-3 max-w-[180px] truncate" title={cp.descript}>{cp.descript}</td>
                  <td className="px-4 py-3">{cp.toothNum || cp.surf || "—"}</td>
                  <td className="px-4 py-3">${cp.procFee.toFixed(2)}</td>
                  <td className="px-4 py-3 text-green-600">${cp.insPayAmt.toFixed(2)}</td>
                  <td className="px-4 py-3 text-orange-600">${cp.dedApplied.toFixed(2)}</td>
                  <td className="px-4 py-3 text-orange-600">${cp.writeOff.toFixed(2)}</td>
                  <td className="px-4 py-3">{procStatusBadge(cp.statusDesc)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Claim Payments */}
      {claim.payments.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-sm font-medium">Payments ({claim.payments.length})</CardTitle></CardHeader>
          <CardContent className="p-0">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-muted/50 text-left text-xs font-medium text-muted-foreground">
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Amount</th>
                  <th className="px-4 py-3">Check#</th>
                </tr>
              </thead>
              <tbody>
                {claim.payments.map((cp) => (
                  <tr key={cp.claimPaymentNum} className="border-b text-sm last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-3">{cp.datePay ? new Date(cp.datePay).toLocaleDateString() : "—"}</td>
                    <td className="px-4 py-3 font-medium text-green-600">${cp.payAmt.toFixed(2)}</td>
                    <td className="px-4 py-3">{cp.checkNum || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
