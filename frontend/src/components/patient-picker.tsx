"use client";

import { useEffect, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { PatientSummary, api } from "@/lib/api";
import { fmtDate } from "@/lib/format";

interface PatientPickerProps {
  value: PatientSummary | null;
  onChange: (patient: PatientSummary | null) => void;
  autoFocus?: boolean;
}

/** Debounced patient search with a dropdown result list. */
export function PatientPicker({ value, onChange, autoFocus }: PatientPickerProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PatientSummary[]>([]);
  const [open, setOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    if (query.trim().length < 2) {
      setResults([]);
      setOpen(false);
      return;
    }
    timer.current = setTimeout(() => {
      setSearching(true);
      api
        .searchPatients(query.trim(), 15)
        .then((r) => {
          setResults(r);
          setOpen(true);
        })
        .catch(() => setResults([]))
        .finally(() => setSearching(false));
    }, 250);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [query]);

  if (value) {
    return (
      <div className="flex min-w-0 items-center justify-between gap-2 rounded-md border bg-muted/40 px-3 py-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">
            {value.lName}, {value.fName}
            {value.preferred && <span className="ml-1 text-muted-foreground">({value.preferred})</span>}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            #{value.patNum}
            {value.birthdate && ` · Born ${fmtDate(value.birthdate)}`}
            {value.wirelessPhone && ` · ${value.wirelessPhone}`}
          </p>
        </div>
        <Button variant="ghost" size="icon" onClick={() => onChange(null)} aria-label="Clear patient" className="shrink-0">
          <X className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Search by name, phone, or chart number..."
          value={query}
          autoFocus={autoFocus}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => results.length > 0 && setOpen(true)}
        />
      </div>
      {open && (
        <div className="absolute z-50 mt-1 max-h-64 w-full overflow-y-auto rounded-md border bg-popover shadow-md">
          {searching && <p className="px-3 py-2 text-sm text-muted-foreground">Searching...</p>}
          {!searching && results.length === 0 && (
            <p className="px-3 py-2 text-sm text-muted-foreground">No patients found.</p>
          )}
          {results.map((p) => (
            <button
              key={p.patNum}
              type="button"
              className="flex w-full flex-col items-start px-3 py-2 text-left text-sm hover:bg-muted"
              onClick={() => {
                onChange(p);
                setOpen(false);
                setQuery("");
              }}
            >
              <span className="font-medium">
                {p.lName}, {p.fName}
                {p.preferred && <span className="ml-1 font-normal text-muted-foreground">({p.preferred})</span>}
              </span>
              <span className="text-xs text-muted-foreground">
                #{p.patNum}
                {p.birthdate && ` · Born ${fmtDate(p.birthdate)}`}
                {p.wirelessPhone && ` · ${p.wirelessPhone}`}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
