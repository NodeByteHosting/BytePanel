import type { EggDefinition } from "./egg";
import { GB } from "./egg";

const REGISTRY = "ghcr.io/nodebytehosting";

const runtime = (input: {
  description: string;
  dockerImages: Record<string, string>;
  fileVariable: { default: string; description: string; env: string; name: string };
  name: string;
  slug: string;
  startup: string;
}): EggDefinition => ({
  containerUser: "daemon",
  description: input.description,
  dockerImages: input.dockerImages,
  done: [],
  invocationMode: "env",
  minDiskMb: GB,
  minMemoryMb: 512,
  mountPath: "/home/container",
  name: input.name,
  nest: "Runtimes",
  slug: input.slug,
  startup: input.startup,
  stop: "^C",
  variables: [{ ...input.fileVariable, rules: "required|string|max:200" }],
});

const operatingSystem = (input: {
  description: string;
  dockerImages: Record<string, string>;
  name: string;
  slug: string;
}): EggDefinition => ({
  containerUser: "daemon",
  description: input.description,
  dockerImages: input.dockerImages,
  done: [],
  invocationMode: "env",
  minDiskMb: GB,
  minMemoryMb: 256,
  mountPath: "/home/container",
  name: input.name,
  nest: "Operating Systems",
  slug: input.slug,
  startup: "",
  stop: "exit",
  variables: [],
});

export const runtimeEggs: EggDefinition[] = [
  runtime({
    description: "Run a Node.js app. Upload your files, then start the server.",
    dockerImages: {
      "Node.js 22": `${REGISTRY}/nodejs:nodejs_22`,
      "Node.js 20 (older)": `${REGISTRY}/nodejs:nodejs_20`,
    },
    fileVariable: {
      default: "index.js",
      description: "The file to run, relative to the server folder.",
      env: "MAIN_FILE",
      name: "Main file",
    },
    name: "Node.js",
    slug: "nodejs",
    startup: "node {{MAIN_FILE}}",
  }),
  runtime({
    description: "Run a Bun app. Upload your files, then start the server.",
    dockerImages: {
      Bun: `${REGISTRY}/bun:bun_latest`,
      "Bun canary": `${REGISTRY}/bun:bun_canary`,
    },
    fileVariable: {
      default: "index.ts",
      description: "The file to run, relative to the server folder.",
      env: "MAIN_FILE",
      name: "Main file",
    },
    name: "Bun",
    slug: "bun",
    startup: "bun run {{MAIN_FILE}}",
  }),
  runtime({
    description: "Run a Python app. Upload your files, then start the server.",
    dockerImages: {
      "Python 3.9": `${REGISTRY}/python:python_3.9`,
      "Python 3.8 (older)": `${REGISTRY}/python:python_3.8`,
      "Python 3.7 (older)": `${REGISTRY}/python:python_3.7`,
    },
    fileVariable: {
      default: "app.py",
      description: "The file to run, relative to the server folder.",
      env: "MAIN_FILE",
      name: "Main file",
    },
    name: "Python",
    slug: "python",
    startup: "python {{MAIN_FILE}}",
  }),
  runtime({
    description: "Run a compiled Go program. Upload the binary, then start the server.",
    dockerImages: {
      "Go 1.23": `${REGISTRY}/go:go_1.23`,
      "Go 1.22 (older)": `${REGISTRY}/go:go_1.22`,
      "Go 1.21 (older)": `${REGISTRY}/go:go_1.21`,
    },
    fileVariable: {
      default: "app",
      description: "The binary to run, relative to the server folder.",
      env: "EXECUTABLE",
      name: "Executable",
    },
    name: "Go",
    slug: "go",
    startup: "./{{EXECUTABLE}}",
  }),
  runtime({
    description: "Run a Java application. Upload your jar, then start the server.",
    dockerImages: {
      "Java 21": `${REGISTRY}/java:java_21`,
      "Java 25 (newer)": `${REGISTRY}/java:java_25`,
      "Java 17 (older)": `${REGISTRY}/java:java_17`,
      "Java 11 (older)": `${REGISTRY}/java:java_11`,
    },
    fileVariable: {
      default: "server.jar",
      description: "The jar to run, relative to the server folder.",
      env: "JARFILE",
      name: "Jar file",
    },
    name: "Java",
    slug: "java",
    startup: "java -XX:MaxRAMPercentage=90 -jar {{JARFILE}}",
  }),
  operatingSystem({
    description: "A Debian container with a shell in the console.",
    dockerImages: { Debian: `${REGISTRY}/oses:debian` },
    name: "Debian",
    slug: "debian",
  }),
  operatingSystem({
    description: "An Ubuntu container with a shell in the console.",
    dockerImages: {
      "Ubuntu 24.04": `${REGISTRY}/oses:ubuntu_24.04`,
      "Ubuntu 26.04 (newer)": `${REGISTRY}/oses:ubuntu_26.04`,
      "Ubuntu 22.04 (older)": `${REGISTRY}/oses:ubuntu_22.04`,
    },
    name: "Ubuntu",
    slug: "ubuntu",
  }),
  operatingSystem({
    description: "A small Alpine Linux container with a shell in the console.",
    dockerImages: { Alpine: `${REGISTRY}/oses:alpine` },
    name: "Alpine",
    slug: "alpine",
  }),
];
