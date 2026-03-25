import { redirect } from "next/navigation";

export default function LibrarianRootPage(): never {
  redirect("/librarian/dashboard");
}
