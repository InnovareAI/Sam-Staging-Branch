import { Building2Icon, FolderCodeIcon, PaletteIcon } from "lucide-react";
import ServiceListItem from "../service-list-item";
import { Service } from "@/type/service";

const services: Service[] = [
  {
    title: "Product Design",
    price: "$90",
    icon: PaletteIcon
  },
  {
    title: "Frontend Development",
    price: "$100",
    icon: FolderCodeIcon
  },
  {
    title: "Branding",
    price: "$80",
    icon: Building2Icon
  }
];

export default function ServicesSection() {
  return (
    <section>
      <header className="pb-8">
        <h2 className="text-2xl font-medium">Services</h2>
      </header>
      <div className="space-y-6">
        {services.map((service, key) => (
          <ServiceListItem key={key} service={service} />
        ))}
      </div>
    </section>
  );
}
