import BlogListItem from "@/components/content/blog-list-item";
import ContactSection from "@/components/content/sections/contact-section";
import { Blog } from "@/type/blog";
import { promises as fs } from "fs";
import { Metadata } from "next";
import path from "path";

async function getBlogs() {
  const data = await fs.readFile(path.join(process.cwd(), "data/blogs.json"));
  return JSON.parse(data.toString());
}

export const metadata: Metadata = {
  title: "Blog - Neofolio Template",
  description:
    "Dashboard style portfolio and directory website template. Built with Next.js, Tailwind CSS & shadcn/ui.",
  openGraph: {
    images: ["/seo.jpg"]
  }
};

export default async function Page() {
  const blogs = await getBlogs();

  return (
    <>
      <section>
        <header className="mb-10 space-y-3 lg:pb-8">
          <h1 className="text-3xl font-semibold">Blog</h1>
          <p className="text-muted-foreground">
            Explore cutting-edge design innovations that transform ideas into reality
          </p>
        </header>
        <div className="space-y-10">
          {blogs.map((blog: Blog) => (
            <BlogListItem blog={blog} key={blog.id} />
          ))}
        </div>
      </section>
      <ContactSection />
    </>
  );
}
