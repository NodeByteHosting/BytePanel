import { redirect } from "next/navigation";

import { getBranding } from "@/lib/settings";

import { SignUpForm } from "./sign-up-form";

// External billing systems create accounts, so there's nothing to sign up for.
const SignUpPage = async () => {
  const { signUpEnabled } = await getBranding();
  if (!signUpEnabled) {
    redirect("/sign-in");
  }
  return <SignUpForm />;
};

export default SignUpPage;
