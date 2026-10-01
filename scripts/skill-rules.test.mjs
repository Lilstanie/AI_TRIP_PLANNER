// Failure inventory for the skill format check. Each case is a way a malformed skill could slip through,
// or a well-formed one could be rejected. The rules come in two tiers, because only some are requirements
// of the Agent Skills specification (https://agentskills.io/specification) and the rest are guidance:
// - requirements (name, description size, compatibility size, frontmatter) and this project's own
//   conventions (when-to-use phrase, files beside SKILL.md, one level of references) must fail the build;
// - recommendations (500 lines, the 1536-character trigger budget of Claude Code, an unknown frontmatter
//   field) must only warn, so a long but valid skill is never blocked and the warning is never lost.
// Cases:
// - a name that is not lower-case kebab case (upper case, underscore, leading, trailing or doubled
//   hyphen), longer than 64 characters, or different from its folder;
// - a missing, empty or over-long description, or one that never says when to use the skill;
// - a misspelt or unknown frontmatter key (`descripton`) that silently drops the field;
// - name, description and `when_to_use` together over the 1536-character budget; `compatibility` over 500;
// - a SKILL.md over 500 lines, or exactly 500 wrongly rejected;
// - a stray file beside SKILL.md (anything other than scripts/, references/, assets/ and a licence);
// - a reference that links to another reference, or a SKILL.md that links into another skill's
//   references, so the hierarchy is no longer one level deep;
// - false alarms: a link inside a code fence, an absolute URL, an anchor, a link from a reference back to
//   its own SKILL.md or out to docs, a folded multi-line description, a non-directory in the skills folder.
// Run with: node --test scripts/skill-rules.test.mjs
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { after, describe, it } from "node:test";
import { checkSkills } from "./skill-rules.mjs";

const roots = [];
function fixture(files) {
  const root = mkdtempSync(join(tmpdir(), "skills-"));
  roots.push(root);
  for (const [path, content] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), content);
  }
  return root;
}
after(() => roots.forEach((root) => rmSync(root, { recursive: true, force: true })));

const DESCRIPTION = "Does one thing well. Use when the thing needs doing.";
const skill = (front = {}, body = "# Skill\n\nDo it.\n") => {
  const fields = { name: "demo", description: DESCRIPTION, ...front };
  const lines = Object.entries(fields)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => `${key}: ${value}`);
  return `---\n${lines.join("\n")}\n---\n\n${body}`;
};
const result = (files) => checkSkills(fixture(files));
const errors = (files) => result(files).errors;
const warnings = (files) => result(files).warnings;
const has = (list, text) => list.some((message) => message.includes(text));

describe("skill names", () => {
  it("accepts lower-case kebab case with digits", () => {
    assert.deepEqual(errors({ "a1-b2/SKILL.md": skill({ name: "a1-b2" }) }), []);
  });
  for (const bad of ["Demo", "de_mo", "-demo", "demo-", "de--mo"]) {
    it(`rejects ${bad}`, () => {
      assert.ok(has(errors({ [`${bad}/SKILL.md`]: skill({ name: bad }) }), "name"));
    });
  }
  it("rejects a name over 64 characters", () => {
    const long = "a".repeat(65);
    assert.ok(has(errors({ [`${long}/SKILL.md`]: skill({ name: long }) }), "64"));
  });
  it("rejects a name that differs from the folder", () => {
    assert.ok(has(errors({ "demo/SKILL.md": skill({ name: "other" }) }), 'must be "demo"'));
  });
});

