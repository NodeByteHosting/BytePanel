"use client";
import { createContext, useContext } from "react";
import type { ReactNode } from "react";

import type { ServerStatus } from "@/protocol";

export interface AllocationView {
  id: string;
  ip: string;
  alias: string | null;
  port: number;
  primary: boolean;
}

export interface VariableView {
  name: string;
  description: string;
  envVariable: string;
  value: string;
  defaultValue: string;
  rules: string;
  editable: boolean;
}

export interface ServerView {
  id: string;
  uuid: string;
  name: string;
  description: string | null;
  status: ServerStatus | null;
  errorReason: string | null;
  // Not yet placed on a node (awaiting payment / deployment, or a legacy VPS).
  deployed: boolean;
  game: {
    slug: string | null;
    name: string;
    image: string | null;
    dockerImages: Record<string, string>;
  } | null;
  image: string;
  startup: string;
  node: { name: string; location: string | null } | null;
  allocations: AllocationView[];
  limits: {
    memory: number;
    swap: number;
    disk: number;
    cpu: number;
    backupLimit: number;
    allocationLimit: number;
  };
  planName: string | null;
  variables: VariableView[];
}

interface Value {
  server: ServerView;
  updateServer: (patch: Partial<ServerView>) => void;
}

const ServerContext = createContext<Value | null>(null);

export const useServer = () => {
  const ctx = useContext(ServerContext);
  if (!ctx) {
    throw new Error("useServer must be used within ServerProvider");
  }
  return ctx;
};

export const ServerProvider = ({
  value,
  children,
}: {
  value: Value;
  children: ReactNode;
}) => <ServerContext.Provider value={value}>{children}</ServerContext.Provider>;

export const primaryAddress = (server: ServerView): string | null => {
  const primary = server.allocations.find((a) => a.primary);
  return primary ? `${primary.alias ?? primary.ip}:${primary.port}` : null;
};
