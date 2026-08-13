// Minimal declarations for Node built-ins used only by the vitest suites.
// The worker itself compiles against @cloudflare/workers-types, which cannot
// coexist with the full @types/node global surface.
declare module "node:sqlite" {
  export class DatabaseSync {
    constructor(path: string);
    exec(sql: string): void;
    prepare(sql: string): {
      all(...args: unknown[]): unknown[];
      get(...args: unknown[]): unknown;
      run(...args: unknown[]): void;
    };
  }
}
declare module "node:fs" {
  export function readFileSync(path: string, encoding: "utf8"): string;
  export function readdirSync(path: string): string[];
}
declare module "node:path" {
  export function join(...parts: string[]): string;
  export function dirname(path: string): string;
}
declare module "node:url" {
  export function fileURLToPath(url: string | URL): string;
}
