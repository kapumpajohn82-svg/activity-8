import { cp, mkdir, writeFile } from "node:fs/promises";

const value = process.env.API_BASE_URL?.trim();
if (!value) throw new Error("Set API_BASE_URL to the deployed Activity 7 backend origin.");
const url = new URL(value);
if (url.protocol !== "https:" || url.pathname !== "/" || url.search || url.hash || url.username || url.password) {
  throw new Error("API_BASE_URL must be an HTTPS origin without credentials, a path, a query, or a fragment.");
}

const target = new URL("./_site/", import.meta.url);
await mkdir(target, { recursive: true });
for (const file of ["index.html", "css", "js"]) {
  await cp(new URL(file, import.meta.url), new URL(file, target), { recursive: true });
}
await writeFile(new URL("js/config.js", target), `export const API_BASE_URL = ${JSON.stringify(url.origin)};\n`);
