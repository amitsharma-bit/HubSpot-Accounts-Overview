import type { Company, DealershipGroup, FilterDefinition, FilterGroup } from "./types";
import { evaluateRooftopAggregation } from "./eligibility";

/**
 * Structured filter engine (Phase 8/9/17/18) — evaluates a nested
 * AND/OR/NOT filter-group AST against real, already-fetched records. No
 * string parsing anywhere: `FilterGroup` is a typed tree built by the UI or
 * a saved view, not free text.
 *
 * ARCHITECTURE NOTE (documented for the final report, not hidden): this is
 * an in-memory evaluator over records already fetched from HubSpot (with
 * cheap, HubSpot-side pre-filtering applied first where possible — see
 * groupService.ts/companyService.ts), not a compiler that turns the whole
 * AST into HubSpot search filterGroups. HubSpot's search API has no way to
 * express "at least 3 associated companies have Used Cars > 100" server-side
 * at all, so ROOFTOP/AGGREGATED_ROOFTOPS-scoped filters MUST evaluate
 * in-memory regardless. Pushing the GROUP/COMPANY-scoped leaf filters down
 * into real HubSpot search filterGroups (rather than fetching broadly and
 * filtering in memory) is a real, valuable future optimization once this
 * business logic is validated — flagged, not built, per the "prototype
 * first" instruction.
 */

export type FilterContext = {
  company?: Company;
  group?: DealershipGroup;
  associatedCompanies?: Company[]; // required when any leaf has scope AGGREGATED_ROOFTOPS/ROOFTOP
};

function readField(scope: FilterDefinition["scope"], field: string, ctx: FilterContext): unknown {
  const record = scope === "GROUP" ? ctx.group : ctx.company;
  if (!record) return undefined;
  return (record as unknown as Record<string, unknown>)[field];
}

function toDate(v: unknown): Date | null {
  if (v === null || v === undefined) return null;
  const d = new Date(v as string);
  return Number.isNaN(d.getTime()) ? null : d;
}

function toNumber(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
}

const DAY_MS = 86_400_000;

function evaluateLeaf(filter: FilterDefinition, value: unknown): boolean {
  const known = value !== null && value !== undefined && value !== "";
  if (filter.operator === "isKnown") return known;
  if (filter.operator === "isUnknown") return !known;

  switch (filter.fieldType) {
    case "TEXT": {
      const v = (value as string | null | undefined) ?? "";
      const target = String(filter.value ?? "");
      switch (filter.operator) {
        case "equals":
          return v === target;
        case "notEquals":
          return v !== target;
        case "contains":
          return v.toLowerCase().includes(target.toLowerCase());
        case "notContains":
          return !v.toLowerCase().includes(target.toLowerCase());
        case "startsWith":
          return v.toLowerCase().startsWith(target.toLowerCase());
        case "endsWith":
          return v.toLowerCase().endsWith(target.toLowerCase());
        default:
          return false;
      }
    }
    case "NUMBER": {
      const v = toNumber(value);
      if (v === null) return false;
      const target = toNumber(filter.value) ?? 0;
      switch (filter.operator) {
        case "equals":
          return v === target;
        case "notEquals":
          return v !== target;
        case "greaterThan":
          return v > target;
        case "greaterThanOrEqual":
          return v >= target;
        case "lessThan":
          return v < target;
        case "lessThanOrEqual":
          return v <= target;
        case "between": {
          const hi = toNumber(filter.secondValue) ?? Infinity;
          return v >= target && v <= hi;
        }
        case "notBetween": {
          const hi = toNumber(filter.secondValue) ?? Infinity;
          return !(v >= target && v <= hi);
        }
        default:
          return false;
      }
    }
    case "DATE": {
      const v = toDate(value);
      if (!v) return false;
      const now = Date.now();
      switch (filter.operator) {
        case "equals": {
          const target = toDate(filter.value);
          return !!target && v.toDateString() === target.toDateString();
        }
        case "before": {
          const target = toDate(filter.value);
          return !!target && v.getTime() < target.getTime();
        }
        case "after": {
          const target = toDate(filter.value);
          return !!target && v.getTime() > target.getTime();
        }
        case "between": {
          const lo = toDate(filter.value);
          const hi = toDate(filter.secondValue);
          return !!lo && !!hi && v.getTime() >= lo.getTime() && v.getTime() <= hi.getTime();
        }
        case "withinLast": {
          const days = toNumber(filter.value) ?? 0;
          return now - v.getTime() <= days * DAY_MS && v.getTime() <= now;
        }
        case "withinNext": {
          const days = toNumber(filter.value) ?? 0;
          return v.getTime() - now <= days * DAY_MS && v.getTime() >= now;
        }
        case "olderThan": {
          const days = toNumber(filter.value) ?? 0;
          return now - v.getTime() > days * DAY_MS;
        }
        case "newerThan": {
          const days = toNumber(filter.value) ?? 0;
          return now - v.getTime() < days * DAY_MS;
        }
        default:
          return false;
      }
    }
    case "ENUM": {
      const v = String(value ?? "");
      switch (filter.operator) {
        case "equals":
          return v === String(filter.value ?? "");
        case "notEquals":
          return v !== String(filter.value ?? "");
        case "isAnyOf":
          return (filter.values ?? []).map(String).includes(v);
        case "isNoneOf":
          return !(filter.values ?? []).map(String).includes(v);
        default:
          return false;
      }
    }
    case "BOOLEAN": {
      const v = value === true || value === "true";
      if (filter.operator === "isTrue") return v;
      if (filter.operator === "isFalse") return !v;
      return false;
    }
  }
}

/** Evaluates a single leaf filter, including the AGGREGATED_ROOFTOPS scope. */
export function evaluateFilter(filter: FilterDefinition, ctx: FilterContext): boolean {
  if (filter.scope === "AGGREGATED_ROOFTOPS" || filter.scope === "ROOFTOP") {
    const companies = ctx.associatedCompanies ?? [];
    if (!filter.aggregation) return false; // required for this scope — see types.ts
    return evaluateRooftopAggregation(
      companies,
      (c) => evaluateLeaf(filter, (c as unknown as Record<string, unknown>)[filter.field]),
      filter.aggregation,
      filter.aggregationCount
    );
  }
  return evaluateLeaf(filter, readField(filter.scope, filter.field, ctx));
}

/** Recursively evaluates a nested AND/OR/NOT filter-group tree (Phase 17). */
export function evaluateFilterGroup(node: FilterGroup, ctx: FilterContext): boolean {
  if (node.kind === "leaf") return evaluateFilter(node.filter, ctx);
  switch (node.operator) {
    case "AND":
      return node.children.every((c) => evaluateFilterGroup(c, ctx));
    case "OR":
      return node.children.some((c) => evaluateFilterGroup(c, ctx));
    case "NOT":
      // NOT is unary in this engine's UI (Phase 17 example set) — applied to the first child.
      return !evaluateFilterGroup(node.children[0], ctx);
  }
}
