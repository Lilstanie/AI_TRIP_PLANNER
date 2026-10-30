import { readdir } from "node:fs/promises";
import { resolve } from "node:path";
import ts from "typescript";

const methods = new Set(["GET", "POST", "PUT", "DELETE", "PATCH", "HEAD", "OPTIONS"]);

export function isAnonymousRefusal(result, method) {
  return (
    result.status === 401 &&
    (method === "HEAD" || result.body?.notice?.key === "Sign in to use your account.") &&
    result.headers["cache-control"] === "no-store"
  );
}

export async function apiRouteMethods(directory) {
  const files = [];
  const walk = async (directory, segments = []) => {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      if (entry.isDirectory() && !entry.name.startsWith("_")) {
        const next = /^\(.*\)$/.test(entry.name) ? segments : [...segments, entry.name];
        await walk(resolve(directory, entry.name), next);
      } else if (entry.name === "route.ts") {
        files.push({ file: resolve(directory, entry.name), path: `/api/${segments.join("/")}` });
      }
    }
  };
  await walk(directory);
  const configFile = ts.findConfigFile(directory, ts.sys.fileExists, "tsconfig.json");
  let options = {};
  if (configFile) {
    const config = ts.readConfigFile(configFile, ts.sys.readFile);
    if (config.error)
      throw new Error(ts.flattenDiagnosticMessageText(config.error.messageText, "\n"));
    options = ts.parseJsonConfigFileContent(
      config.config,
      ts.sys,
      resolve(configFile, ".."),
    ).options;
  }
  const program = ts.createProgram(
    files.map(({ file }) => file),
    {
      ...options,
      module: ts.ModuleKind.ESNext,
      moduleResolution: ts.ModuleResolutionKind.Bundler,
      noEmit: true,
    },
  );
  const checker = program.getTypeChecker();
  const runtimeMethods = (module, seen = new Set()) => {
    if (seen.has(module)) return new Set();
    seen.add(module);
    const found = new Set();
    for (const source of module.declarations || []) {
      if (!ts.isSourceFile(source)) continue;
      for (const symbol of checker.getExportsOfModule(module)) {
        const method = symbol.getName();
        if (!methods.has(method)) continue;
        if (!symbol.declarations?.some((declaration) => declaration.getSourceFile() === source))
          continue;
        if (symbol.declarations.some(ts.isTypeOnlyImportOrExportDeclaration)) continue;
        const value =
          symbol.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(symbol) : symbol;
        if (value.flags & ts.SymbolFlags.Value) found.add(method);
      }
      for (const statement of source.statements) {
        if (
          !ts.isExportDeclaration(statement) ||
          statement.isTypeOnly ||
          statement.exportClause ||
          !statement.moduleSpecifier
        )
          continue;
        const target = checker.getSymbolAtLocation(statement.moduleSpecifier);
        if (target) for (const method of runtimeMethods(target, seen)) found.add(method);
      }
    }
    return found;
  };
  const routes = [];
  for (const { file, path } of files) {
    const source = program.getSourceFile(file);
    const diagnostics = program.getSyntacticDiagnostics(source);
    if (diagnostics.length)
      throw new Error(
        `${path}: ${ts.flattenDiagnosticMessageText(diagnostics[0].messageText, "\n")}`,
      );
    const module = checker.getSymbolAtLocation(source);
    if (!module) continue;
    for (const method of runtimeMethods(module)) routes.push({ path, method });
  }
  return routes.sort((a, b) => a.path.localeCompare(b.path) || a.method.localeCompare(b.method));
}
