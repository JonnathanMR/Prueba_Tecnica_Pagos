import 'dotenv/config';

import { readFileSync } from 'node:fs';
import { DataSource } from 'typeorm';

import { InitialSchema1786665600000 } from './migrations/1786665600000-initial-schema';

function databasePort(value: string | undefined): number {
  const port = Number(value ?? 5432);

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('DB_PORT must be a valid TCP port.');
  }

  return port;
}

function databaseSsl(
  value: string | undefined,
  certificatePath: string | undefined,
): false | { rejectUnauthorized: true; ca?: string } {
  if (value === undefined || value === 'false') return false;
  if (value === 'true') {
    return {
      rejectUnauthorized: true,
      ...(certificatePath === undefined ? {} : { ca: readFileSync(certificatePath, 'utf8') }),
    };
  }
  throw new Error('DB_SSL must be true or false.');
}

export const appDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST ?? 'localhost',
  port: databasePort(process.env.DB_PORT),
  username: process.env.DB_USERNAME ?? 'payment_user',
  password: process.env.DB_PASSWORD ?? 'payment_password',
  database: process.env.DB_NAME ?? 'payment_checkout',
  ssl: databaseSsl(process.env.DB_SSL, process.env.DB_SSL_CA_PATH),
  synchronize: false,
  migrations: [InitialSchema1786665600000],
  migrationsTableName: 'schema_migrations',
  migrationsTransactionMode: 'all',
});
