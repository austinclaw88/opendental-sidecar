"use client";

import { useEffect, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { InsuranceCoverage, PlanBenefits, benefitApi } from "@/lib/api";

function ordinalLabel(o: number) {
  return o === 1 ? "Primary" : o === 2 ? "Secondary" : o === 3 ? "Tertiary" : `#${o}`;
}

function money(n?: number) {
  if (n == null) return "—";
  return `$${n.toLocaleString("en-CA", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

export function BenefitsCard({
  patNum,
  coverage,
}: {
  patNum: number;
  coverage: InsuranceCoverage[];
}) {
  const [plans, setPlans] = useState<PlanBenefits[] | null>(null);
  const [error, setError] = useState("");
  const [open, setOpen] = useState<Set<number>>(new Set());

  useEffect(() => {
    let active = true;
    benefitApi
      .getByPatient(patNum)
      .then((d) => {
        if (active) setPlans(d);
      })
      .catch((e) => {
        if (active) setError(e instanceof Error ? e.message : "Could not load benefits.");
      });
    return () => {
      active = false;
    };
  }, [patNum]);

  if (error) return <p className="text-sm text-destructive">{error}</p>;
  if (!plans) return <p className="text-sm text-muted-foreground">Loading benefits…</p>;
  if (plans.length === 0) return null;

  const carrierFor = (p: PlanBenefits) =>
    coverage.find((c) => c.patPlanNum === p.patPlanNum)?.carrierName || p.carrierName || "Plan";

  const toggle = (n: number) =>
    setOpen((s) => {
      const x = new Set(s);
      if (x.has(n)) x.delete(n);
      else x.add(n);
      return x;
    });

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium text-muted-foreground">Benefits &amp; coverage</h3>
      <div className="grid gap-3 lg:grid-cols-2">
        {plans.map((p) => {
          const isOpen = open.has(p.patPlanNum);
          return (
            <div key={p.patPlanNum} className="rounded-lg border bg-card p-4">
              <div className="flex items-center gap-2">
                <span className="font-medium">{carrierFor(p)}</span>
                <span className="text-xs text-muted-foreground">{ordinalLabel(p.ordinal)}</span>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-3">
                <div className="rounded-md bg-muted/40 p-2.5">
                  <div className="text-xs text-muted-foreground">Annual maximum</div>
                  <div className="text-lg font-semibold">{money(p.annualMax)}</div>
                  {p.annualMaxPeriod && (
                    <div className="text-[11px] text-muted-foreground">
                      {p.annualMaxPeriod}
                      {p.annualMaxLevel ? ` · ${p.annualMaxLevel}` : ""}
                    </div>
                  )}
                </div>
                <div className="rounded-md bg-muted/40 p-2.5">
                  <div className="text-xs text-muted-foreground">Deductible</div>
                  <div className="text-lg font-semibold">{money(p.deductible)}</div>
                  {p.deductiblePeriod && (
                    <div className="text-[11px] text-muted-foreground">
                      {p.deductiblePeriod}
                      {p.deductibleLevel ? ` · ${p.deductibleLevel}` : ""}
                    </div>
                  )}
                </div>
              </div>

              {p.categories.length > 0 && (
                <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                  {p.categories.map((c, i) => (
                    <div key={i} className="flex justify-between gap-2">
                      <dt className="truncate text-muted-foreground">{c.category}</dt>
                      <dd className="font-medium">{c.percent}%</dd>
                    </div>
                  ))}
                </dl>
              )}

              {p.items.length > 0 && (
                <div className="mt-3">
                  <button
                    type="button"
                    onClick={() => toggle(p.patPlanNum)}
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                  >
                    {isOpen ? (
                      <ChevronDown className="h-3.5 w-3.5" />
                    ) : (
                      <ChevronRight className="h-3.5 w-3.5" />
                    )}
                    All benefit lines ({p.items.length})
                  </button>
                  {isOpen && (
                    <div className="mt-2 overflow-hidden rounded-md border">
                      <table className="w-full text-xs">
                        <thead className="bg-muted/40 text-muted-foreground">
                          <tr>
                            <th className="px-2 py-1 text-left font-medium">Type</th>
                            <th className="px-2 py-1 text-left font-medium">Category</th>
                            <th className="px-2 py-1 text-right font-medium">Amount / %</th>
                            <th className="px-2 py-1 text-left font-medium">Period</th>
                          </tr>
                        </thead>
                        <tbody>
                          {p.items.map((it, i) => (
                            <tr key={i} className="border-t">
                              <td className="px-2 py-1">{it.type}</td>
                              <td className="px-2 py-1 text-muted-foreground">{it.category || "—"}</td>
                              <td className="px-2 py-1 text-right">
                                {it.percent != null
                                  ? `${it.percent}%`
                                  : it.amount != null
                                    ? money(it.amount)
                                    : "—"}
                              </td>
                              <td className="px-2 py-1 text-muted-foreground">
                                {it.period || "—"}
                                {it.level ? ` · ${it.level}` : ""}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
