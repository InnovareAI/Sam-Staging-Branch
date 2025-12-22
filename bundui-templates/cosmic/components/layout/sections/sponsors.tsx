import { sponsors } from "@/@data/sponsors";
import Icon from "@/components/icon";
import { InfiniteSlider } from "@/components/ui/extras/infinite-slider";

export const SponsorsSection = () => {
  return (
    <section className="pb-12 lg:pb-24">
      <div className="container mask-r-from-50% mask-r-to-90% mask-l-from-50% mask-l-to-90%">
        <InfiniteSlider gap={50} speedOnHover={40}>
          {sponsors.map(({ icon, name }) => (
            <div key={name} className="flex items-center text-xl font-medium md:text-2xl">
              <Icon name={icon} className="text-foreground mr-3 size-6" />
              {name}
            </div>
          ))}
        </InfiniteSlider>
      </div>
    </section>
  );
};
