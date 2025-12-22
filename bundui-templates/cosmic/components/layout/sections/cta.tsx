"use client";

import Image from "next/image";
import { ChevronRight } from "lucide-react";

import { motion } from "motion/react";
import { Button } from "@/components/ui/button";

export function PricingCtaSection() {
  return (
    <div className="pt-10 lg:pt-20">
      <div className="from-muted to-muted/50 relative flex flex-col justify-between gap-4 overflow-hidden rounded-xl border bg-gradient-to-br lg:flex-row! lg:gap-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="flex max-w-lg flex-col gap-6 py-4 ps-4 pe-4 md:py-10 md:ps-10 md:pe-0">
          <h2 className="text-2xl font-bold tracking-tight md:text-3xl">
            Ready to Transform Your Website?
          </h2>
          <p className="text-muted-foreground md:text-lg">
            Join thousands of satisfied customers who have optimized their websites and boosted
            conversions with Metro&#39;s AI-powered platform.
          </p>
          <div className="flex flex-col gap-4 sm:flex-row!">
            <Button variant="outline">Schedule a Demo</Button>
            <Button>
              Start Free Trial
              <ChevronRight />
            </Button>
          </div>
        </motion.div>
        <figure className="relative h-75 w-full lg:mt-10">
          <Image
            fill
            className="bottom-0 self-end object-cover lg:rounded-tl-lg"
            src="/hero.png"
            alt="shadcn landing page"
            unoptimized
          />
        </figure>
      </div>
    </div>
  );
}
