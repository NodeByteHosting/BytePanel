"use client";
import Anser from "anser";
import { useMemo } from "react";
import { StickToBottom } from "use-stick-to-bottom";

import { cn } from "@/lib/utils";

import type { ConsoleLine } from "./daemon-socket";

const CARET_CSI = /\^\[\[(?<params>[0-9;]*)(?<cmd>[a-zA-Z])/gu;
const normalizeAnsi = (text: string) =>
  text.replaceAll(CARET_CSI, "\u001B[$<params>$<cmd>");

const AnsiPart = ({ part }: { part: Anser.AnserJsonEntry }) => {
  const style: React.CSSProperties = {};
  if (part.fg) {
    style.color = `rgb(${part.fg})`;
  }
  if (part.bg) {
    style.backgroundColor = `rgb(${part.bg})`;
  }
  if (part.decorations.includes("bold")) {
    style.fontWeight = "bold";
  }
  if (part.decorations.includes("italic")) {
    style.fontStyle = "italic";
  }
  if (part.decorations.includes("underline")) {
    style.textDecoration = "underline";
  }
  if (part.decorations.includes("dim")) {
    style.opacity = 0.7;
  }
  return <span style={style}>{part.content}</span>;
};

const getLineClass = (line: ConsoleLine) => {
  if (line.kind === "install") {
    return "text-zinc-400";
  }
  const { text } = line;
  if (text.includes("ERROR") || text.includes("FATAL")) {
    return "text-red-400";
  }
  if (text.includes("WARN")) {
    return "text-yellow-400";
  }
  if (text.includes("INFO")) {
    return "text-sky-400";
  }
  if (text.includes("DEBUG")) {
    return "text-purple-400";
  }
  return "text-zinc-300";
};

const AnsiLine = ({ line }: { line: ConsoleLine }) => {
  const parts = useMemo(
    () =>
      Anser.ansiToJson(normalizeAnsi(line.text), {
        json: true,
        remove_empty: true,
      }),
    [line.text]
  );
  const hasAnsiColors = parts.some((p) => p.fg || p.bg);

  return (
    <span
      className={cn(
        "wrap-anywhere whitespace-pre-wrap",
        !hasAnsiColors && getLineClass(line)
      )}
    >
      {line.kind === "install" && (
        <span className="mr-2 text-amber-500 select-none">[install]</span>
      )}
      {parts.map((part, i) => (
        <AnsiPart key={i} part={part} />
      ))}
    </span>
  );
};

export const ConsoleOutput = ({
  lines,
  placeholder,
}: {
  lines: ConsoleLine[];
  placeholder: string;
}) => (
  <StickToBottom
    className="flex min-h-0 w-full flex-1 flex-col overflow-hidden"
    initial="instant"
    resize="smooth"
  >
    <StickToBottom.Content className="flex flex-col gap-1 px-3 py-3 font-mono text-xs">
      {lines.length === 0 && (
        <span className="text-muted-foreground px-3 py-2 text-sm">
          {placeholder}
        </span>
      )}
      {lines.map((line) => (
        <AnsiLine key={line.id} line={line} />
      ))}
    </StickToBottom.Content>
  </StickToBottom>
);
