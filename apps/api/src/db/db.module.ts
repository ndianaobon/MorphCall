import { Global, Inject, Module, type OnApplicationShutdown } from '@nestjs/common';
import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { ENV, type Env } from '../config/env.js';
import * as schema from './schema.js';

export type Db = PostgresJsDatabase<typeof schema>;
export const DB = Symbol('DB');
export const SQL_CLIENT = Symbol('SQL_CLIENT');

@Global()
@Module({
  providers: [
    {
      provide: SQL_CLIENT,
      inject: [ENV],
      useFactory: (env: Env) =>
        postgres(env.DATABASE_URL, {
          // Supabase transaction pooler (port 6543) does not support prepared statements.
          prepare: false,
          max: 10,
          idle_timeout: 20,
          // Generous: the pooler sits in another region and first connections can be slow.
          connect_timeout: 30,
        }),
    },
    {
      provide: DB,
      inject: [SQL_CLIENT],
      useFactory: (client: postgres.Sql): Db => drizzle(client, { schema }),
    },
  ],
  exports: [DB, SQL_CLIENT],
})
export class DbModule implements OnApplicationShutdown {
  constructor(@Inject(SQL_CLIENT) private readonly client: postgres.Sql) {}

  async onApplicationShutdown() {
    await this.client.end({ timeout: 5 });
  }
}
