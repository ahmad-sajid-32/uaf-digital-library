import { redirect } from "next/navigation";

export default function StudentRootPage(): never {
  redirect("/student/catalog");
}
