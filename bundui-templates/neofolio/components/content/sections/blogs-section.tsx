import { Blog } from "@/type/blog";
import BlogListItem from "../blog-list-item";
import { promises as fs } from "fs";
import path from "path";

async function getBlogs() {
  const data = await fs.readFile(path.join(process.cwd(), "data/blogs.json"));
  return JSON.parse(data.toString());
}

export default async function BlogsSection() {
  const blogs = await getBlogs();

  return (
    <section>
      <header className="pb-8">
        <h2 className="text-2xl font-semibold">Blog</h2>
      </header>
      <div className="space-y-6 lg:space-y-10">
        {blogs.slice(0, 3).map((blog: Blog) => (
          <BlogListItem blog={blog} key={blog.id} />
        ))}
      </div>
    </section>
  );
}
