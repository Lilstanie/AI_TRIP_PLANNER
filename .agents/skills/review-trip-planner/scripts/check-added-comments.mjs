import { execFileSync } from "node:child_process";
import { existsSync, lstatSync, readFileSync } from "node:fs";
import { extname, isAbsolute, relative, resolve, sep } from "node:path";
import ts from "typescript";

function parseComments(file, text) {
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
  if (source.parseDiagnostics.length) throw new Error(`Unparseable source: ${file}`);
  const comments = new Map();
  const collect = (position) => {
    for (const range of [
      ...(ts.getLeadingCommentRanges(text, position) ?? []),
      ...(ts.getTrailingCommentRanges(text, position) ?? []),
    ])
      comments.set(range.pos, range);
  };
  const visit = (node) => {
    collect(node.pos);
    collect(node.end);
    for (const child of node.getChildren(source)) visit(child);
  };
  visit(source);
  return { source, comments: [...comments.values()].sort((a, b) => a.pos - b.pos) };
}

function run() {
  const options = { paths: [] };
  const args = process.argv.slice(2);
  for (let i = 0; i < args.length; i += 2) {
    const key = args[i];
    const value = args[i + 1];
    if (!["--base", "--path", "--exceptions"].includes(key) || !value || value.startsWith("--")) {
      throw new Error(
        "Usage: --base <ref> --path <file> [--path <file> ...] [--exceptions <json-file>]",
      );
    }
    if (key === "--path") options.paths.push(value);
    else {
      const name = key.slice(2);
      if (options[name]) throw new Error(`Duplicate ${key}`);
      options[name] = value;
    }
  }
  if (!options.base || !options.paths.length)
    throw new Error("Both --base and --path are required");
  const git = (...gitArgs) =>
    execFileSync("git", gitArgs, { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
  const root = git("rev-parse", "--show-toplevel").trim();
  if (resolve(process.cwd()) !== resolve(root)) throw new Error("Run from the repository root");
  const base = git("rev-parse", "--verify", "--end-of-options", `${options.base}^{commit}`).trim();
  const head = git("rev-parse", "HEAD").trim();
  const normalize = (file) => {
    if (typeof file !== "string" || isAbsolute(file))
      throw new Error("Paths must be repository-relative");
    const path = relative(root, resolve(root, file));
    if (!path || path === ".." || path.startsWith(`..${sep}`) || path.startsWith(".git/")) {
      throw new Error(`Path outside the source scope: ${file}`);
    }
    let cursor = root;
    for (const part of path.split(sep)) {
      cursor = resolve(cursor, part);
      if (existsSync(cursor) && lstatSync(cursor).isSymbolicLink())
        throw new Error(`Symlink scope: ${file}`);
    }
    return path.split(sep).join("/");
  };
  const paths = [...new Set(options.paths.map(normalize))];
  const exceptions = options.exceptions ? JSON.parse(readFileSync(options.exceptions, "utf8")) : [];
  if (!Array.isArray(exceptions)) throw new Error("Exceptions must be an array");
  for (const entry of exceptions) {
    if (
      !entry ||
      typeof entry.text !== "string" ||
      !entry.text.trim() ||
      typeof entry.reason !== "string" ||
      !entry.reason.trim()
    ) {
      throw new Error("Every exception needs file, exact text and a nonempty reason");
    }
    entry.file = normalize(entry.file);
    if (!paths.includes(entry.file))
      throw new Error(`Exception outside selected scope: ${entry.file}`);
  }
  const report = { base, head, paths, violations: [], allowed: [] };
  for (const file of paths) {
    if (!/\.(?:[cm]?[jt]s|[jt]sx)$/.test(extname(file)))
      throw new Error(`Unsupported source file: ${file}`);
    const tracked = git("ls-tree", "-r", "--name-only", base, "--", `:(literal)${file}`).trim();
    if (!existsSync(file)) {
      if (tracked) continue;
      throw new Error(`Missing scope file: ${file}`);
    }
    if (!lstatSync(file).isFile()) throw new Error(`Scope must be a file: ${file}`);
    const text = readFileSync(file, "utf8");
    const { source, comments } = parseComments(file, text);
    const previous = new Map();
    if (tracked) {
      const oldText = git("show", `${base}:${file}`);
      for (const range of parseComments(file, oldText).comments) {
        const oldComment = oldText.slice(range.pos, range.end);
        previous.set(oldComment, (previous.get(oldComment) ?? 0) + 1);
      }
    }
    const added = new Set();
    if (!tracked) {
      text.split("\n").forEach((_, index) => added.add(index + 1));
    } else {
      const diff = git(
        "diff",
        "--no-ext-diff",
        "--no-textconv",
        "--unified=0",
        base,
        "--",
        `:(literal)${file}`,
      );
      for (const match of diff.matchAll(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/gm)) {
        const first = Number(match[1]);
        const count = match[2] === undefined ? 1 : Number(match[2]);
        for (let line = first; line < first + count; line++) added.add(line);
      }
    }
    const positioned = comments.map((range) => {
      const start = source.getLineAndCharacterOfPosition(range.pos).line + 1;
      const end = source.getLineAndCharacterOfPosition(range.end - 1).line + 1;
      return {
        file,
        start,
        end,
        text: text.slice(range.pos, range.end),
        changed: [...added].some((line) => line >= start && line <= end),
      };
    });
    positioned.sort((a, b) => Number(a.changed) - Number(b.changed) || a.start - b.start);
    for (const { changed, ...comment } of positioned) {
      const commentText = comment.text;
      const retained = previous.get(commentText) ?? 0;
      if (retained) {
        previous.set(commentText, retained - 1);
        continue;
      }
      if (!changed) continue;
      const exception = exceptions.find(
        (entry) => entry.file === file && entry.text === comment.text,
      );
      if (exception) report.allowed.push({ ...comment, reason: exception.reason });
      else report.violations.push(comment);
    }
  }
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  process.exitCode = report.violations.length ? 1 : 0;
}

try {
  run();
} catch (error) {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 2;
}
