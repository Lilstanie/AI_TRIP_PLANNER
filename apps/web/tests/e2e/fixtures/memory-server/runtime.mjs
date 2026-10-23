let database;
let userId;

export function configureMemoryFixture(db, account) {
  database = db;
  userId = account;
}

export const getDb = () => database;
export const dbEnabled = () => true;
export const authEnabled = true;
export const auth = async () => ({ userId });
