"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, Search, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ClaimDto, api } from "@/lib/api";

export default function ClaimsPage() {
  const router = useRouter();
  const [patNum, setPatNum] = useState("");
  const [claims, setClaims] = useState<ClaimDto[] | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSearch = async () => {
    if (!patNum.trim()) return;
    setLoading(true);
    try {
      const data = await api.getClaims(parseInt(patNum));
      setClaims(data);
    } catch {
      setClaims([]);
    } finally {
      setLoading(false);
    }
  };

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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Claims</h1>
        <p className="mt-1 text-sm text-muted-foreground">View claims for a patient.</p>
      </div>

      <div className="flex gap-3">
        <Input
          placeholder="Enter patient number..."
          className="max-w-xs"
          value={patNum}
          onChange={(e) => setPatNum(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
        />
        <Button onClick={handleSearch} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          Search
        </Button>
      </div>

      {claims !== null && claims.length === 0 && (
        <p className="text-sm text-muted-foreground">No claims found.</p>
      )}

      {claims && claims.length > 0 && (
        <div className="rounded-lg border">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-muted/50 text-left text-xs font-medium text-muted-foreground">
                <th className="px-4 py-3">Patient#</th>
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
                  <td className="px-4 py-3 font-mono text-xs">#{c.patNum}</td>
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
      )}

      {claims === null && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <FileText className="h-12 w-12 text-muted-foreground/30" />
          <p className="mt-4 text-sm text-muted-foreground">Enter a patient number to see their claims.</p>
        </div>
      )}
    </div>
  );
}
