import {
  BookCoverImage,
  type BookCoverImageVariant,
} from "@/components/books/book-cover-image";
import type { EBook } from "@/lib/ebooks";

export function EBookCoverImage({
  ebook,
  variant = "thumbnail",
  className,
}: {
  ebook: EBook;
  variant?: BookCoverImageVariant;
  className?: string;
}) {
  return (
    <BookCoverImage
      title={ebook.title}
      author={ebook.authors}
      coverImageUrl={ebook.cover_image_url}
      coverImageAlt={ebook.cover_image_alt}
      variant={variant}
      className={className}
    />
  );
}
