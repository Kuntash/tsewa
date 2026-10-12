import { AsyncLocalStorage } from "node:async_hooks";

export type RequestTiming = { databaseMs: number; databaseCalls: number };

// Collects how long the current request spent waiting on the database.
export const requestTiming = new AsyncLocalStorage<RequestTiming>();

const EXECUTORS = new Set<string | symbol>(["all", "run", "raw", "first"]);
const statements = new WeakMap<object, D1PreparedStatement>();

async function timed<Result>(run: () => Promise<Result>): Promise<Result> {
  const timing = requestTiming.getStore();
  if (!timing) return run();
  const startedAt = performance.now();
  try {
    return await run();
  } finally {
    // Queries that run side by side each add their own wait, so this can exceed the request time.
    timing.databaseMs += performance.now() - startedAt;
    timing.databaseCalls += 1;
  }
}

function timedStatement(statement: D1PreparedStatement): D1PreparedStatement {
  const proxy = new Proxy(statement, {
    get(target, property) {
      const value = Reflect.get(target, property, target) as unknown;
      if (typeof value !== "function") return value;
      const method = value as (...parameters: unknown[]) => unknown;
      if (property === "bind") {
        return (...parameters: unknown[]) =>
          timedStatement(method.apply(target, parameters) as D1PreparedStatement);
      }
      if (EXECUTORS.has(property)) {
        return (...parameters: unknown[]) =>
          timed(() => method.apply(target, parameters) as Promise<unknown>);
      }
      return method.bind(target);
    },
  });
  statements.set(proxy, statement);
  return proxy;
}

// Wraps a D1 binding so every query adds to the current request's timing.
export function timedDatabase(database: D1Database): D1Database {
  return new Proxy(database, {
    get(target, property) {
      const value = Reflect.get(target, property, target) as unknown;
      if (typeof value !== "function") return value;
      const method = value as (...parameters: unknown[]) => unknown;
      if (property === "prepare") {
        return (query: string) => timedStatement(target.prepare(query));
      }
      if (property === "batch") {
        return (batch: D1PreparedStatement[]) =>
          timed(() =>
            target.batch(batch.map((statement) => statements.get(statement) ?? statement)),
          );
      }
      return method.bind(target);
    },
  });
}
