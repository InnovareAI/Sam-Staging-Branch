import React from "react";
import { cn } from "@/lib/utils";

interface Props {
  title: string | React.ReactNode;
  subTitle?: string;
  description?: string | React.ReactNode;
  className?: string;
}

export default function SectionHeader({ className, title, subTitle, description }: Props) {
  return (
    <header className={cn("mx-auto mb-6 max-w-(--breakpoint-sm) text-center lg:mb-12", className)}>
      {subTitle ? (
        <div className="from-primary/60 to-primary mb-4 bg-linear-to-b bg-clip-text font-semibold tracking-wider text-transparent uppercase">
          {subTitle}
        </div>
      ) : null}
      <h2 className="mb-4 text-3xl font-bold md:text-4xl">{title}</h2>
      {description ? <p className="text-muted-foreground mb-8 text-lg">{description}</p> : null}
    </header>
  );
}
