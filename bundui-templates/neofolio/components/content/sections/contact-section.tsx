import { Button } from "@/components/ui/button";
import { MailIcon, PhoneIcon } from "lucide-react";
import Link from "next/link";

export default function ContactSection() {
  return (
    <section className="rounded-lg border p-6 !pb-6">
      <header className="space-y-2 pb-8">
        <h2 className="text-2xl font-medium">Got questions?</h2>
        <p className="text-muted-foreground">
          I’m always excited to collaborate on innovative and exciting projects!
        </p>
      </header>
      <div className="grid space-y-6 lg:grid-cols-2 lg:space-y-0">
        <div className="flex gap-4">
          <span className="border-primary/10 bg-primary/10 flex size-14 items-center justify-center rounded-full border">
            <MailIcon className="size-5" />
          </span>
          <div className="flex flex-col gap-1">
            <span className="text-muted-foreground">E-mail</span>
            <Link href="#">contact@shadcnuikit.com</Link>
          </div>
        </div>
        <div className="flex gap-4">
          <span className="border-primary/10 bg-primary/10 flex size-14 items-center justify-center rounded-full border">
            <PhoneIcon className="size-5" />
          </span>
          <div className="flex flex-col gap-1">
            <span className="text-muted-foreground">Phone</span>
            <Link href="#">+48 555 555 555</Link>
          </div>
        </div>
      </div>
      <div className="mt-8">
        <Button variant="outline" className="w-full lg:w-auto" asChild>
          <Link href="https://cal.com/" target="_blank">
            Schedule a call
          </Link>
        </Button>
      </div>
    </section>
  );
}
