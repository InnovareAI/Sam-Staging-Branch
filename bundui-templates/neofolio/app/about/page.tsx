import Image from "next/image";
import ContactSection from "@/components/content/sections/contact-section";
import ServicesSection from "@/components/content/sections/services";
import ToolsSection from "@/components/content/sections/tools-section";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "About - Neofolio Template",
  description:
    "Dashboard style portfolio and directory website template. Built with Next.js, Tailwind CSS & shadcn/ui.",
  openGraph: {
    images: ["/seo.jpg"]
  }
};
export default function Page() {
  return (
    <>
      <section>
        <header className="mb-10 grid gap-4 space-y-4 pb-8 lg:grid-cols-3">
          <div className="order-2 col-span-2 lg:order-1">
            <h1 className="mb-6 flex flex-col text-4xl font-semibold">
              <span>Hello! I’m Toby</span> <span className="text-primary">Frontend Developer</span>
            </h1>
            <div className="space-y-4">
              <p className="text-muted-foreground text-lg">
                I’m Toby, a frontend developer and product development specialist from Poland with
                over 9 years of experience crafting seamless user interfaces and scalable design
                systems for SaaS products. My focus is on bridging the gap between user experience
                and technical implementation.
              </p>
              <p className="text-muted-foreground text-lg">
                Co-creator at Tetrisly, one of the most popular design system starter kits. I’ve
                collaborated with companies like Phenom.com, Bidroom.com, and Perfops.net, as well
                as numerous startups worldwide, to deliver innovative solutions as a Lead Developer
                and Technical Consultant.
              </p>
            </div>
          </div>
          <figure className="order-1 lg:order-2">
            <Image
              src="https://plus.unsplash.com/premium_photo-1664536392779-049ba8fde933?q=80&w=1974&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D"
              width={300}
              height={300}
              className="w-[450px] rounded-lg"
              alt="..."
            />
          </figure>
        </header>
      </section>
      <ServicesSection />
      <ToolsSection />
      <ContactSection />
    </>
  );
}
