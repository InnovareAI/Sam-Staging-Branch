import React from "react";
import Link from "next/link";
import { ChevronLeftIcon } from "lucide-react";

import { Button } from "@/components/ui/button";

type BackButtonProps = {
  url: string;
};

export default function BackButton({ url }: BackButtonProps) {
  return (
    <div>
      <Button variant="outline" asChild>
        <Link href={url}>
          <ChevronLeftIcon /> Back to list
        </Link>
      </Button>
    </div>
  );
}
