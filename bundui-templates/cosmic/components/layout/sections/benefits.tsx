import { benefitList } from "@/@data/benefits";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Icon from "@/components/icon";
import { cn } from "@/lib/utils";
import SectionContainer from "../section-container";
import SectionHeader from "../section-header";

export const BenefitsSection = () => {
  return (
    <SectionContainer id="benefits">
      <div className="grid lg:grid-cols-2 lg:gap-24">
        <div>
          <SectionHeader
            className="sticky max-w-full text-center lg:top-[22rem] lg:text-start"
            subTitle="Benefits"
            title="What Do We Bring to You?"
            description="All the innovative solutions you need to grow your business are
              here! We add value to your business with our features that
              simplify your workflow, increase efficiency and strengthen your
              decisions."
          />
        </div>

        <div className="flex w-full flex-col gap-6 lg:gap-[14rem]">
          {benefitList.map(({ icon, title, description }, index) => (
            <Card
              key={title}
              className={cn("group/number bg-background lg:sticky")}
              style={{ top: `${20 + index + 2}rem` }}>
              <CardHeader>
                <div className="flex justify-between">
                  <Icon
                    name={icon}
                    className="text-primary bg-primary/20 ring-primary/10 mb-6 size-10 rounded-full p-2 ring-8"
                  />
                  <span className="text-muted-foreground/15 group-hover/number:text-muted-foreground/30 text-5xl font-bold transition-all delay-75">
                    0{index + 1}
                  </span>
                </div>
                <CardTitle className="text-lg">{title}</CardTitle>
              </CardHeader>
              <CardContent className="text-muted-foreground">{description}</CardContent>
            </Card>
          ))}
        </div>
      </div>
    </SectionContainer>
  );
};
