"use client";

import { useState } from "react";
import Link from "next/link";
import { UserPlus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FamilyMember, PatientSummary, api, familyApi } from "@/lib/api";

interface FamilyPanelProps {
  family: FamilyMember[];
  currentPatNum: number;
  onChanged: () => void;
}

export function FamilyPanel({ family, currentPatNum, onChanged }: FamilyPanelProps) {
  const [busy, setBusy] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [addOpen, setAddOpen] = useState(false);

  const setGuarantor = async (patNum: number) => {
    setBusy(patNum);
    setError("");
    try {
      await familyApi.setGuarantor(patNum);
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not set guarantor.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {family.length} family member{family.length === 1 ? "" : "s"}
        </p>
        <Button size="sm" variant="outline" onClick={() => setAddOpen(true)}>
          <UserPlus className="h-4 w-4" />
          <span className="ml-1.5">Add family member</span>
        </Button>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="rounded-lg border">
        <table className="w-full">
          <thead>
            <tr className="border-b bg-muted/50 text-left text-xs font-medium text-muted-foreground">
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Age</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Mobile</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3" />
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
                  {m.isGuarantor && (
                    <Badge variant="outline" className="badge-scheduled">
                      Guarantor
                    </Badge>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  {!m.isGuarantor && (
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={busy !== null}
                      onClick={() => setGuarantor(m.patNum)}
                    >
                      {busy === m.patNum ? "Setting..." : "Set as guarantor"}
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <AddFamilyMemberDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        currentPatNum={currentPatNum}
        familyPatNums={family.map((m) => m.patNum)}
        onAdded={onChanged}
      />
    </div>
  );
}

function AddFamilyMemberDialog({
  open,
  onOpenChange,
  currentPatNum,
  familyPatNums,
  onAdded,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentPatNum: number;
  familyPatNums: number[];
  onAdded: () => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PatientSummary[]>([]);
  const [searching, setSearching] = useState(false);
  const [adding, setAdding] = useState<number | null>(null);
  const [error, setError] = useState("");

  const search = async () => {
    if (query.trim().length < 2) return;
    setSearching(true);
    setError("");
    try {
      const r = await api.searchPatients(query.trim(), 20);
      setResults(r.filter((p) => !familyPatNums.includes(p.patNum)));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Search failed.");
    } finally {
      setSearching(false);
    }
  };

  const add = async (patNum: number) => {
    setAdding(patNum);
    setError("");
    try {
      await familyApi.moveToFamily(patNum, currentPatNum);
      onOpenChange(false);
      setQuery("");
      setResults([]);
      onAdded();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not add to family.");
    } finally {
      setAdding(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add family member</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Search for an existing patient to move into this family. To add a brand-new
          person, create the patient first, then add them here.
        </p>
        <div className="flex gap-2">
          <Input
            placeholder="Search by name..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && search()}
          />
          <Button onClick={search} disabled={searching}>
            {searching ? "Searching..." : "Search"}
          </Button>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        {results.length > 0 && (
          <div className="max-h-64 overflow-y-auto rounded-md border">
            {results.map((p) => (
              <div
                key={p.patNum}
                className="flex items-center justify-between border-b px-3 py-2 text-sm last:border-0"
              >
                <div>
                  <span className="font-medium">
                    {p.lName}, {p.fName}
                  </span>
                  {p.birthdate && (
                    <span className="ml-2 text-xs text-muted-foreground">
                      DOB {p.birthdate.substring(0, 10)}
                    </span>
                  )}
                </div>
                <Button size="sm" variant="outline" disabled={adding !== null} onClick={() => add(p.patNum)}>
                  {adding === p.patNum ? "Adding..." : "Add"}
                </Button>
              </div>
            ))}
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
