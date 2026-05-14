import { redirect } from "next/navigation";

// The "Backend" page (user Hetzner token management) has been removed now that
// NodeByte manages infrastructure centrally. Redirect users to the new billing page.
const BackendPage = () => {
  redirect("/dashboard/account/billing");
};

export default BackendPage;
