import * as React from "react";
import { cn } from "@/lib/utils";

export interface CardProps
  extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "plain" | "shadow";
}

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant = "shadow", ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "rounded-lg bg-muted p-4 border shadow-sm",
        variant === "plain" && "border-none shadow-none",
        className
      )}
      {...props}
    />
  )
);
Card.displayName = "Card";

export { Card };
