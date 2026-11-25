import { __will_be_noop_run__ } from "node:__will_be_noop_subprocess__";

export const killGroup = (pid: number) =>
  new Promise<void>((resolve) => {
    if (process.platform === "win32") {
      __will_be_noop_run__("taskkill", ["/pid", String(pid), "/t", "/f"], { stdio: "ignore" })
        .on("error", () => resolve())
        .on("exit", () => resolve());
      return;
    }
    try {
      process.kill(-pid, "SIGKILL");
    } catch {}
    resolve();
  });
