import {
  addDays,
  isWeekend,
  getYear,
  differenceInDays,
  isBefore,
  isAfter,
  isSameDay,
  startOfDay,
} from 'date-fns';

// Calculate Easter Sunday using the Anonymous Gregorian algorithm
function getEasterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;

  return new Date(year, month - 1, day);
}

// Get Good Friday (2 days before Easter Sunday)
function getGoodFriday(year: number): Date {
  const easter = getEasterSunday(year);
  return addDays(easter, -2);
}

// Get Family Day (day after Good Friday, which is the Saturday before Easter)
function getFamilyDay(year: number): Date {
  const goodFriday = getGoodFriday(year);
  return addDays(goodFriday, 1);
}

// Get all South African public holidays for a given year
// If a holiday falls on a Sunday, the following Monday is observed
export function getSAPublicHolidays(year: number): Date[] {
  const holidays: Date[] = [];

  // Fixed holidays
  const fixedHolidays = [
    { month: 0, day: 1, name: "New Year's Day" },
    { month: 2, day: 21, name: "Human Rights Day" },
    { month: 3, day: 27, name: "Freedom Day" },
    { month: 4, day: 1, name: "Workers' Day" },
    { month: 5, day: 16, name: "Youth Day" },
    { month: 7, day: 9, name: "National Women's Day" },
    { month: 8, day: 24, name: "Heritage Day" },
    { month: 11, day: 16, name: "Day of Reconciliation" },
    { month: 11, day: 25, name: "Christmas Day" },
    { month: 11, day: 26, name: "Day of Goodwill" },
  ];

  for (const holiday of fixedHolidays) {
    let date = new Date(year, holiday.month, holiday.day);

    // If holiday falls on Sunday, observe on Monday
    if (date.getDay() === 0) {
      date = addDays(date, 1);
    }

    holidays.push(startOfDay(date));
  }

  // Variable holidays (Easter-based)
  const goodFriday = getGoodFriday(year);
  const familyDay = getFamilyDay(year);

  holidays.push(startOfDay(goodFriday));
  holidays.push(startOfDay(familyDay));

  return holidays;
}

// Check if a date is a South African public holiday
export function isPublicHoliday(date: Date): boolean {
  const year = getYear(date);
  const holidays = getSAPublicHolidays(year);
  const checkDate = startOfDay(date);

  return holidays.some(holiday => isSameDay(holiday, checkDate));
}

// Check if a date is a business day (not weekend, not public holiday)
export function isBusinessDay(date: Date): boolean {
  return !isWeekend(date) && !isPublicHoliday(date);
}

// Add business days to a date
export function addBusinessDays(startDate: Date, businessDays: number): Date {
  let currentDate = startOfDay(new Date(startDate));
  let daysAdded = 0;

  if (businessDays <= 0) {
    return currentDate;
  }

  while (daysAdded < businessDays) {
    currentDate = addDays(currentDate, 1);

    if (isBusinessDay(currentDate)) {
      daysAdded++;
    }
  }

  return currentDate;
}

// Calculate business days between two dates (excluding start, including end)
export function getBusinessDaysBetween(startDate: Date, endDate: Date): number {
  const start = startOfDay(new Date(startDate));
  const end = startOfDay(new Date(endDate));

  if (isSameDay(start, end)) {
    return 0;
  }

  const isNegative = isBefore(end, start);
  const [earlier, later] = isNegative ? [end, start] : [start, end];

  let businessDays = 0;
  let currentDate = addDays(earlier, 1);

  while (!isAfter(currentDate, later)) {
    if (isBusinessDay(currentDate)) {
      businessDays++;
    }
    currentDate = addDays(currentDate, 1);
  }

  return isNegative ? -businessDays : businessDays;
}

// Get the number of business days remaining until a deadline
// Returns negative if deadline has passed
export function getBusinessDaysUntil(deadline: Date): number {
  const today = startOfDay(new Date());
  const deadlineDate = startOfDay(new Date(deadline));

  if (isSameDay(today, deadlineDate)) {
    return 0;
  }

  if (isBefore(deadlineDate, today)) {
    // Deadline has passed, return negative days
    return -getBusinessDaysBetween(deadlineDate, today);
  }

  return getBusinessDaysBetween(today, deadlineDate);
}

// Phase order for calculations
export const PHASE_ORDER = [
  'planning',
  'funding',
  'wayleave',
  'materials',
  'announcement',
  'kickoff',
  'build',
  'fqa',
  'ecc',
  'integration',
  'rfa',
  'com',
] as const;

export type PhaseName = (typeof PHASE_ORDER)[number];

