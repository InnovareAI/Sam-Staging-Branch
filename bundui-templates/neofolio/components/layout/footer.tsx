import React from "react";
import Link from "next/link";

export default function Footer() {
  return (
    <footer className="text-muted-foreground py-6 text-sm">
      <div className="mx-auto flex items-center justify-between px-4">
        <div>© {new Date().getFullYear()} Neofolio</div>
        <div>
          Made by{" "}
          <Link href="https://bundui.io/" target="_blank">
            bundui.io
          </Link>
        </div>
      </div>
    </footer>
  );
}
