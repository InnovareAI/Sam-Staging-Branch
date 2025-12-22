import { Badge } from "@/components/ui/badge";
import { ProService, serviceList } from "@/@data/services";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import SectionContainer from "@/components/layout/section-container";
import SectionHeader from "@/components/layout/section-header";

export const ServicesSection = () => {
  return (
    <SectionContainer id="solutions">
      <SectionHeader
        subTitle="Services"
        title="Grow Your Business"
        description="From marketing and sales to operations and strategy, we have the
          expertise to help you achieve your goals."
      />
      <div className="mx-auto grid w-full max-w-(--breakpoint-lg) gap-6 sm:grid-cols-2 lg:grid-cols-2">
        {serviceList.map(({ title, description, pro }) => (
          <Card key={title} className="bg-muted relative h-full gap-2">
            <CardHeader>
              <CardTitle className="text-lg">{title}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">{description}</p>
            </CardContent>
            <Badge
              data-pro={ProService.YES === pro}
              variant="secondary"
              className="absolute -top-2 -right-3 data-[pro=false]:hidden">
              PRO
            </Badge>
          </Card>
        ))}
      </div>
    </SectionContainer>
  );
};
