#!/usr/bin/env node
// Entry point for `npx github:D3SPR/d3shboard`. The server is TypeScript that Node runs directly.
const [major, minor] = process.versions.node.split(".").map(Number);
if (major < 23 || (major === 23 && minor < 6)) {
  console.error(
    `The d3shboard bridge needs Node 23.6 or newer (this is Node ${process.versions.node}).\n` +
      `Install a newer Node from https://nodejs.org and try again.`,
  );
  process.exit(1);
}
await import("./server.ts");
