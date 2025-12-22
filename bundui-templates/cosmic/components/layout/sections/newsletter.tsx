import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import SectionContainer from "@/components/layout/section-container";
import SectionHeader from "@/components/layout/section-header";

export function NewsletterSection() {
  return (
    <SectionContainer>
      <SectionHeader
        title={
          <>
            Join Our Daily{" "}
            <span className="from-primary/60 to-primary bg-linear-to-b bg-clip-text text-transparent">
              Newsletter
            </span>
          </>
        }
        description="Subscribe to receive the latest updates, insights, and exclusive
            offers directly to your inbox."
      />
      <form className="mx-auto flex w-full flex-col gap-4 md:w-6/12 md:flex-row md:gap-2 lg:w-4/12">
        <Input
          placeholder="contact@bundui.com"
          className="bg-muted/50 dark:bg-muted/80"
          aria-label="email"
        />
        <Button>Subscribe</Button>
      </form>
    </SectionContainer>
  );
}
