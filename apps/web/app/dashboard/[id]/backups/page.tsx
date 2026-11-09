"use client";
import { BackupsPanel } from "../components/backups-panel";
import { useServer } from "../components/server-context";

const BackupsTab = () => {
  const { server } = useServer();
  return <BackupsPanel serverId={server.id} />;
};

export default BackupsTab;
