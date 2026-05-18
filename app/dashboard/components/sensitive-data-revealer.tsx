"use client";

import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface SensitiveDataRevealerProps {
  children: React.ReactNode;
  className?: string;
  sensitive?: boolean;
}

export const SensitiveDataRevealer = ({
  children,
  className,
  sensitive = true,
}: SensitiveDataRevealerProps) => {
  const [isRevealed, setIsRevealed] = useState(false);

  if (!sensitive) {
    return <>{children}</>;
  }

  return (
    <div
      className={cn(
        "relative rounded-lg border border-border/50 bg-muted/20 p-4",
        className
      )}
    >
      <div
        className={cn("transition-all duration-200", !isRevealed && "blur-sm")}
      >
        {children}
      </div>

      {!isRevealed && (
        <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-background/50 backdrop-blur-sm">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsRevealed(true)}
            className="gap-2"
          >
            <Eye className="h-4 w-4" />
            Reveal
          </Button>
        </div>
      )}

      {isRevealed && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsRevealed(false)}
          className="absolute top-2 right-2 gap-2"
        >
          <EyeOff className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
};
