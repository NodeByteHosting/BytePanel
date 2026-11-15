"use client";
import { ConnectPanel } from "../components/connect-panel";
import { useServer } from "../components/server-context";

const JOIN_PASSWORD = /pass(?:word)?$|_pw$/iu;
const ADMIN_PASSWORD = /rcon|admin/iu;

const ConnectTab = () => {
  const { server } = useServer();
  const joinPassword =
    server.variables.find(
      (v) =>
        JOIN_PASSWORD.test(v.envVariable) &&
        !ADMIN_PASSWORD.test(v.envVariable) &&
        v.value
    )?.value ?? null;
  return (
    <ConnectPanel
      allocations={server.allocations}
      gameName={server.game?.name ?? "the game"}
      gameSlug={server.game?.slug ?? null}
      joinPassword={joinPassword}
    />
  );
};

export default ConnectTab;
