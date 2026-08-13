import { sql } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import { SQLiteAsyncDialect } from "drizzle-orm/sqlite-core";

import { createDatabase } from "@/db/client";
import type { Database } from "@/db/client";

type BindValue = string | number | boolean | null | undefined | ArrayBuffer | Uint8Array;

export class DrizzleStatement {
  readonly #database: Database;
  readonly #query: string;
  readonly #values: BindValue[];

  constructor(database: Database, query: string, values: BindValue[] = []) {
    this.#database = database;
    this.#query = query;
    this.#values = values;
  }

  bind(...values: BindValue[]): DrizzleStatement {
    return new DrizzleStatement(this.#database, this.#query, values);
  }

  async first<T>(): Promise<T | null> {
    return (await this.#database.get<T>(this.toSQL())) ?? null;
  }

  async all<T>(): Promise<{ results: T[] }> {
    return { results: await this.#database.all<T>(this.toSQL()) };
  }

  run(): Promise<D1Result> {
    return this.#database.run(this.toSQL());
  }

  toSQL(): SQL {
    const parts = this.#query.split("?");
    if (parts.length - 1 !== this.#values.length) {
      throw new Error(
        `SQL binding mismatch: expected ${parts.length - 1}, received ${this.#values.length}.`,
      );
    }
    const query = sql.raw(parts[0] ?? "");
    for (const [index, value] of this.#values.entries()) {
      query.append(sql`${value ?? null}`).append(sql.raw(parts[index + 1] ?? ""));
    }
    return query;
  }
}

export class QueryDatabase {
  readonly #database: Database;
  readonly #dialect = new SQLiteAsyncDialect();

  constructor(database: D1Database) {
    this.#database = createDatabase(database);
  }

  prepare(query: string): DrizzleStatement {
    return new DrizzleStatement(this.#database, query);
  }

  batch(statements: DrizzleStatement[]): Promise<unknown[]> {
    return this.#database.$client.batch(
      statements.map((statement) => {
        const query = this.#dialect.sqlToQuery(statement.toSQL());
        return this.#database.$client.prepare(query.sql).bind(...query.params);
      }),
    );
  }
}
