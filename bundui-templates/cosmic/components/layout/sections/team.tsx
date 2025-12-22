import React from "react";
import Image from "next/image";
import Link from "next/link";

import { teamList } from "@/@data/teams";
import GithubIcon from "@/components/icons/github-icon";
import LinkedInIcon from "@/components/icons/linkedin-icon";
import XIcon from "@/components/icons/x-icon";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardFooter,
  CardDescription
} from "@/components/ui/card";
import SectionContainer from "@/components/layout/section-container";
import SectionHeader from "@/components/layout/section-header";
import { Badge } from "@/components/ui/badge";

export function TeamSection() {
  const socialIcon = (socialName: string) => {
    switch (socialName) {
      case "LinkedIn":
        return <LinkedInIcon />;
      case "Github":
        return <GithubIcon />;
      case "X":
        return <XIcon />;
    }
  };

  return (
    <SectionContainer id="team">
      <SectionHeader subTitle="Team" title="The Company Dream Team" />
      <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {teamList.map(({ imageUrl, firstName, lastName, positions, socialNetworks }, index) => (
          <Card
            key={index}
            className="bg-muted group/hoverimg flex h-full flex-col overflow-hidden pt-0">
            <figure className="overflow-hidden">
              <Image
                src={imageUrl}
                width={300}
                height={300}
                className="aspect-square w-full object-cover saturate-0 transition-all duration-200 ease-linear group-hover/hoverimg:scale-[1.05] group-hover/hoverimg:saturate-100"
                alt="cosmic template"
                unoptimized
              />
            </figure>
            <CardHeader className="pt-0">
              <CardTitle className="text-lg">
                {firstName}
                <span className="text-primary ml-1">{lastName}</span>
              </CardTitle>
              <CardDescription>{positions.join(", ")}</CardDescription>
            </CardHeader>

            <CardFooter className="mt-auto space-x-4">
              {socialNetworks.map(({ name, url }, index) => (
                <Link
                  key={index}
                  href={url}
                  target="_blank"
                  className="transition-all hover:opacity-80">
                  {socialIcon(name)}
                </Link>
              ))}
            </CardFooter>
          </Card>
        ))}
      </div>
    </SectionContainer>
  );
}
