import path from "path";
import Link from "next/link";
import { promises as fs } from "fs";
import { ChevronRightIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Project } from "@/type/project";
import ProjectListItem from "@/components/content/project-list-item";

async function getProjects() {
  const data = await fs.readFile(path.join(process.cwd(), "data/projects.json"));
  return JSON.parse(data.toString());
}

export default async function SelectedProjectsSection() {
  const projects = await getProjects();
  return (
    <section>
      <header className="flex items-center justify-between pb-8">
        <h2 className="text-2xl font-medium">Selected Work</h2>
        <Button className="px-0!" variant="link" asChild>
          <Link href="/projects">
            View All <ChevronRightIcon />
          </Link>
        </Button>
      </header>
      <div className="grid gap-6 lg:grid-cols-2">
        {projects.slice(0, 2).map((project: Project) => (
          <ProjectListItem project={project} key={project.id} />
        ))}
      </div>
    </section>
  );
}
