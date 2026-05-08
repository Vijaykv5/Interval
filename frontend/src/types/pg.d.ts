declare module "pg" {
  export class Pool {
    constructor(config?: unknown);
    on(event: string, listener: (...args: unknown[]) => void): void;
  }
}
