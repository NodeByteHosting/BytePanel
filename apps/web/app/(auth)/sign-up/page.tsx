import { redirect } from "next/navigation";

import { getBranding } from "@/lib/settings";

import { SignUpForm } from "./sign-up-form";

const SignUpPage = async () => {
  const { signUpEnabled } = await getBranding();
  if (!signUpEnabled) {
    redirect("/sign-in");
  }
  return <SignUpForm />;
};

export default SignUpPage;
