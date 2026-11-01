"use client";
import { DetailsPanel } from "../components/details-panel";
import { useServer } from "../components/server-context";
import { SftpPanel } from "../components/sftp-panel";

const DetailsTab = () => {
  const { server } = useServer();
  return (
    <div className="flex flex-col gap-6">
      <DetailsPanel server={server} />
      {server.sftp && <SftpPanel sftp={server.sftp} />}
    </div>
  );
};

export default DetailsTab;
