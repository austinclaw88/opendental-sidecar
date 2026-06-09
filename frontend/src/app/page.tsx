"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Search, User, Phone, CalendarDays, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { api, PatientSummary } from "@/lib/api";
import { cn } from "@/lib/utils";

export default function PatientSearchPage() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PatientSummary[] | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSearch = useCallback(async () => {
    if (!query.trim()) return;
    setLoading(true);
    try {
      const data = await api.searchPatients(query.trim());
      setResults(data);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [query]);

  const statusBadge = (status: number, desc: string) => {
    const cls = desc.toLowerCase() === "patient" ? "badge-patient"
      : desc.toLowerCase() === "inactive" ? "badge-inactive"
      : desc.toLowerCase() === "archived" ? "badge-archived"
      : "badge-inactive";
    return <Badge variant="outline" className={cls}>{desc}</Badge>;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Patient Search</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Search by name, patient number, phone, or date of birth.
        </p>
      </div>

      {/* Search Bar */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search patients..."
            className="pl-9"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          />
        </div>
        <Button onClick={handleSearch} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Search"}
        </Button>
      </div>

      {/* Results */}
      {results !== null && (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            {results.length === 0
              ? "No patients found."
              : `${results.length} patient${results.length === 1 ? "" : "s"} found.`}
          </p>
          {results.map((p) => (
            <Card
              key={p.patNum}
              className="cursor-pointer transition-shadow hover:shadow-md"
              onClick={() => router.push(`/patients/${p.patNum}`)}
            >
              <CardContent className="flex items-center gap-4 p-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
                  <User className="h-5 w-5 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">
                      {p.lName}, {p.fName}
                      {p.preferred && <span className="ml-1 text-muted-foreground">({p.preferred})</span>}
                    </span>
                    {statusBadge(p.patStatus, p.patStatusDesc)}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                    <span className="text-xs font-mono">#{p.patNum}</span>
                    {p.hmPhone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{p.hmPhone}</span>}
                    {p.birthdate && <span className="flex items-center gap-1"><CalendarDays className="h-3 w-3" />{new Date(p.birthdate).toLocaleDateString()}</span>}
                    {p.wirelessPhone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{p.wirelessPhone}</span>}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Empty state */}
      {results === null && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Search className="h-12 w-12 text-muted-foreground/30" />
          <p className="mt-4 text-sm text-muted-foreground">
            Enter a name, number, phone, or DOB to find a patient.
          </p>
        </div>
      )}
    </div>
  );
}
