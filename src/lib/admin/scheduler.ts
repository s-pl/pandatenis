import "server-only";

export type Weekday = "L" | "M" | "X" | "J" | "V" | "S" | "D";
export type TimeBlock =
  | "tarde-temprano"
  | "tarde-media"
  | "tarde-tardia"
  | "sabado-manana";

export const WEEKDAY_ORDER: Weekday[] = ["L", "M", "X", "J", "V", "S", "D"];
export const WEEKDAY_LABEL: Record<Weekday, string> = {
  L: "Lunes",
  M: "Martes",
  X: "Miércoles",
  J: "Jueves",
  V: "Viernes",
  S: "Sábado",
  D: "Domingo",
};

export type SchedulerGroup = {
  id: string;
  name: string;
  level: "Rojo" | "Naranja" | "Verde" | "Amarillo";
  capacity: number;
  weekdays: Weekday[];
  startTime: string | null; // "17:00"
  endTime: string | null;
  enrolled: number; // alumnos ya en el grupo
};

export type SchedulerStudent = {
  id: string;
  fullName: string;
  level: "Rojo" | "Naranja" | "Verde" | "Amarillo";
  age: number;
  preferredDays: Weekday[];
  preferredTimeBlocks: TimeBlock[];
  notes?: string;
};

export type Suggestion = {
  studentId: string;
  groupId: string | null;
  score: number;
  reason: string;
};

function timeToMinutes(time: string | null): number | null {
  if (!time) return null;
  const m = /^(\d{2}):(\d{2})/.exec(time);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

function blocksForTime(time: string | null): TimeBlock[] {
  const mins = timeToMinutes(time);
  if (mins === null) return [];
  // Tarde-temprano: 16:00 – 17:30 (960–1050)
  if (mins >= 960 && mins < 1050) return ["tarde-temprano"];
  if (mins >= 1050 && mins < 1140) return ["tarde-media"]; // 17:30 – 19:00
  if (mins >= 1140 && mins < 1230) return ["tarde-tardia"]; // 19:00 – 20:30
  if (mins >= 600 && mins < 780) return ["sabado-manana"]; // 10:00 – 13:00
  return [];
}

/**
 * Algoritmo greedy de asignación.
 *
 * Para cada alumno calculamos el mejor grupo posible según preferencias y
 * lo asignamos si hay plaza. No es perfecto (no busca el óptimo global)
 * pero es predecible, rápido y el admin siempre puede ajustar después.
 */
export function autoAssign(
  groups: SchedulerGroup[],
  students: SchedulerStudent[],
): Suggestion[] {
  // Copia mutable de plazas restantes por grupo
  const remaining = new Map<string, number>(
    groups.map((g) => [g.id, Math.max(0, g.capacity - g.enrolled)]),
  );

  // Ordenar alumnos: primero los que tienen más restricciones (menos opciones)
  const sortedStudents = [...students].sort((a, b) => {
    const aFlex =
      (a.preferredDays.length || 7) * (a.preferredTimeBlocks.length || 4);
    const bFlex =
      (b.preferredDays.length || 7) * (b.preferredTimeBlocks.length || 4);
    return aFlex - bFlex;
  });

  const suggestions: Suggestion[] = [];

  for (const student of sortedStudents) {
    let bestGroupId: string | null = null;
    let bestScore = -Infinity;
    let bestReason = "Sin grupo compatible";

    for (const group of groups) {
      if ((remaining.get(group.id) ?? 0) <= 0) continue;

      let score = 0;
      const reasons: string[] = [];

      // Nivel debe coincidir (filtro duro)
      if (group.level !== student.level) {
        continue;
      }
      score += 10;
      reasons.push(`nivel ${group.level}`);

      // Días coincidentes
      const matchingDays = group.weekdays.filter((d) =>
        student.preferredDays.includes(d),
      );
      if (student.preferredDays.length === 0) {
        score += 1; // sin preferencia: cualquier día vale
      } else {
        score += matchingDays.length * 3;
        if (matchingDays.length === 0) score -= 2;
        if (matchingDays.length > 0) reasons.push(`días ${matchingDays.join("·")}`);
      }

      // Franja horaria
      const groupBlocks = blocksForTime(group.startTime);
      const matchingBlocks = groupBlocks.filter((b) =>
        student.preferredTimeBlocks.includes(b),
      );
      if (student.preferredTimeBlocks.length === 0) {
        score += 1;
      } else {
        score += matchingBlocks.length * 2;
        if (matchingBlocks.length === 0) score -= 1;
        if (matchingBlocks.length > 0) reasons.push("franja preferida");
      }

      // Penalizar grupos casi llenos para repartir mejor
      const left = remaining.get(group.id) ?? 0;
      score += Math.min(left * 0.1, 1);

      if (score > bestScore) {
        bestScore = score;
        bestGroupId = group.id;
        bestReason = reasons.length ? `Encaje por ${reasons.join(", ")}` : "Encaje básico";
      }
    }

    if (bestGroupId) {
      remaining.set(bestGroupId, (remaining.get(bestGroupId) ?? 0) - 1);
    } else {
      bestReason = `Sin grupo de nivel ${student.level} con plaza libre`;
    }

    suggestions.push({
      studentId: student.id,
      groupId: bestGroupId,
      score: bestScore === -Infinity ? 0 : Math.round(bestScore * 10) / 10,
      reason: bestReason,
    });
  }

  return suggestions;
}

export function levelForAge(age: number): SchedulerStudent["level"] {
  if (age <= 6) return "Rojo";
  if (age <= 9) return "Naranja";
  if (age <= 12) return "Verde";
  return "Amarillo";
}
