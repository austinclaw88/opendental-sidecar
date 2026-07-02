"use client";

import { useState } from "react";
import { Pencil, Plus, ShieldCheck, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FamilyMember, InsuranceCoverage, insuranceApi } from "@/lib/api";
import { fmtDate } from "@/lib/format";
import { InsuranceDialog } from "@/components/patient/insurance-dialog";
import { BenefitsCard } from "@/components/patient/benefits-card";

interface InsuranceTabProps {
  patNum: number;
  patientName: string;
  coverage: InsuranceCoverage[];
  family: FamilyMember[];
  onChanged: () => void;
}

export function InsuranceTab({ patNum, patientName, coverage, family, onChanged }: InsuranceTabProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<InsuranceCoverage | null>(null);
  const [dropping, setDropping] = useState<number | null>(null);
  const [error, setError] = useState("");

  const ordinalBadge = (o: number) => {
    const label = o === 1 ? "Primary" : o === 2 ? "Secondary" : o === 3 ? "Tertiary" : `#${o}`;
    return (
      <Badge variant="outline" className={o === 1 ? "badge-scheduled" : "badge-inactive"}>
        {label}
      </Badge>
    );
  };

  const drop = async (cov: InsuranceCoverage) => {
    if (!window.confirm(`Drop ${cov.carrierName} from this patient? The plan stays on file for claim history.`)) {
      return;
    }
    setDropping(cov.patPlanNum);
    setError("");
    try {
      await insuranceApi.dropCoverage(cov.patPlanNum);
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Drop failed.");
    } finally {
      setDropping(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {coverage.length === 0
            ? "No insurance coverage on file."
            : `${coverage.length} active coverage ${coverage.length === 1 ? "plan" : "plans"}.`}
        </p>
        <Button
          size="sm"
          onClick={() => {
            setEditing(null);
            setDialogOpen(true);
          }}
        >
          <Plus className="h-4 w-4" />
          Add Insurance
        </Button>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {coverage.length > 0 && (
        <div className="grid gap-3 lg:grid-cols-2">
          {coverage.map((c) => (
            <div key={c.patPlanNum} className="rounded-lg border bg-card p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-primary" />
                  <span className="font-medium">{c.carrierName}</span>
                  {ordinalBadge(c.ordinal)}
                  {c.dateTerm && (
                    <Badge variant="outline" className="badge-denied">
                      Terminated {fmtDate(c.dateTerm)}
                    </Badge>
                  )}
                </div>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    title="Edit coverage"
                    onClick={() => {
                      setEditing(c);
                      setDialogOpen(true);
                    }}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive"
                    title="Drop coverage"
                    disabled={dropping === c.patPlanNum}
                    onClick={() => drop(c)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>

              <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
                <dt className="text-muted-foreground">Subscriber</dt>
                <dd>
                  {c.subscriberName}
                  <span className="ml-1 text-xs text-muted-foreground">({c.relationshipDesc})</span>
                </dd>
                <dt className="text-muted-foreground">Member ID</dt>
                <dd>{c.subscriberId || "—"}</dd>
                <dt className="text-muted-foreground">Group</dt>
                <dd>
                  {c.groupName || "—"}
                  {c.groupNum && <span className="ml-1 text-xs text-muted-foreground">#{c.groupNum}</span>}
                </dd>
                <dt className="text-muted-foreground">Carrier ID</dt>
                <dd>{c.electId || "—"}</dd>
                {c.carrierPhone && (
                  <>
                    <dt className="text-muted-foreground">Carrier phone</dt>
                    <dd>{c.carrierPhone}</dd>
                  </>
                )}
                {c.dateEffective && (
                  <>
                    <dt className="text-muted-foreground">Effective</dt>
                    <dd>{fmtDate(c.dateEffective)}</dd>
                  </>
                )}
                {c.feeSchedDesc && (
                  <>
                    <dt className="text-muted-foreground">Fee schedule</dt>
                    <dd>{c.feeSchedDesc}</dd>
                  </>
                )}
                {c.subscNote && (
                  <>
                    <dt className="text-muted-foreground">Note</dt>
                    <dd className="whitespace-pre-wrap">{c.subscNote}</dd>
                  </>
                )}
              </dl>
            </div>
          ))}
        </div>
      )}

      {coverage.length > 0 && <BenefitsCard patNum={patNum} coverage={coverage} />}

      <InsuranceDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        patNum={patNum}
        patientName={patientName}
        family={family}
        editing={editing}
        onSaved={onChanged}
      />
    </div>
  );
}
