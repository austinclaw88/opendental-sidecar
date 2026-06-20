"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { AccountSummary, Commlog, FamilyMember, RecallDue } from "@/lib/api";
import { fmtDate, fmtDateTime, fmtMoney } from "@/lib/format";

// ── Account ledger tab ──────────────────────────────────────────

export function AccountTab({ account }: { account: AccountSummary | null }) {
  if (!account) {
    return <p className="py-8 text-center text-sm text-muted-foreground">No account data.</p>;
  }

  const kindBadge = (kind: string) => {
    const cls =
      kind === "procedure" ? "badge-tp"
      : kind === "payment" ? "badge-complete"
      : kind === "insurance" ? "badge-received"
      : "badge-inactive";
    return <Badge variant="outline" className={cls}>{kind}</Badge>;
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs text-muted-foreground">Estimated family balance</p>
          <p className={`text-2xl font-semibold ${account.estimatedBalance > 0 ? "text-destructive" : "text-primary"}`}>
            {fmtMoney(account.estimatedBalance)}
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Computed from the ledger. OpenDental aging may differ slightly.
          </p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs text-muted-foreground">Total charges</p>
          <p className="text-2xl font-semibold">{fmtMoney(account.totalCharges)}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs text-muted-foreground">Total credits</p>
          <p className="text-2xl font-semibold">{fmtMoney(account.totalCredits)}</p>
        </div>
      </div>

      {account.entries.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">No ledger activity yet.</p>
      ) : (
        <div className="rounded-lg border">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-muted/50 text-left text-xs font-medium text-muted-foreground">
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Patient</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Description</th>
                <th className="px-4 py-3 text-right">Amount</th>
                <th className="px-4 py-3 text-right">Balance</th>
              </tr>
            </thead>
            <tbody>
              {account.entries.map((e) => (
                <tr key={`${e.kind}-${e.id}`} className="border-b text-sm last:border-0 hover:bg-muted/30">
                  <td className="px-4 py-3">{fmtDate(e.date)}</td>
                  <td className="px-4 py-3 text-muted-foreground">{e.patientName}</td>
                  <td className="px-4 py-3">{kindBadge(e.kind)}</td>
                  <td className="max-w-[280px] truncate px-4 py-3" title={e.description}>
                    {e.description}
                    {e.providerAbbr && <span className="ml-1 text-xs text-muted-foreground">({e.providerAbbr})</span>}
                  </td>
                  <td className={`px-4 py-3 text-right font-medium ${e.amount < 0 ? "text-primary" : ""}`}>
                    {fmtMoney(e.amount)}
                  </td>
                  <td className="px-4 py-3 text-right text-muted-foreground">{fmtMoney(e.runningBalance)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Family tab ──────────────────────────────────────────────────

export function FamilyTab({ family, currentPatNum }: { family: FamilyMember[]; currentPatNum: number }) {
  if (family.length === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground">No family members on file.</p>;
  }
  return (
    <div className="rounded-lg border">
      <table className="w-full">
        <thead>
          <tr className="border-b bg-muted/50 text-left text-xs font-medium text-muted-foreground">
            <th className="px-4 py-3">Name</th>
            <th className="px-4 py-3">Age</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">Mobile</th>
            <th className="px-4 py-3">Role</th>
          </tr>
        </thead>
        <tbody>
          {family.map((m) => (
            <tr key={m.patNum} className="border-b text-sm last:border-0 hover:bg-muted/30">
              <td className="px-4 py-3">
                {m.patNum === currentPatNum ? (
                  <span className="font-medium">{m.name} (this patient)</span>
                ) : (
                  <Link href={`/patients/${m.patNum}`} className="font-medium hover:underline">
                    {m.name}
                  </Link>
                )}
              </td>
              <td className="px-4 py-3">{m.age > 0 ? m.age : ""}</td>
              <td className="px-4 py-3 text-muted-foreground">{m.patStatusDesc}</td>
              <td className="px-4 py-3 text-muted-foreground">{m.wirelessPhone}</td>
              <td className="px-4 py-3">
                {m.isGuarantor && <Badge variant="outline" className="badge-scheduled">Guarantor</Badge>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Comm log tab ────────────────────────────────────────────────

export function CommlogTab({ commlogs }: { commlogs: Commlog[] }) {
  if (commlogs.length === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground">No communications logged yet.</p>;
  }
  return (
    <div className="space-y-2">
      {commlogs.map((c) => (
        <div key={c.commlogNum} className="rounded-lg border bg-card p-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>{fmtDateTime(c.commDateTime)}</span>
            <Badge variant="outline" className="text-[10px]">{c.modeDesc}</Badge>
            {c.commTypeDesc && <Badge variant="outline" className="text-[10px]">{c.commTypeDesc}</Badge>}
            {c.sentOrReceived === 1 && <span>· outbound</span>}
            {c.sentOrReceived === 2 && <span>· inbound</span>}
          </div>
          {c.note && <p className="mt-1.5 whitespace-pre-wrap text-sm">{c.note}</p>}
        </div>
      ))}
    </div>
  );
}

// ── Recall tab ──────────────────────────────────────────────────

export function RecallTab({ recalls }: { recalls: RecallDue[] }) {
  if (recalls.length === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground">No recall records.</p>;
  }
  return (
    <div className="rounded-lg border">
      <table className="w-full">
        <thead>
          <tr className="border-b bg-muted/50 text-left text-xs font-medium text-muted-foreground">
            <th className="px-4 py-3">Type</th>
            <th className="px-4 py-3">Due</th>
            <th className="px-4 py-3">Last visit</th>
            <th className="px-4 py-3">Scheduled</th>
            <th className="px-4 py-3">Status</th>
          </tr>
        </thead>
        <tbody>
          {recalls.map((r) => (
            <tr key={r.recallNum} className="border-b text-sm last:border-0 hover:bg-muted/30">
              <td className="px-4 py-3 font-medium">{r.recallTypeDesc}</td>
              <td className="px-4 py-3">{fmtDate(r.dateDue)}</td>
              <td className="px-4 py-3 text-muted-foreground">{fmtDate(r.datePrevious)}</td>
              <td className="px-4 py-3">
                {r.dateScheduled ? (
                  <Badge variant="outline" className="badge-scheduled">{fmtDate(r.dateScheduled)}</Badge>
                ) : (
                  <span className="text-muted-foreground">Not booked</span>
                )}
              </td>
              <td className="px-4 py-3 text-muted-foreground">
                {r.isDisabled ? "Disabled" : r.recallStatusDesc}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
