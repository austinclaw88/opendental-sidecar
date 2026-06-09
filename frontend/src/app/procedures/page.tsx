"use client";

import { useState } from "react";
import { Syringe, Search, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Procedure, api } from "@/lib/api";

export default function ProceduresPage() {
  const [patNum, setPatNum] = useState("");
  const [procedures, setProcedures] = useState<Procedure[] | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSearch = async () => {
    if (!patNum.trim()) return;
    setLoading(true);
    try {
      const data = await api.getProcedures(parseInt(patNum));
      setProcedures(data);
    } catch {
      setProcedures([]);
    } finally {
      setLoading(false);
    }
  };

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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Procedures</h1>
        <p className="mt-1 text-sm text-muted-foreground">View procedures for a patient.</p>
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

      {procedures !== null && procedures.length === 0 && (
        <p className="text-sm text-muted-foreground">No procedures found.</p>
      )}

      {procedures && procedures.length > 0 && (
        <div className="rounded-lg border">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-muted/50 text-left text-xs font-medium text-muted-foreground">
                <th className="px-4 py-3">Patient#</th>
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
                  <td className="px-4 py-3 font-mono text-xs">#{p.patNum}</td>
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
      )}

      {procedures === null && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Syringe className="h-12 w-12 text-muted-foreground/30" />
          <p className="mt-4 text-sm text-muted-foreground">Enter a patient number to see their procedures.</p>
        </div>
      )}
    </div>
  );
}
