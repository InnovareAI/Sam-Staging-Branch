"use client";

import { reviewList } from "@/@data/reviews";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardDescription, CardTitle } from "@/components/ui/card";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious
} from "@/components/ui/carousel";
import { Star } from "lucide-react";
import SectionContainer from "@/components/layout/section-container";
import SectionHeader from "@/components/layout/section-header";

export const TestimonialSection = () => {
  return (
    <SectionContainer id="testimonials">
      <SectionHeader
        subTitle="Testimonials"
        title="Loved by Teams Worldwide"
        description="Don't just take our word for it. See what our customers have to say about their experience."
      />
      <Carousel
        opts={{
          align: "start"
        }}
        className="relative mx-auto w-[80%] sm:w-[90%] lg:max-w-(--breakpoint-xl)">
        <CarouselContent>
          {reviewList.map((review) => (
            <CarouselItem key={review.name} className="md:basis-1/2 lg:basis-1/3">
              <Card className="bg-muted">
                <CardContent className="flex flex-col gap-4">
                  <div className="flex gap-1">
                    <Star className="size-4 fill-orange-400 text-orange-400" />
                    <Star className="size-4 fill-orange-400 text-orange-400" />
                    <Star className="size-4 fill-orange-400 text-orange-400" />
                    <Star className="size-4 fill-orange-400 text-orange-400" />
                    <Star className="size-4 fill-orange-400 text-orange-400" />
                  </div>
                  <p>{review.comment}</p>
                  <div className="flex flex-row items-center gap-4">
                    <Avatar className="size-12">
                      <AvatarImage src={review.image} alt="shadcn ui kit cosmic template" />
                      <AvatarFallback>SV</AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col space-y-1">
                      <CardTitle>{review.name}</CardTitle>
                      <CardDescription>{review.userName}</CardDescription>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </CarouselItem>
          ))}
        </CarouselContent>
        <CarouselPrevious />
        <CarouselNext />
      </Carousel>
    </SectionContainer>
  );
};
