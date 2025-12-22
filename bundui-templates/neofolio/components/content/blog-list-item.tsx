import Image from "next/image";
import { Button } from "../ui/button";
import { ChevronRightIcon } from "lucide-react";
import Link from "next/link";
import { Blog } from "@/type/blog";

export default function BlogListItem({ blog }: { blog: Blog }) {
  return (
    <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-3 lg:space-x-4">
      <div className="order-2 col-span-2 flex grow flex-col space-y-4 leading-none lg:order-1">
        <span className="text-muted-foreground text-sm">{blog.date}</span>
        <h4 className="text-2xl leading-relaxed font-medium">{blog.title}</h4>
        <hr />
        <div>
          <Button variant="link" className="h-auto px-0! py-0!" asChild>
            <Link href={`/blog/${blog.slug}`}>
              <ChevronRightIcon /> Read
            </Link>
          </Button>
        </div>
      </div>
      <Link href={`/blog/${blog.slug}`} className="order-1 block w-full lg:order-2">
        <figure className="lg:mb-0">
          <Image
            src={blog.image}
            width={300}
            height={300}
            className="aspect-square w-full rounded-lg object-cover"
            alt={blog.title}
          />
        </figure>
      </Link>
    </div>
  );
}
