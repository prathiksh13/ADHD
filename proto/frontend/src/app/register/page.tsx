import type { Metadata } from "next";
import { RegisterForm } from "@/components/auth/register-form";

export const metadata: Metadata = {
  title: "Register",
  description: "Create a participant or guardian account for the EEG research platform.",
  robots: { index: false },
};

export default function RegisterPage() {
  return <RegisterForm />;
}
