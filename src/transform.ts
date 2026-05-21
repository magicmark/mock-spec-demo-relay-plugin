import type { MockDirectiveArgs } from "./types.js";

export interface ParsedMockDirective {
  fieldName: string;
  alias?: string;
  path: string;
  args: MockDirectiveArgs;
  isOperation: boolean;
  fragmentName?: string;
}

export function parseMockDirectives(queryText: string): ParsedMockDirective[] {
  const directives: ParsedMockDirective[] = [];
  const lines = queryText.split("\n");

  let currentPath: string[] = [];
  let braceDepth = 0;
  let depthStack: number[] = [];
  let currentFragmentName: string | undefined;
  let fragmentDepth = -1;

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed.startsWith("#") || trimmed === "") continue;

    const fragmentMatch = trimmed.match(/^fragment\s+(\w+)\s+on\s+\w+/);
    if (fragmentMatch) {
      currentFragmentName = fragmentMatch[1];
      fragmentDepth = braceDepth;
    }

    const operationMatch = trimmed.match(/^(query|mutation|subscription)\s+(\w+)/);
    if (operationMatch) {
      currentFragmentName = undefined;
      fragmentDepth = -1;
    }

    const operationMockMatch = trimmed.match(
      /^(query|mutation|subscription)\s+\w+[^{]*@mock\(([^)]+)\)/
    );
    if (operationMockMatch) {
      const args = parseDirectiveArgs(operationMockMatch[2]);
      directives.push({
        fieldName: "",
        path: "",
        args,
        isOperation: true,
      });
      continue;
    }

    const openBraces = (trimmed.match(/{/g) || []).length;
    const closeBraces = (trimmed.match(/}/g) || []).length;

    if (closeBraces > 0) {
      for (let i = 0; i < closeBraces; i++) {
        braceDepth--;
        if (depthStack.length > 0 && depthStack[depthStack.length - 1] === braceDepth) {
          depthStack.pop();
          currentPath.pop();
        }
        if (fragmentDepth >= 0 && braceDepth <= fragmentDepth) {
          currentFragmentName = undefined;
          fragmentDepth = -1;
        }
      }
    }

    const fieldMockMatch = trimmed.match(
      /^(?:(\w+)\s*:\s*)?(\w+)(?:\([^)]*\))?\s*@mock\(([^)]+)\)/
    );
    if (fieldMockMatch) {
      const alias = fieldMockMatch[1];
      const fieldName = fieldMockMatch[2];
      const args = parseDirectiveArgs(fieldMockMatch[3]);

      const path = currentPath.join(".");

      directives.push({
        fieldName,
        alias,
        path,
        args,
        isOperation: false,
        fragmentName: currentFragmentName,
      });
    }

    const fieldWithBrace = trimmed.match(/^(?:\w+\s*:\s*)?(\w+)(?:\([^)]*\))?[^{]*{/);
    if (fieldWithBrace && openBraces > 0) {
      const fieldName = fieldWithBrace[1];
      if (!operationMatch && !fragmentMatch) {
        currentPath.push(fieldName);
        depthStack.push(braceDepth);
      }
    }

    if (openBraces > 0) {
      braceDepth += openBraces;
    }
  }

  return directives;
}

export function stripMockedFields(queryText: string): string | null {
  const lines = queryText.split("\n");
  const result: string[] = [];
  let skipDepth = -1;
  let braceDepth = 0;
  let hasNonMockFields = false;
  let inOperation = false;

  for (const line of lines) {
    const trimmed = line.trim();

    const openBraces = (trimmed.match(/{/g) || []).length;
    const closeBraces = (trimmed.match(/}/g) || []).length;

    if (skipDepth >= 0) {
      braceDepth += openBraces;
      braceDepth -= closeBraces;
      if (braceDepth <= skipDepth) {
        skipDepth = -1;
      }
      continue;
    }

    if (trimmed.match(/^(query|mutation|subscription)\s/)) {
      inOperation = true;
      result.push(line);
      braceDepth += openBraces;
      braceDepth -= closeBraces;
      continue;
    }

    if (trimmed.match(/^fragment\s/)) {
      result.push(line);
      braceDepth += openBraces;
      braceDepth -= closeBraces;
      continue;
    }

    const hasMock = /@mock\(/.test(trimmed);
    if (hasMock) {
      if (openBraces > 0) {
        skipDepth = braceDepth;
        braceDepth += openBraces;
        braceDepth -= closeBraces;
      } else {
        braceDepth += openBraces;
        braceDepth -= closeBraces;
      }
      continue;
    }

    if (inOperation && trimmed !== "{" && trimmed !== "}" && trimmed !== "" && !trimmed.startsWith("#") && !trimmed.startsWith("...")) {
      hasNonMockFields = true;
    }

    result.push(line);
    braceDepth += openBraces;
    braceDepth -= closeBraces;
  }

  if (!hasNonMockFields) {
    return null;
  }

  const cleaned = cleanupEmptySelections(result.join("\n"));
  return removeUnusedVariables(cleaned);
}

function cleanupEmptySelections(query: string): string {
  let prev = "";
  let current = query;
  while (prev !== current) {
    prev = current;
    current = current.replace(/\{[\s\n]*\}/g, "");
  }
  return current;
}

function removeUnusedVariables(query: string): string {
  const varDefMatch = query.match(/\((\$[^)]+)\)/);
  if (!varDefMatch) return query;

  const varDefs = varDefMatch[1].split(",").map((v) => v.trim());
  const body = query.slice(query.indexOf("{"));

  const usedVars = varDefs.filter((def) => {
    const varName = def.match(/(\$\w+)/)?.[1];
    if (!varName) return false;
    const regex = new RegExp(varName.replace("$", "\\$") + "(?![\\w])");
    return regex.test(body);
  });

  if (usedVars.length === varDefs.length) return query;
  if (usedVars.length === 0) {
    return query.replace(/\([^)]*\)/, "");
  }
  return query.replace(varDefMatch[0], `(${usedVars.join(", ")})`);
}

function parseDirectiveArgs(argsStr: string): MockDirectiveArgs {
  const result: MockDirectiveArgs = {};

  const variantMatch = argsStr.match(/variant\s*:\s*"([^"]+)"/);
  if (variantMatch) {
    result.variant = variantMatch[1];
  }

  const valueMatch = argsStr.match(/value\s*:\s*"([^"]+)"/);
  if (valueMatch) {
    result.value = valueMatch[1];
  }

  return result;
}
