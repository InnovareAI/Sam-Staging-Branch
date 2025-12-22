"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import { ChevronDownIcon, ChevronRightIcon } from "lucide-react";
import { useScroll, cancelFrame, frame } from "motion/react";
import { ReactLenis } from "lenis/react";
import type { LenisRef } from "lenis/react";

import { Button } from "@/components/ui/button";
import ParallaxCardEffect from "@/components/core/parallax-card-effect";
import { cn } from "@/lib/utils";

const cardItems = [
  {
    title: "Urban Reflections",
    description:
      "An exploration of how cities shape our perception of light, shadow, and movement. Each frame reflects the rhythm of everyday urban life.",
    src: "https://plus.unsplash.com/premium_vector-1744029045529-3fcd4f715be6?q=80&w=2748&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
    className: "bg-red-200"
  },
  {
    title: "Wilderness Silence",
    description:
      "A visual journey into untouched landscapes where silence becomes the most powerful storyteller.",
    src: "https://plus.unsplash.com/premium_vector-1697729849330-ef5db47d3246?q=80&w=2814&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
    className: "bg-green-200"
  },
  {
    title: "Ocean Whispers",
    description:
      "Capturing the ever-changing moods of the sea, from calm horizons to raging storms that leave a timeless imprint.",
    src: "https://plus.unsplash.com/premium_vector-1697729780111-058eea198643?q=80&w=2648&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
    className: "bg-orange-200"
  },
  {
    title: "Desert Dreams",
    description:
      "Through vast emptiness and shifting sands, this project highlights the fragile beauty of desert environments.",
    src: "https://plus.unsplash.com/premium_vector-1721220820381-71da4f8b1adf?q=80&w=2360&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
    className: "bg-indigo-200"
  },
  {
    title: "Mountain Echoes",
    description:
      "The monumental presence of mountains and their interplay with light and atmosphere form the essence of this series.",
    src: "https://plus.unsplash.com/premium_vector-1725703994559-09c72f2a317d?q=80&w=2360&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
    className: "bg-purple-200"
  }
];

export type CardItemType = (typeof cardItems)[number];

export default function Page() {
  const lenisRef = useRef<LenisRef>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"]
  });

  useEffect(() => {
    function update(data: { timestamp: number }) {
      const time = data.timestamp;
      lenisRef.current?.lenis?.raf(time);
    }

    frame.update(update, true);

    return () => cancelFrame(update);
  }, []);

  const ParallaxCardItem = ({ item, id }: { item: CardItemType; id: number }) => {
    const targetScale = 1 - (cardItems.length - id) * 0.05;

    return (
      <ParallaxCardEffect
        id={id}
        progress={scrollYProgress}
        range={[id * 0.25, 1]}
        targetScale={targetScale}
        className={cn("relative flex flex-col rounded-lg px-14 py-8", item.className)}>
        <div className="space-y-4 text-center">
          <h2 className="text-center text-2xl font-semibold">{item.title}</h2>
          <p>{item.description}</p>
          <Button>
            See more <ChevronRightIcon />
          </Button>
        </div>
      </ParallaxCardEffect>
    );
  };

  return (
    <>
      <ReactLenis root options={{ autoRaf: false }} ref={lenisRef} />
      <div ref={containerRef}>
        <div className="flex h-screen items-center justify-center gap-2 text-xl">
          Scroll <ChevronDownIcon />
        </div>
        <div className="mx-auto max-w-2xl pt-14">
          {cardItems.map((cardItem, i) => (
            <ParallaxCardItem item={cardItem} key={i} id={i} />
          ))}
        </div>
      </div>
    </>
  );
}
