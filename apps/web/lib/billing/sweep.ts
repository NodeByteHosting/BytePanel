import { redis } from "@/lib/redis";

import { sweepSubscriptions } from "./service";

const INTERVAL_MS = 10 * 60 * 1000;
const LOCK_KEY = "billing:sweep";

let started = false;

const run = () =>
  redis
    .set(LOCK_KEY, "1", "EX", 540, "NX")
    .then((locked) => (locked ? sweepSubscriptions() : undefined))
    .catch(() => null);

export const startBillingSweep = () => {
  if (started) {
    return;
  }
  started = true;
  setInterval(run, INTERVAL_MS).unref();
  setTimeout(run, 30_000).unref();
};
