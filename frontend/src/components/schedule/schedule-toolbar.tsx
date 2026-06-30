"use client";

import { ChevronLeft, ChevronRight, Plus, RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { addDays, toDateInput } from "@/lib/format";

export type ScheduleView = "day" | "week";

type ScheduleToolbarProps = {
  date: string;
  view: ScheduleView;
  loading: boolean;
  onDateChange: (date: string) => void;
  onViewChange: (view: ScheduleView) => void;
  onRefresh: () => void;
  onNewAppointment: () => void;
};

export function ScheduleToolbar({
  date,
  view,
  loading,
  onDateChange,
  onViewChange,
  onRefresh,
  onNewAppointment,
}: ScheduleToolbarProps) {
  const currentDate = new Date(`${date}T00:00`);
  const stepDays = view === "week" ? 7 : 1;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Schedule</h1>
        <p className="text-sm text-muted-foreground">
          {currentDate.toLocaleDateString("en-CA", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
          })}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <div className="flex rounded-md border">
          <Button
            variant={view === "day" ? "secondary" : "ghost"}
            size="sm"
            className="rounded-r-none"
            onClick={() => onViewChange("day")}
          >
            Day
          </Button>
          <Button
            variant={view === "week" ? "secondary" : "ghost"}
            size="sm"
            className="rounded-l-none"
            onClick={() => onViewChange("week")}
          >
            Week
          </Button>
        </div>
        <Button
          variant="outline"
          size="icon"
          onClick={() => onDateChange(toDateInput(addDays(currentDate, -stepDays)))}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Input
          type="date"
          value={date}
          onChange={(e) => e.target.value && onDateChange(e.target.value)}
          className="w-40"
        />
        <Button
          variant="outline"
          size="icon"
          onClick={() => onDateChange(toDateInput(addDays(currentDate, stepDays)))}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
        <Button variant="outline" onClick={() => onDateChange(toDateInput(new Date()))}>
          Today
        </Button>
        <Button variant="outline" size="icon" onClick={onRefresh} title="Refresh schedule">
          <RefreshCcw className={cn("h-4 w-4", loading && "animate-spin")} />
        </Button>
        <Button onClick={onNewAppointment}>
          <Plus className="h-4 w-4" />
          <span className="ml-1.5">New Appointment</span>
        </Button>
      </div>
    </div>
  );
}
