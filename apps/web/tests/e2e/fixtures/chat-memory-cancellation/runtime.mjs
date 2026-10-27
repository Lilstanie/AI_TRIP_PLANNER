let database;
let writeStarted;
let transactionFinished;
let releaseWrite;
let writeGate;
let finishTransaction;
let started;

export function configure(databaseValue) {
  database = databaseValue;
  writeGate = new Promise((resolve) => (releaseWrite = resolve));
  writeStarted = new Promise((resolve) => (started = resolve));
  transactionFinished = new Promise((resolve) => (finishTransaction = resolve));
}

export function waitForWrite() {
  return writeStarted;
}

export function waitForTransactionFinish() {
  return transactionFinished;
}

export function releaseBlockedWrite() {
  releaseWrite();
}

export const getDb = () => database;
export const dbEnabled = () => true;
export const authEnabled = true;
export const auth = async () => ({ userId: "cancellation-user" });
export const accountMemoryEnabled = async () => true;
export const requestDataMode = async () => "mock";
export const NextResponse = { json: (body, init) => Response.json(body, init) };
export const createToolGateway = () => ({ booking: {} });
export const runWithDataMode = (_mode, operation) => operation();
export const tripStore = { set: async () => undefined };
export const memory = { getShortTerm: async () => [], appendShortTerm: async () => undefined };

export function withMemoryTransaction(operation) {
  return database
    .transaction(async (transaction) => {
      const wrapQuery = (query) =>
        new Proxy(query, {
          get(builder, member) {
            if (member === "then")
              return (resolve, reject) =>
                builder.then(async (result) => {
                  started();
                  await writeGate;
                  return resolve(result);
                }, reject);
            const value = Reflect.get(builder, member, builder);
            return typeof value === "function"
              ? (...args) => wrapQuery(value.apply(builder, args))
              : value;
          },
        });
      const wrapped = new Proxy(transaction, {
        get(target, property) {
          if (property === "update") return (...args) => wrapQuery(target.update(...args));
          const value = Reflect.get(target, property, target);
          return typeof value === "function" ? value.bind(target) : value;
        },
      });
      return operation(wrapped);
    })
    .finally(finishTransaction);
}
