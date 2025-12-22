import { Service } from "@/type/service";

type ServiceListItemProps = { service: Service };

export default function ServiceListItem({ service }: ServiceListItemProps) {
  return (
    <div className="flex items-center gap-4">
      <span className="border-primary/10 bg-primary/10 flex size-12 items-center justify-center rounded-full border">
        {service.icon && <service.icon className="size-5" />}
      </span>
      <div className="flex flex-1 flex-col gap-1 lg:flex-row lg:items-center lg:gap-4">
        <span>{service.title}</span>
        <hr className="hidden grow lg:block" />
        <div className="text-muted-foreground text-sm lg:text-base">
          from <span className="text-foreground">{service.price}</span> per hour
        </div>
      </div>
    </div>
  );
}
