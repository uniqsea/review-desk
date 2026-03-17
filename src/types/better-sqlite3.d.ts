declare module "better-sqlite3" {
  type BindValue = string | number | bigint | Buffer | null;

  interface Statement<Result = unknown> {
    run(...params: BindValue[]): Result;
    get(...params: BindValue[]): Result;
    all(...params: BindValue[]): Result[];
  }

  interface Transaction<T extends (...args: never[]) => unknown> {
    (...args: Parameters<T>): ReturnType<T>;
  }

  export default class Database {
    constructor(filename: string);
    pragma(command: string): unknown;
    exec(sql: string): this;
    prepare<Result = unknown>(sql: string): Statement<Result>;
    transaction<T extends (...args: never[]) => unknown>(fn: T): Transaction<T>;
  }

  namespace Database {
    export type Database = InstanceType<typeof Database>;
  }
}
