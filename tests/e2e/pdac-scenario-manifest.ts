export type ScenarioKind = "greenfield" | "brownfield";
export type Scenario = { index: number; kind: ScenarioKind; slug: string; prompt: string; modification: string };

export const greenfieldPrompts = [
  "Quiero una agenda familiar que permita coordinar citas, responsables y recordatorios.",
  "Quiero una aplicación para reservar pistas deportivas y avisar al grupo.",
  "Quiero gestionar préstamos de libros en una biblioteca de barrio.",
  "Quiero organizar rutas de senderismo con mapas, participantes y avisos de seguridad.",
  "Quiero controlar pedidos y entregas de una cooperativa de alimentos.",
  "Quiero que un centro de salud gestione citas, cancelaciones y listas de espera.",
  "Quiero llevar el mantenimiento de bicicletas y registrar reparaciones.",
  "Quiero administrar entradas para un cine local y sus sesiones.",
  "Quiero coordinar voluntarios, turnos y necesidades de un refugio animal.",
  "Quiero registrar gastos compartidos de un viaje y cerrar cuentas entre viajeros.",
] as const;

export const brownfieldDomains = [
  "agenda familiar", "reservas deportivas", "biblioteca de barrio", "rutas de senderismo", "cooperativa de alimentos",
  "centro de salud", "mantenimiento de bicicletas", "cine local", "refugio animal", "gastos de viaje",
] as const;

export const scenarios: Scenario[] = [
  ...greenfieldPrompts.map((prompt, index) => ({
    index: index + 1,
    kind: "greenfield" as const,
    slug: `greenfield-${String(index + 1).padStart(2, "0")}`,
    prompt,
    modification: `Añade una variante confirmable al caso de uso: el usuario debe poder corregir o cancelar la operación de ${brownfieldDomains[index]} y el sistema debe dejar una incógnita explícita para revisar.`,
  })),
  ...brownfieldDomains.map((domain, index) => ({
    index: index + 11,
    kind: "brownfield" as const,
    slug: `brownfield-${String(index + 1).padStart(2, "0")}`,
    prompt: `Revisa este proyecto brownfield de ${domain}. Contrasta la documentación con el código y devuelve hechos, inferencias, incógnitas y relaciones PDAC verificables.`,
    modification: `Tras la primera revisión se añadió una regla de negocio en ${domain}: las operaciones críticas requieren confirmación humana y deben conservar trazabilidad. Contrasta el cambio y señala qué artefactos PDAC quedan afectados.`,
  })),
];
