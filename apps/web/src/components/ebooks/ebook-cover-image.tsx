import Image from "next/image";
import type { EBook } from "@/lib/ebooks";

export function EBookCoverImage({ ebook }: { ebook: EBook }) {
  if (ebook.cover_image_url) {
    return <Image className="h-28 w-20 rounded-lg object-cover" src={ebook.cover_image_url} alt={ebook.cover_image_alt || `Cover for ${ebook.title}`} width={80} height={112} unoptimized />;
  }
  return <div className="flex h-28 w-20 items-center justify-center rounded-lg bg-muted px-2 text-center text-xs text-muted-foreground">No cover</div>;
}
