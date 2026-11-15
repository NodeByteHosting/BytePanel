import { redirect } from "next/navigation";

const BackendPage = () => {
  redirect("/dashboard/account/billing");
};

export default BackendPage;
