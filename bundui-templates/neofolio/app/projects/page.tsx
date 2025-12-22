import { Metadata } from "next";
import { promises as fs } from "fs";
import path from "path";
import ProjectListItem from "@/components/content/project-list-item";
import ContactSection from "@/components/content/sections/contact-section";
import { Project } from "@/type/project";

async function getProjects() {
  const data = await fs.readFile(path.join(process.cwd(), "data/projects.json"));
  return JSON.parse(data.toString());
}

export const metadata: Metadata = {
  title: "Projects - Neofolio Template",
  description:
    "Dashboard style portfolio and directory website template. Built with Next.js, Tailwind CSS & shadcn/ui.",
  openGraph: {
    images: ["/seo.jpg"]
  }
};

export default async function Page() {
  const projects = await getProjects();

  return (
    <>
      <section>
        <header className="space-y-3 pb-8 lg:mb-10">
          <h1 className="text-3xl font-semibold">Projects</h1>
          <p className="text-muted-foreground">
            Explore cutting-edge design innovations that transform ideas into reality
          </p>
        </header>
        <div className="grid gap-6 lg:grid-cols-2">
          {projects.map((project: Project) => (
            <ProjectListItem project={project} key={project.id} />
          ))}
        </div>
      </section>
      <ContactSection />
    </>
  );
}
