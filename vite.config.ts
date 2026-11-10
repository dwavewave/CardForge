import { createHash } from "node:crypto";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [
    react(),
    {
      name: "cardforge-offline-shell",
      apply: "build",
      async writeBundle(output) {
        const root = resolve(output.dir ?? "dist");
        const files = (
          await readdir(root, { recursive: true, withFileTypes: true })
        )
          .filter(
            (file) =>
              file.isFile() &&
              !file.name.startsWith(".") &&
              !["sw.js", "_headers"].includes(file.name),
          )
          .map((file) =>
            resolve(file.parentPath, file.name).slice(root.length + 1),
          )
          .sort();
        const worker = await readFile("scripts/service-worker.js", "utf8");
        const hash = createHash("sha256").update(worker);
        for (const file of files)
          hash.update(file).update(await readFile(resolve(root, file)));
        await writeFile(
          resolve(root, "sw.js"),
          `const BUILD_ID = "${hash.digest("hex")}";\nconst PRECACHE = ${JSON.stringify(files)};\n${worker}`,
        );
      },
    },
  ],
});
