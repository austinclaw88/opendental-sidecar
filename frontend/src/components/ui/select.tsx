import * as React from "react";
import { cn } from "@/lib/utils";
import { ChevronDown } from "lucide-react";

/**
 * Lightweight styled native select. Keeps the bundle small and works
 * everywhere a receptionist might run this (old front-desk PCs included).
 */
const Select = React.forwardRef<HTMLSelectElement, React.ComponentProps<"select">>(
  ({ className, children, ...props }, ref) => (
    <div className="relative min-w-0">
      <select
        ref={ref}
        className={cn(
          "h-9 w-full min-w-0 truncate appearance-none rounded-md border border-input bg-transparent px-3 pr-8 text-sm shadow-xs transition-colors",
          "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] focus-visible:outline-none",
          "disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
    </div>
  )
);
Select.displayName = "Select";

const Label = React.forwardRef<HTMLLabelElement, React.ComponentProps<"label">>(
  ({ className, ...props }, ref) => (
    <label
      ref={ref}
      className={cn("text-xs font-medium text-muted-foreground", className)}
      {...props}
    />
  )
);
Label.displayName = "Label";

export { Select, Label };
