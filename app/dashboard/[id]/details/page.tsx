"use client";
import { DetailsPanel } from "../components/details-panel";
import { useServer } from "../components/server-context";

const DetailsTab = () => {
  const { server } = useServer();
  return <DetailsPanel server={server} />;
};

export default DetailsTab;
