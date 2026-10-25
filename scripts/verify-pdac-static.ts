import { access, readFile, stat } from "node:fs/promises";
import { join, resolve } from "node:path";

const projectRoot = resolve(process.env.PROJECTSTUDIO_PROJECT_ROOT ?? "/Users/luis/projects/notes");
const expectedMode = process.argv.includes("--expect-greenfield") ? "greenfield" : process.argv.includes("--expect-brownfield") ? "brownfield" : "auto";
const graphPath = join(projectRoot, ".product", "generated", "product-graph.json");
const productRoot = join(projectRoot, "docs", "product");
const transientTitle = /objetivo actual|hallazgo publicado|revisi[oó]n proactiva|pdac completo|no inventes datos|foco actores|foco casos de uso|foco dominio/i;
const requiredTypes = ["actor", "use-case", "journey", "domain-term", "business-rule", "bounded-context"];
const requirementTypes = ["requirement", "functional-requirement", "quality-requirement"];

type Node = { id?: unknown; type?: unknown; title?: unknown; status?: unknown; path?: unknown };
type Edge = { from?: unknown; to?: unknown };
type Graph = { schema?: unknown; nodes?: unknown; edges?: unknown };

async function exists(path: string): Promise<boolean> {
  try { await access(path); return true; } catch { return false; }
}
function fail(message: string): never {
  console.error(JSON.stringify({ ok: false, projectRoot, error: message }, null, 2));
  process.exit(1);
}

if (!(await exists(graphPath))) {
  const hasProductDocs = await exists(productRoot);
  if (expectedMode === "brownfield") fail(`Se esperaba un grafo brownfield y no existe: ${graphPath}`);
  if (hasProductDocs) fail(`Hay docs/product pero falta .product/generated/product-graph.json: ${productRoot}`);
  console.log(JSON.stringify({ ok: true, mode: "greenfield", projectRoot, graph: null, message: "No hay PDAC persistido; el proyecto está listo para la entrevista inicial." }, null, 2));
  process.exit(0);
}
if (expectedMode === "greenfield") fail(`Se esperaba Greenfield pero existe el grafo: ${graphPath}`);

let graph: Graph;
try { graph = JSON.parse(await readFile(graphPath, "utf8")) as Graph; } catch (error) { fail(`JSON inválido en ${graphPath}: ${String(error)}`); }
if (graph.schema !== "product-definition-as-code/graph/v1alpha1") fail("El grafo no usa product-definition-as-code/graph/v1alpha1");
if (!Array.isArray(graph.nodes) || !Array.isArray(graph.edges)) fail("El grafo debe contener arrays nodes y edges");
const nodes = graph.nodes as Node[];
const edges = graph.edges as Edge[];
if (nodes.length === 0) fail("El grafo existe pero no contiene nodos");
const ids = new Set<string>();
const counts = new Map<string, number>();
for (const [index, node] of nodes.entries()) {
  if (typeof node.id !== "string" || !node.id) fail(`Nodo ${index} no tiene id`);
  if (ids.has(node.id)) fail(`ID de nodo duplicado: ${node.id}`);
  ids.add(node.id);
  if (typeof node.type !== "string" || !node.type) fail(`Nodo ${node.id} no tiene type`);
  if (typeof node.title !== "string" || !node.title.trim()) fail(`Nodo ${node.id} no tiene title`);
  if (transientTitle.test(node.title)) fail(`El grafo contiene texto de proceso transitorio en ${node.id}: ${node.title}`);
  counts.set(node.type, (counts.get(node.type) ?? 0) + 1);
  if (typeof node.path === "string" && node.path && !(await exists(join(projectRoot, node.path)))) fail(`La evidencia no existe para ${node.id}: ${node.path}`);
}
for (const edge of edges) {
  if (typeof edge.from !== "string" || typeof edge.to !== "string" || !ids.has(edge.from) || !ids.has(edge.to)) fail(`Relación huérfana: ${JSON.stringify(edge)}`);
}
for (const type of requiredTypes) if (!counts.has(type)) fail(`Falta cobertura PDAC de tipo ${type}`);
if (!requirementTypes.some((type) => counts.has(type))) fail("Falta cobertura PDAC de requisitos");
const productStat = await stat(productRoot).catch(() => undefined);
console.log(JSON.stringify({
  ok: true,
  mode: "brownfield",
  projectRoot,
  graphPath,
  productRootExists: Boolean(productStat),
  nodeCount: nodes.length,
  edgeCount: edges.length,
  counts: Object.fromEntries([...counts.entries()].sort(([a], [b]) => a.localeCompare(b))),
  checks: { uniqueNodeIds: true, edgeEndpoints: true, evidencePaths: true, noTransientProcessText: true, requiredPdacTypes: true },
}, null, 2));
