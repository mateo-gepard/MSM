/** Runtime backstop for secret-bearing modules when the `server-only` package is unavailable. */
export function assertServerOnly(moduleName: string): void {
  if (typeof window !== 'undefined') {
    throw new Error(`${moduleName} must not be imported into a browser bundle.`);
  }
}
