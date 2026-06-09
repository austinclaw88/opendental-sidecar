"use client";

import { useState } from "react";
import { Calendar, Search, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Appointment, api } from "@/lib/api";

export default function AppointmentsPage() {
  const [patNum, setPatNum] = useState("");
  const [appointments, setAppointments] = useState<Appointment[] | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSearch = async () => {
    if (!patNum.trim()) return;
    setLoading(true);
    try {
      const data = await api.getAppointments(parseInt(patNum));
      setAppointments(data);
    } catch {
      setAppointments([]);
    } finally {
      setLoading(false);
    }
  };

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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Appointments</h1>
        <p className="mt-1 text-sm text-muted-foreground">View appointments for a patient.</p>
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

      {appointments !== null && appointments.length === 0 && (
        <p className="text-sm text-muted-foreground">No appointments found.</p>
      )}

      {appointments && appointments.length > 0 && (
        <div className="rounded-lg border">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-muted/50 text-left text-xs font-medium text-muted-foreground">
                <th className="px-4 py-3">Patient#</th>
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
                  <td className="px-4 py-3 font-mono text-xs">#{a.patNum}</td>
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
      )}

      {appointments === null && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Calendar className="h-12 w-12 text-muted-foreground/30" />
          <p className="mt-4 text-sm text-muted-foreground">Enter a patient number to see their appointments.</p>
        </div>
      )}
    </div>
  );
}
