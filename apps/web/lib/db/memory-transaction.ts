import { Client } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import * as schema from "./schema";

const database = (client: Client) => drizzle(client, { schema });
type Transaction = Parameters<Parameters<ReturnType<typeof database>["transaction"]>[0]>[0];

export async function withMemoryTransaction<T>(operation: (tx: Transaction) => Promise<T>) {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  let failed = false;
  try {
    await client.connect();
    return await database(client).transaction(operation);
  } catch (error) {
    failed = true;
    throw error;
  } finally {
    try {
      await client.end();
    } catch (error) {
      if (!failed) throw error;
    }
  }
}
