import DiscordIcon from "@/components/icons/discord-icon";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import SectionContainer from "@/components/layout/section-container";

export function CommunitySection() {
  return (
    <SectionContainer>
      <div className="mx-auto lg:max-w-(--breakpoint-lg)">
        <Card>
          <CardHeader>
            <CardTitle className="flex flex-col items-center text-3xl font-bold md:text-4xl">
              <DiscordIcon className="text-[#5e7ce9]" />
              <div>
                Ready to join this
                <span className="from-primary/60 to-primary bg-linear-to-b bg-clip-text pl-2 text-transparent">
                  Community?
                </span>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="text-muted-foreground mx-auto max-w-screen-sm space-y-4 text-center text-xl">
            <p>
              Join our vibrant Discord community! Connect, share, and grow with like-minded
              enthusiasts.
            </p>
          </CardContent>
          <CardFooter className="justify-center">
            <Button size="lg" asChild>
              <a href="https://discord.com/" target="_blank">
                Click to dive in!
              </a>
            </Button>
          </CardFooter>
        </Card>
      </div>
    </SectionContainer>
  );
}
