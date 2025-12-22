"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PricingCtaSection } from "@/components/layout/sections/cta";
import SectionContainer from "@/components/layout/section-container";
import SectionHeader from "@/components/layout/section-header";
import { AnimatedBackground } from "@/components/ui/extras/animated-background";
import { SlidingNumber } from "@/components/ui/extras/sliding-number";
import { Badge } from "@/components/ui/badge";

type Period = {
  label: string;
  value: string;
};

const periods = [
  { label: "Monthly", value: "monthly" },
  { label: "Annually", value: "annually" }
];

export const PricingSection = () => {
  const [selectedPeriod, setSelectedPeriod] = useState<Period>(periods[0]);

  const discountRatio = 0.2;

  const prices = [
    {
      name: "Starter",
      price: {
        monthly: 29,
        annually: Math.round(29 * 12 * discountRatio)
      },
      description: "Perfect for small websites and blogs.",
      features: ["Up to 5 pages", "Basic optimization", "Weekly reports", "Email support"],
      cta: "Start Free Trial"
    },
    {
      name: "Professional",
      price: {
        monthly: 79,
        annually: Math.round(79 * 12 * discountRatio)
      },
      description: "Ideal for growing businesses and e-commerce.",
      features: [
        "Up to 25 pages",
        "Advanced optimization",
        "Daily reports",
        "Priority email support",
        "SEO recommendations"
      ],
      cta: "Start Free Trial",
      popular: true
    },
    {
      name: "Enterprise",
      price: {
        monthly: 199,
        annually: Math.round(199 * 12 * discountRatio)
      },
      description: "For large websites with complex needs.",
      features: [
        "Unlimited pages",
        "Custom optimization rules",
        "Real-time monitoring",
        "24/7 phone & email support",
        "Advanced API access",
        "Custom integrations"
      ],
      cta: "Contact Sales"
    }
  ];

  return (
    <SectionContainer id="pricing">
      <SectionHeader
        subTitle="Pricing"
        title="Get Unlimitted Access"
        description="Enjoy unlimited access to all features and resources, empowering your
          business to grow without limits."
      />
      <div className="mx-auto max-w-5xl">
        <div className="flex justify-center">
          <div className="mb-8 flex justify-center rounded-lg border">
            <AnimatedBackground
              defaultValue={selectedPeriod.value}
              className="bg-background rounded-lg"
              onValueChange={(value) =>
                setSelectedPeriod(periods.find((p) => p.value === value) as Period)
              }
              transition={{
                ease: "easeInOut",
                duration: 0.2
              }}>
              {periods.map((period, index) => {
                return (
                  <Button key={index} data-id={period.value} variant="ghost">
                    {period.label}
                    {period.value === "annually" && (
                      <Badge className="ms-1 border-0 bg-transparent text-green-600">
                        Save {discountRatio * 100}%
                      </Badge>
                    )}
                  </Button>
                );
              })}
            </AnimatedBackground>
          </div>
        </div>
        <div className="grid gap-6 lg:grid-cols-3 lg:gap-8">
          {prices.map((plan, i) => (
            <Card
              key={i}
              className={cn("relative h-full overflow-hidden", {
                "border-primary!": plan.popular
              })}>
              {plan.popular && (
                <div className="bg-primary text-primary-foreground absolute top-0 right-0 rounded-bl-lg px-3 py-1 text-xs font-medium">
                  Most Popular
                </div>
              )}
              <CardHeader>
                <CardTitle>{plan.name}</CardTitle>
              </CardHeader>
              <CardContent className="flex h-full flex-col">
                <div className="flex items-baseline">
                  <span className="flex text-4xl font-bold">
                    $
                    <SlidingNumber
                      value={
                        selectedPeriod.value === "monthly"
                          ? plan.price.monthly
                          : plan.price.annually
                      }
                    />
                  </span>
                  <span className="text-muted-foreground ml-1 text-sm lowercase">
                    /{selectedPeriod.label}
                  </span>
                </div>
                <p className="text-muted-foreground mt-2">{plan.description}</p>
                <ul className="my-6 flex-grow space-y-3">
                  {plan.features.map((feature, j) => (
                    <li key={j} className="flex items-center">
                      <Check className="text-primary mr-2 size-4" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
                <Button variant={plan.popular ? "default" : "outline"}>{plan.cta}</Button>
              </CardContent>
            </Card>
          ))}
        </div>
        <PricingCtaSection />
      </div>
    </SectionContainer>
  );
};
