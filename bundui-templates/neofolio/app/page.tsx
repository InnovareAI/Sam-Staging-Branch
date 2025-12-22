import BlogsSection from "@/components/content/sections/blogs-section";
import ContactSection from "@/components/content/sections/contact-section";
import HeroSection from "@/components/content/sections/hero";
import ReviewsSection from "@/components/content/sections/reviews";
import SelectedProjectsSection from "@/components/content/sections/selected-works";
import ServicesSection from "@/components/content/sections/services";

export default function Page() {
  return (
    <>
      <HeroSection />
      <SelectedProjectsSection />
      <ServicesSection />
      <ReviewsSection />
      <BlogsSection />
      <ContactSection />
    </>
  );
}
