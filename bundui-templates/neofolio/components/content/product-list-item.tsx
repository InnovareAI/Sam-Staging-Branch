import Image from "next/image";
import { Product } from "@/type/product";
import Link from "next/link";

export default function ProductListItem({ product }: { product: Product }) {
  return (
    <Link href={`/store/${product.slug}`} className="block space-y-4">
      <figure>
        <Image
          src={product.images[0]}
          width={300}
          height={300}
          className="aspect-[4-3] w-full rounded-lg"
          alt={product.title}
        />
      </figure>
      <div className="flex items-start justify-between gap-4 space-y-2">
        <div className="space-y-2">
          <h5 className="font-semibold">{product.title}</h5>
          <div className="text-muted-foreground text-sm">{product.description}</div>
        </div>
        <div className="bg-muted rounded-lg border px-2 py-1">${product.price}</div>
      </div>
    </Link>
  );
}
