import Image from "next/image";
import { CheckIcon, ChevronRight } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BackgroundBeamsWithCollision } from "@/components/ui/extras/background-beams-with-collision";

export const HeroSection = () => {
  return (
    <section className="container w-full">
      <div className="mx-auto grid place-items-center py-16 pb-8 md:py-32 md:pb-14 lg:max-w-(--breakpoint-xl)">
        <BackgroundBeamsWithCollision>
          <div className="space-y-8 pb-8 text-center lg:pb-20">
            <Badge variant="outline" className="bg-muted py-2 text-sm">
              <span className="text-primary mr-2">
                <Badge className="bg-background text-foreground hover:bg-background">New</Badge>
              </span>
              <span> AI-Powered Optimization </span>
            </Badge>
            <div className="mx-auto max-w-(--breakpoint-md) text-center text-4xl font-bold md:text-6xl">
              <h1>Optimize Your Website with AI Support</h1>
            </div>
            <p className="text-muted-foreground mx-auto max-w-(--breakpoint-sm) text-xl">
              {`Meet our AI-powered SaaS solution to lighten your workload, increase efficiency and make more accurate decisions.`}
            </p>
            <div className="mt-8 flex flex-col justify-center gap-4 md:flex-row!">
              <Button className="h-12 px-10 text-base">
                Start Free Trial
                <ChevronRight />
              </Button>
              <Button variant="outline" className="h-12 px-10 text-base">
                Book a Demo
              </Button>
            </div>
            <div className="text-muted-foreground mt-6 flex flex-col items-center justify-center gap-4 text-sm md:flex-row!">
              <div className="flex items-center gap-1">
                <CheckIcon className="text-primary size-4" />
                <span>No credit card</span>
              </div>
              <div className="flex items-center gap-1">
                <CheckIcon className="text-primary size-4" />
                <span>14-day trial</span>
              </div>
              <div className="flex items-center gap-1">
                <CheckIcon className="text-primary size-4" />
                <span>Cancel anytime</span>
              </div>
            </div>
          </div>
        </BackgroundBeamsWithCollision>

        <div className="group relative">
          {/* blur effect */}
          <div className="bg-primary/60 absolute top-2 left-1/2 mx-auto h-24 w-[90%] -translate-x-1/2 transform rounded-full blur-3xl lg:-top-8 lg:h-80"></div>
          {/* blur effect */}

          <Image
            width={1240}
            height={1200}
            className="rouded-lg relative mx-auto flex w-full items-center rounded-lg mask-b-from-20% mask-b-to-90% leading-none"
            src="/hero.png"
            alt="shadcn landing page"
            unoptimized
          />
        </div>
      </div>
    </section>
  );
};