// Phase display names
export const PHASE_DISPLAY_NAMES: Record<PhaseName, string> = {
  planning: 'Planning',
  funding: 'Funding',
  wayleave: 'Wayleave',
  materials: 'Materials',
  announcement: 'Announcement',
  kickoff: 'Kick-Off',
  build: 'Build',
  fqa: 'FQA',
  ecc: 'ECC',
  integration: 'Integration',
  rfa: 'RFA',
  com: 'COM',
};

// Default allowed days for each phase
export const DEFAULT_ALLOWED_DAYS: Record<PhaseName, number> = {
  planning: 10,
  funding: 2,
  wayleave: 20,
  materials: 15,
  announcement: 1,
  kickoff: 2,
  build: 20,
  fqa: 0, // Mirrors build
  ecc: 1,
  integration: 2,
  rfa: 1,
  com: 0, // Mirrors rfa
};

// Phases that mirror other phases
export const MIRROR_PHASES: Partial<Record<PhaseName, PhaseName>> = {
  fqa: 'build',
  com: 'rfa',
};

// Calculate all phase deadlines for a project
export function calculatePhaseDeadlines(
  siteSurveyDate: Date,
  allowedDaysPerPhase: Record<PhaseName, number>
): Record<PhaseName, Date> {
  const deadlines: Partial<Record<PhaseName, Date>> = {};
  let previousDeadline = startOfDay(new Date(siteSurveyDate));

  for (const phase of PHASE_ORDER) {
    // Check if this phase mirrors another
    const mirrorOf = MIRROR_PHASES[phase];
    if (mirrorOf && deadlines[mirrorOf]) {
      deadlines[phase] = deadlines[mirrorOf];
      continue;
    }

    const allowedDays = allowedDaysPerPhase[phase];

    // Skip wayleave if allowedDays is 0
    if (phase === 'wayleave' && allowedDays === 0) {
      continue;
    }

    // Calculate deadline
    const deadline = addBusinessDays(previousDeadline, allowedDays);
    deadlines[phase] = deadline;

    // Update previous deadline for next phase (skip wayleave if it was skipped)
    if (phase !== 'fqa' && phase !== 'com') {
      previousDeadline = deadline;
    }
  }

  return deadlines as Record<PhaseName, Date>;
}

// Calculate phase deadlines starting from a specific changed phase
// This is used when a Super Admin manually changes a deadline date
// All downstream phases will be recalculated based on the new deadline
export function calculatePhaseDeadlinesFromDeadline(
  changedPhase: PhaseName,
  newDeadline: Date,
  allowedDaysPerPhase: Record<PhaseName, number>,
  currentDeadlines: Record<PhaseName, Date>
): Record<PhaseName, Date> {
  const deadlines: Record<PhaseName, Date> = { ...currentDeadlines };
  const changedPhaseIndex = PHASE_ORDER.indexOf(changedPhase);

  // Set the new deadline for the changed phase
  deadlines[changedPhase] = startOfDay(new Date(newDeadline));

  // If FQA was changed, also update Build (they mirror each other)
  if (changedPhase === 'fqa') {
    deadlines['build'] = deadlines['fqa'];
  }
  // If Build was changed, also update FQA
  if (changedPhase === 'build') {
    deadlines['fqa'] = deadlines['build'];
  }
  // If RFA was changed, also update COM
  if (changedPhase === 'rfa') {
    deadlines['com'] = deadlines['rfa'];
  }
  // If COM was changed, also update RFA
  if (changedPhase === 'com') {
    deadlines['rfa'] = deadlines['com'];
  }

  // Find the previous non-mirror phase deadline to use as starting point
  let previousDeadline = startOfDay(new Date(newDeadline));

  // Recalculate all phases after the changed phase
  for (let i = changedPhaseIndex + 1; i < PHASE_ORDER.length; i++) {
    const phase = PHASE_ORDER[i];

    // Check if this phase mirrors another
    const mirrorOf = MIRROR_PHASES[phase];
    if (mirrorOf && deadlines[mirrorOf]) {
      deadlines[phase] = deadlines[mirrorOf];
      continue;
    }

    const allowedDays = allowedDaysPerPhase[phase];

    // Skip wayleave if allowedDays is 0
    if (phase === 'wayleave' && allowedDays === 0) {
      continue;
    }

    // Calculate deadline based on previous phase
    const deadline = addBusinessDays(previousDeadline, allowedDays);
    deadlines[phase] = deadline;

    // Update previous deadline for next phase (skip mirror phases)
    if (phase !== 'fqa' && phase !== 'com') {
      previousDeadline = deadline;
    }
  }

  return deadlines;
}
