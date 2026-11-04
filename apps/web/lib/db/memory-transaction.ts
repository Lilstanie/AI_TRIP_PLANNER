import { Client } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import * as schema from "./schema";

const database = (client: Client) => drizzle(client, { schema });
export type Transaction = Parameters<Parameters<ReturnType<typeof database>["transaction"]>[0]>[0];

/**
 * Runs `operation` in one transaction on its own WebSocket client and always closes the client.
 * A dropped connection rejects the pending or next statement, so the transaction rolls back; the
 * client's `error` event is consumed so the drop cannot crash the process, and a client whose
 * connection already ended is not ended again, because the driver's `end()` then never settles.
 */
export async function withMemoryTransaction<T>(operation: (tx: Transaction) => Promise<T>) {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  client.on("error", () => undefined);
  let failed = false;
  let dropped = false;
  try {
    await client.connect();
    client.once("end", () => (dropped = true));
    return await database(client).transaction(operation);
  } catch (error) {
    failed = true;
    throw error;
  } finally {
    try {
      if (!dropped) await client.end();
    } catch (error) {
      if (!failed) throw error;
    }
  }
}
