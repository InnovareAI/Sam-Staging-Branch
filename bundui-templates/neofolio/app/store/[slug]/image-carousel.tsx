"use client";

import Image from "next/image";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious
} from "@/components/ui/carousel";

export default function ImageCarousel({ images }: { images: string[] }) {
  return (
    <Carousel>
      <CarouselContent>
        {images.map((image, key) => (
          <CarouselItem key={key}>
            <figure>
              <Image
                width={300}
                height={300}
                src={image}
                className="aspect-[4/3] w-full"
                alt="..."
              />
            </figure>
          </CarouselItem>
        ))}
      </CarouselContent>
      <CarouselPrevious />
      <CarouselNext />
    </Carousel>
  );
}
