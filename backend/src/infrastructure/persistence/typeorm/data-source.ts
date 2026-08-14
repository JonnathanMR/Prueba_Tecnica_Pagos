import 'dotenv/config';

import { DataSource } from 'typeorm';

import { InitialSchema1786665600000 } from './migrations/1786665600000-initial-schema';

function databasePort(value: string | undefined): number {
  const port = Number(value ?? 5432);

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('DB_PORT must be a valid TCP port.');
  }

  return port;
}

export const appDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST ?? 'localhost',
  port: databasePort(process.env.DB_PORT),
  username: process.env.DB_USERNAME ?? 'payment_user',
  password: process.env.DB_PASSWORD ?? 'payment_password',
  database: process.env.DB_NAME ?? 'payment_checkout',
  synchronize: false,
  migrations: [InitialSchema1786665600000],
  migrationsTableName: 'schema_migrations',
  migrationsTransactionMode: 'all',
});
