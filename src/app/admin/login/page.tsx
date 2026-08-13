import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { signedIn } from "@/lib/auth";
import LoginForm from "./form";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage() {
  if (await signedIn()) redirect("/admin");
  return <LoginForm />;
}
