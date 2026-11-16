/**
 * Demo data only. The company, plant, areas and technicians are fictional.
 */

export const COMPANY = {
  name: 'Arandu Foods',
  plant: 'Plant 1',
};

export type Discipline = 'Electrical' | 'Mechanical' | 'Civil';
export type Pictogram =
  | 'light'
  | 'door'
  | 'floor'
  | 'weld'
  | 'seal'
  | 'drip'
  | 'pipe'
  | 'panel'
  | 'motor'
  | 'wall';

export interface Finding {
  id: string;
  title: string;
  area: string;
  discipline: Discipline;
  pictogram: Pictogram;
  /** Days since the finding was raised on the inspection route. */
  daysOpen: number;
  /** Food-safety risk: product exposed or close to it. */
  foodSafety: boolean;
  /** Working day index (0 = Mon) by which it should be fixed. */
  dueDay: number;
  /** Estimated hours of work. */
  hours: number;
}

export interface Technician {
  name: string;
  discipline: Discipline;
  color: string;
}

export const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
export const CELL_CAPACITY = 2;

export const TECHNICIANS: Technician[] = [
  { name: 'R. Vega', discipline: 'Electrical', color: '#f5b400' },
  { name: 'L. Sosa', discipline: 'Mechanical', color: '#3fa7ff' },
  { name: 'M. Ortiz', discipline: 'Civil', color: '#5fd38d' },
];

export const DISCIPLINE_COLOR: Record<Discipline, string> = {
  Electrical: '#f5b400',
  Mechanical: '#3fa7ff',
  Civil: '#5fd38d',
};

const POOL: Finding[] = [
  { id: 'F-101', title: 'Broken light fixture', area: 'Deboning hall', discipline: 'Electrical', pictogram: 'light', daysOpen: 2, foodSafety: true, dueDay: 1, hours: 1 },
  { id: 'F-102', title: 'Door seal torn', area: 'Cold room 3', discipline: 'Civil', pictogram: 'door', daysOpen: 5, foodSafety: false, dueDay: 2, hours: 2 },
  { id: 'F-103', title: 'Cracked floor', area: 'Loading dock', discipline: 'Civil', pictogram: 'floor', daysOpen: 9, foodSafety: false, dueDay: 4, hours: 4 },
  { id: 'F-104', title: 'Weld crack on rail', area: 'Carcass line', discipline: 'Mechanical', pictogram: 'weld', daysOpen: 1, foodSafety: true, dueDay: 0, hours: 2 },
  { id: 'F-105', title: 'Silicone detached', area: 'Packing room', discipline: 'Civil', pictogram: 'seal', daysOpen: 3, foodSafety: true, dueDay: 1, hours: 1 },
  { id: 'F-106', title: 'Ceiling condensation', area: 'Chiller tunnel', discipline: 'Mechanical', pictogram: 'drip', daysOpen: 4, foodSafety: true, dueDay: 0, hours: 3 },
  { id: 'F-107', title: 'Leaking steam pipe', area: 'Boiler room', discipline: 'Mechanical', pictogram: 'pipe', daysOpen: 6, foodSafety: false, dueDay: 3, hours: 2 },
  { id: 'F-108', title: 'Panel cover missing', area: 'Freezer 2', discipline: 'Electrical', pictogram: 'panel', daysOpen: 2, foodSafety: false, dueDay: 2, hours: 1 },
  { id: 'F-109', title: 'Conveyor motor noise', area: 'Offal line', discipline: 'Mechanical', pictogram: 'motor', daysOpen: 1, foodSafety: false, dueDay: 3, hours: 3 },
  { id: 'F-110', title: 'Wall panel dented', area: 'Corridor B', discipline: 'Civil', pictogram: 'wall', daysOpen: 12, foodSafety: false, dueDay: 4, hours: 2 },
  { id: 'F-111', title: 'Emergency light off', area: 'Cold room 1', discipline: 'Electrical', pictogram: 'light', daysOpen: 1, foodSafety: false, dueDay: 1, hours: 1 },
  { id: 'F-112', title: 'Drain cover loose', area: 'Washing area', discipline: 'Civil', pictogram: 'floor', daysOpen: 7, foodSafety: true, dueDay: 2, hours: 1 },
];

/** A deterministic daily backlog: a new set of findings every day. */
export function todaysFindings(date = new Date(), count = 7): Finding[] {
  const seed =
    date.getFullYear() * 372 + date.getMonth() * 31 + date.getDate();
  let s = seed;
  const rand = () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
  const pool = POOL.slice();
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, count);
}
