import { scenarios } from "../tests/e2e/pdac-scenario-manifest.js";

const expectedCount = Number(process.env.F07_SCENARIO_COUNT ?? 20);
const expectedGreenfield = Number(process.env.F07_GREENFIELD_COUNT ?? 10);
const expectedBrownfield = Number(process.env.F07_BROWNFIELD_COUNT ?? 10);
const errors: string[] = [];
const slugs = new Set<string>();
for (const scenario of scenarios) {
  if (slugs.has(scenario.slug)) errors.push(`slug duplicado: ${scenario.slug}`);
  slugs.add(scenario.slug);
  if (!scenario.prompt.trim()) errors.push(`prompt vacío: ${scenario.slug}`);
  if (!scenario.modification.trim()) errors.push(`modificación vacía: ${scenario.slug}`);
  if (!/actor|caso de uso|PDAC|proyecto/i.test(`${scenario.prompt} ${scenario.modification}`)) errors.push(`escenario sin objetivo PDAC observable: ${scenario.slug}`);
}
const greenfield = scenarios.filter((scenario) => scenario.kind === "greenfield");
const brownfield = scenarios.filter((scenario) => scenario.kind === "brownfield");
if (scenarios.length !== expectedCount) errors.push(`escenarios=${scenarios.length}, esperado=${expectedCount}`);
if (greenfield.length !== expectedGreenfield) errors.push(`greenfield=${greenfield.length}, esperado=${expectedGreenfield}`);
if (brownfield.length !== expectedBrownfield) errors.push(`brownfield=${brownfield.length}, esperado=${expectedBrownfield}`);
if (errors.length > 0) {
  console.error(JSON.stringify({ ok: false, errors }, null, 2));
  process.exit(1);
}
console.log(JSON.stringify({ ok: true, launchesApp: false, scenarioCount: scenarios.length, greenfield: greenfield.length, brownfield: brownfield.length, uniqueSlugs: slugs.size }, null, 2));
