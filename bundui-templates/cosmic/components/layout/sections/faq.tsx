import { FAQList } from "@/@data/faq";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import SectionHeader from "../section-header";
import SectionContainer from "../section-container";

export const FAQSection = () => {
  return (
    <SectionContainer>
      <SectionHeader subTitle="FAQS" title="Common Questions" />
      <div className="max-w-(--breakpoint-sm) mx-auto">
        <Accordion type="single" collapsible className="AccordionRoot">
          {FAQList.map(({ question, answer, value }) => (
            <AccordionItem key={value} value={value}>
              <AccordionTrigger className="text-left text-lg">
                {question}
              </AccordionTrigger>
              <AccordionContent className="text-base text-muted-foreground">{answer}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </SectionContainer>
  );
};