describe("skill descriptions and fields", () => {
  it("rejects a missing description", () => {
    assert.ok(has(errors({ "demo/SKILL.md": skill({ description: undefined }) }), "description"));
  });
  it("rejects a description over 1024 characters", () => {
    const long = `Use when ${"x".repeat(1100)}`;
    assert.ok(has(errors({ "demo/SKILL.md": skill({ description: long }) }), "1024"));
  });
  it("rejects a description that never says when to use the skill", () => {
    const list = errors({ "demo/SKILL.md": skill({ description: "Helps with PDFs" }) });
    assert.ok(has(list, "when to use"));
  });
  it("accepts the other when-phrases", () => {
    for (const phrase of ["Use before", "Use after", "Use at", "Use for", "Use if"]) {
      assert.deepEqual(
        errors({ "demo/SKILL.md": skill({ description: `Does a thing. ${phrase} pushing.` }) }),
        [],
        phrase,
      );
    }
  });
  it("warns about an unknown frontmatter key without failing", () => {
    const files = { "demo/SKILL.md": skill({ descripton: "typo" }) };
    assert.ok(has(warnings(files), "descripton"));
    assert.deepEqual(errors(files), []);
  });
  it("accepts the documented optional fields", () => {
    const list = errors({
      "demo/SKILL.md": skill({
        license: "MIT, see LICENSE",
        "disable-model-invocation": "true",
        "user-invocable": "false",
        compatibility: "needs git",
      }),
    });
    assert.deepEqual(list, []);
    assert.deepEqual(
      warnings({ "demo/SKILL.md": skill({ license: "MIT", compatibility: "needs git" }) }),
      [],
    );
  });
  it("rejects compatibility over 500 characters", () => {
    assert.ok(has(errors({ "demo/SKILL.md": skill({ compatibility: "x".repeat(501) }) }), "500"));
  });
  it("warns, without failing, when name, description and when_to_use pass the 1536 budget", () => {
    const files = {
      "demo/SKILL.md": skill({
        description: `Does a thing. Use when ${"x".repeat(900)}`,
        when_to_use: "y".repeat(700),
      }),
    };
    assert.ok(has(warnings(files), "1536"));
    assert.deepEqual(errors(files), []);
  });
  it("reads a folded multi-line description", () => {
    const text =
      "---\nname: demo\ndescription: >\n  Does one thing.\n  Use when needed.\n---\n\n# Skill\n";
    assert.deepEqual(errors({ "demo/SKILL.md": text }), []);
  });
  it("rejects a SKILL.md without frontmatter", () => {
    assert.ok(has(errors({ "demo/SKILL.md": "# Skill\n" }), "frontmatter"));
  });
});

describe("skill size and layout", () => {
  const withLines = (count) => skill({}, `${"line\n".repeat(count)}`);
  it("warns, without failing, above 500 lines and stays quiet at exactly 500", () => {
    const header = skill({}, "").split("\n").length - 1;
    const at500 = { "demo/SKILL.md": withLines(500 - header) };
    assert.deepEqual(errors(at500), []);
    assert.deepEqual(warnings(at500), []);
    const over = { "demo/SKILL.md": withLines(501 - header) };
    assert.deepEqual(errors(over), []);
    assert.ok(has(warnings(over), "500 lines"));
  });
  it("rejects a stray file beside SKILL.md", () => {
    assert.ok(has(errors({ "demo/SKILL.md": skill(), "demo/forms.md": "x" }), "forms.md"));
  });
  it("accepts scripts, references, assets and a licence", () => {
    assert.deepEqual(
      errors({
        "demo/SKILL.md": skill(),
        "demo/scripts/run.mjs": "x",
        "demo/references/a.md": "x",
        "demo/assets/t.txt": "x",
        "demo/LICENSE": "MIT",
      }),
      [],
    );
  });
  it("ignores a non-directory in the skills folder and rejects a folder with no SKILL.md", () => {
    assert.deepEqual(errors({ "NOTICES.md": "x", "demo/SKILL.md": skill() }), []);
    assert.ok(has(errors({ "empty/readme.md": "x" }), "missing SKILL.md"));
  });
});

describe("one level of references", () => {
  it("rejects a reference that links to another reference", () => {
    const list = errors({
      "demo/SKILL.md": skill({}, "# Skill\n\n[a](references/a.md)\n"),
      "demo/references/a.md": "See [b](b.md).\n",
      "demo/references/b.md": "x\n",
    });
    assert.ok(has(list, "references/a.md"));
  });
  it("rejects a SKILL.md that links into another skill's references", () => {
    const list = errors({
      "demo/SKILL.md": skill({}, "# Skill\n\n[g](../other/references/g.md)\n"),
      "other/SKILL.md": skill({ name: "other" }),
      "other/references/g.md": "x\n",
    });
    assert.ok(has(list, "another skill"));
  });
  it("accepts links to a skill's own references, other skills' SKILL.md and outside docs", () => {
    const list = errors({
      "demo/SKILL.md": skill({}, "# Skill\n\n[a](references/a.md#part) [o](../other/SKILL.md)\n"),
      "demo/references/a.md":
        "[back](../SKILL.md) [doc](../../../docs/x.md) [web](https://example.com/b.md)\n",
      "other/SKILL.md": skill({ name: "other" }),
    });
    assert.deepEqual(list, []);
  });
  it("ignores links inside code fences", () => {
    const fence = "```md\n[b](b.md)\n```\n";
    const list = errors({
      "demo/SKILL.md": skill({}, "# Skill\n\n[a](references/a.md)\n"),
      "demo/references/a.md": fence,
      "demo/references/b.md": "x\n",
    });
    assert.deepEqual(list, []);
  });
});
