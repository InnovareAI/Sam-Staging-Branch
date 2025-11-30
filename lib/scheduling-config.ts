/**
 * Centralized Scheduling Configuration
 *
 * Contains all timezone, business hours, and holiday settings
 * used across campaign execution and cron jobs.
 */

import moment from 'moment-timezone';

// Type definitions
export interface ScheduleSettings {
  timezone?: string;
  working_hours_start?: number;
  working_hours_end?: number;
  skip_weekends?: boolean;
  skip_holidays?: boolean;
}

export interface BusinessHours {
  start: number;
  end: number;
}

// Default timezone (can be overridden per workspace)
export const DEFAULT_TIMEZONE = 'America/Los_Angeles'; // Pacific Time

// Business hours configuration
export const BUSINESS_HOURS = {
  start: 5,  // 5 AM PT - early to catch East Coast business hours
  end: 17,   // 5 PM PT
};

// Follow-up business hours (slightly wider)
export const FOLLOW_UP_HOURS = {
  start: 5,  // 5 AM PT
  end: 18,   // 6 PM PT
};

// Country-specific public holidays (2025-2026)
// Each country has its own calendar
export const HOLIDAYS_BY_COUNTRY: Record<string, string[]> = {
  // ==================== AMERICAS ====================
  // United States
  US: [
    '2025-01-01', // New Year's Day
    '2025-01-20', // MLK Day
    '2025-02-17', // Presidents Day
    '2025-05-26', // Memorial Day
    '2025-07-04', // Independence Day
    '2025-09-01', // Labor Day
    '2025-11-27', // Thanksgiving
    '2025-12-25', // Christmas
    '2026-01-01', // New Year's Day
  ],
  // Canada
  CA: [
    '2025-01-01', // New Year's Day
    '2025-02-17', // Family Day
    '2025-04-18', // Good Friday
    '2025-05-19', // Victoria Day
    '2025-07-01', // Canada Day
    '2025-09-01', // Labour Day
    '2025-10-13', // Thanksgiving
    '2025-12-25', // Christmas
    '2025-12-26', // Boxing Day
    '2026-01-01', // New Year's Day
  ],
  // Mexico
  MX: [
    '2025-01-01', // Año Nuevo
    '2025-02-03', // Constitution Day
    '2025-03-17', // Benito Juárez's Birthday
    '2025-04-17', // Jueves Santo
    '2025-04-18', // Viernes Santo
    '2025-05-01', // Día del Trabajo
    '2025-09-16', // Independence Day
    '2025-11-17', // Revolution Day
    '2025-12-25', // Navidad
    '2026-01-01', // Año Nuevo
  ],
  // Brazil
  BR: [
    '2025-01-01', // Ano Novo
    '2025-03-03', // Carnaval
    '2025-03-04', // Carnaval
    '2025-04-18', // Sexta-feira Santa
    '2025-04-21', // Tiradentes
    '2025-05-01', // Dia do Trabalho
    '2025-06-19', // Corpus Christi
    '2025-09-07', // Independence Day
    '2025-10-12', // Nossa Senhora Aparecida
    '2025-11-02', // Finados
    '2025-11-15', // Proclamação da República
    '2025-12-25', // Natal
    '2026-01-01', // Ano Novo
  ],

  // ==================== EUROPE ====================
  // United Kingdom
  GB: [
    '2025-01-01', // New Year's Day
    '2025-04-18', // Good Friday
    '2025-04-21', // Easter Monday
    '2025-05-05', // Early May Bank Holiday
    '2025-05-26', // Spring Bank Holiday
    '2025-08-25', // Summer Bank Holiday
    '2025-12-25', // Christmas
    '2025-12-26', // Boxing Day
    '2026-01-01', // New Year's Day
  ],
  // Germany
  DE: [
    '2025-01-01', // Neujahr
    '2025-04-18', // Karfreitag
    '2025-04-21', // Ostermontag
    '2025-05-01', // Tag der Arbeit
    '2025-05-29', // Christi Himmelfahrt
    '2025-06-09', // Pfingstmontag
    '2025-10-03', // Tag der Deutschen Einheit
    '2025-12-25', // Weihnachten
    '2025-12-26', // Zweiter Weihnachtstag
    '2026-01-01', // Neujahr
  ],
  // France
  FR: [
    '2025-01-01', // Jour de l'An
    '2025-04-21', // Lundi de Pâques
    '2025-05-01', // Fête du Travail
    '2025-05-08', // Victoire 1945
    '2025-05-29', // Ascension
    '2025-06-09', // Lundi de Pentecôte
    '2025-07-14', // Fête Nationale
    '2025-08-15', // Assomption
    '2025-11-01', // Toussaint
    '2025-11-11', // Armistice
    '2025-12-25', // Noël
    '2026-01-01', // Jour de l'An
  ],
  // Ireland
  IE: [
    '2025-01-01', // New Year's Day
    '2025-02-03', // St. Brigid's Day
    '2025-03-17', // St. Patrick's Day
    '2025-04-21', // Easter Monday
    '2025-05-05', // May Bank Holiday
    '2025-06-02', // June Bank Holiday
    '2025-08-04', // August Bank Holiday
    '2025-10-27', // October Bank Holiday
    '2025-12-25', // Christmas
    '2025-12-26', // St. Stephen's Day
    '2026-01-01', // New Year's Day
  ],
  // Italy
  IT: [
    '2025-01-01', // Capodanno
    '2025-01-06', // Epifania
    '2025-04-21', // Lunedì dell'Angelo
    '2025-04-25', // Festa della Liberazione
    '2025-05-01', // Festa del Lavoro
    '2025-06-02', // Festa della Repubblica
    '2025-08-15', // Ferragosto
    '2025-11-01', // Tutti i Santi
    '2025-12-08', // Immacolata Concezione
    '2025-12-25', // Natale
    '2025-12-26', // Santo Stefano
    '2026-01-01', // Capodanno
  ],
  // Spain
  ES: [
    '2025-01-01', // Año Nuevo
    '2025-01-06', // Epifanía
    '2025-04-18', // Viernes Santo
    '2025-05-01', // Día del Trabajo
    '2025-08-15', // Asunción
    '2025-10-12', // Fiesta Nacional
    '2025-11-01', // Todos los Santos
    '2025-12-06', // Día de la Constitución
    '2025-12-08', // Inmaculada Concepción
    '2025-12-25', // Navidad
    '2026-01-01', // Año Nuevo
  ],
  // Netherlands
  NL: [
    '2025-01-01', // Nieuwjaarsdag
    '2025-04-18', // Goede Vrijdag
    '2025-04-20', // Eerste Paasdag
    '2025-04-21', // Tweede Paasdag
    '2025-04-27', // Koningsdag
    '2025-05-05', // Bevrijdingsdag
    '2025-05-29', // Hemelvaartsdag
    '2025-06-08', // Eerste Pinksterdag
    '2025-06-09', // Tweede Pinksterdag
    '2025-12-25', // Eerste Kerstdag
    '2025-12-26', // Tweede Kerstdag
    '2026-01-01', // Nieuwjaarsdag
  ],
  // Belgium
  BE: [
    '2025-01-01', // Nieuwjaar
    '2025-04-21', // Paasmaandag
    '2025-05-01', // Dag van de Arbeid
    '2025-05-29', // Hemelvaartsdag
    '2025-06-09', // Pinkstermaandag
    '2025-07-21', // Nationale Feestdag
    '2025-08-15', // O.L.V. Hemelvaart
    '2025-11-01', // Allerheiligen
    '2025-11-11', // Wapenstilstand
    '2025-12-25', // Kerstmis
    '2026-01-01', // Nieuwjaar
  ],
  // Austria
  AT: [
    '2025-01-01', // Neujahr
    '2025-01-06', // Heilige Drei Könige
    '2025-04-21', // Ostermontag
    '2025-05-01', // Staatsfeiertag
    '2025-05-29', // Christi Himmelfahrt
    '2025-06-09', // Pfingstmontag
    '2025-06-19', // Fronleichnam
    '2025-08-15', // Mariä Himmelfahrt
    '2025-10-26', // Nationalfeiertag
    '2025-11-01', // Allerheiligen
    '2025-12-08', // Mariä Empfängnis
    '2025-12-25', // Weihnachten
    '2025-12-26', // Stefanitag
    '2026-01-01', // Neujahr
  ],
  // Switzerland
  CH: [
    '2025-01-01', // Neujahr
    '2025-01-02', // Berchtoldstag
    '2025-04-18', // Karfreitag
    '2025-04-21', // Ostermontag
    '2025-05-01', // Tag der Arbeit
    '2025-05-29', // Auffahrt
    '2025-06-09', // Pfingstmontag
    '2025-08-01', // Bundesfeier
    '2025-12-25', // Weihnachten
    '2025-12-26', // Stephanstag
    '2026-01-01', // Neujahr
  ],
  // Sweden
  SE: [
    '2025-01-01', // Nyårsdagen
    '2025-01-06', // Trettondedag jul
    '2025-04-18', // Långfredagen
    '2025-04-20', // Påskdagen
    '2025-04-21', // Annandag påsk
    '2025-05-01', // Första maj
    '2025-05-29', // Kristi himmelsfärdsdag
    '2025-06-06', // Nationaldagen
    '2025-06-08', // Pingstdagen
    '2025-06-21', // Midsommardagen
    '2025-11-01', // Alla helgons dag
    '2025-12-25', // Juldagen
    '2025-12-26', // Annandag jul
    '2026-01-01', // Nyårsdagen
  ],
  // Norway
  NO: [
    '2025-01-01', // Første nyttårsdag
    '2025-04-17', // Skjærtorsdag
    '2025-04-18', // Langfredag
    '2025-04-20', // Første påskedag
    '2025-04-21', // Andre påskedag
    '2025-05-01', // Første mai
    '2025-05-17', // Grunnlovsdagen
    '2025-05-29', // Kristi himmelfartsdag
    '2025-06-08', // Første pinsedag
    '2025-06-09', // Andre pinsedag
    '2025-12-25', // Første juledag
    '2025-12-26', // Andre juledag
    '2026-01-01', // Første nyttårsdag
  ],
  // Denmark
  DK: [
    '2025-01-01', // Nytårsdag
    '2025-04-17', // Skærtorsdag
    '2025-04-18', // Langfredag
    '2025-04-20', // Påskedag
    '2025-04-21', // 2. Påskedag
    '2025-05-16', // Store Bededag
    '2025-05-29', // Kristi Himmelfartsdag
    '2025-06-05', // Grundlovsdag
    '2025-06-08', // Pinsedag
    '2025-06-09', // 2. Pinsedag
    '2025-12-25', // Juledag
    '2025-12-26', // 2. Juledag
    '2026-01-01', // Nytårsdag
  ],
  // Finland
  FI: [
    '2025-01-01', // Uudenvuodenpäivä
    '2025-01-06', // Loppiainen
    '2025-04-18', // Pitkäperjantai
    '2025-04-20', // Pääsiäispäivä
    '2025-04-21', // 2. pääsiäispäivä
    '2025-05-01', // Vappu
    '2025-05-29', // Helatorstai
    '2025-06-08', // Helluntaipäivä
    '2025-06-21', // Juhannuspäivä
    '2025-11-01', // Pyhäinpäivä
    '2025-12-06', // Itsenäisyyspäivä
    '2025-12-25', // Joulupäivä
    '2025-12-26', // Tapaninpäivä
    '2026-01-01', // Uudenvuodenpäivä
  ],
  // Poland
  PL: [
    '2025-01-01', // Nowy Rok
    '2025-01-06', // Trzech Króli
    '2025-04-20', // Wielkanoc
    '2025-04-21', // Poniedziałek Wielkanocny
    '2025-05-01', // Święto Pracy
    '2025-05-03', // Święto Konstytucji
    '2025-06-08', // Zielone Świątki
    '2025-06-19', // Boże Ciało
    '2025-08-15', // Wniebowzięcie NMP
    '2025-11-01', // Wszystkich Świętych
    '2025-11-11', // Święto Niepodległości
    '2025-12-25', // Boże Narodzenie
    '2025-12-26', // Drugi dzień świąt
    '2026-01-01', // Nowy Rok
  ],
  // Portugal
  PT: [
    '2025-01-01', // Ano Novo
    '2025-03-04', // Carnaval
    '2025-04-18', // Sexta-feira Santa
    '2025-04-20', // Páscoa
    '2025-04-25', // Dia da Liberdade
    '2025-05-01', // Dia do Trabalhador
    '2025-06-10', // Dia de Portugal
    '2025-06-19', // Corpo de Deus
    '2025-08-15', // Assunção de Nossa Senhora
    '2025-10-05', // Implantação da República
    '2025-11-01', // Todos os Santos
    '2025-12-01', // Restauração da Independência
    '2025-12-08', // Imaculada Conceição
    '2025-12-25', // Natal
    '2026-01-01', // Ano Novo
  ],
  // Greece
  GR: [
    '2025-01-01', // Πρωτοχρονιά
    '2025-01-06', // Θεοφάνεια
    '2025-03-03', // Καθαρά Δευτέρα
    '2025-03-25', // Ευαγγελισμός
    '2025-04-18', // Μεγάλη Παρασκευή
    '2025-04-20', // Κυριακή του Πάσχα
    '2025-04-21', // Δευτέρα του Πάσχα
    '2025-05-01', // Εργατική Πρωτομαγιά
    '2025-06-08', // Αγίου Πνεύματος
    '2025-08-15', // Κοίμηση της Θεοτόκου
    '2025-10-28', // Ημέρα του Όχι
    '2025-12-25', // Χριστούγεννα
    '2025-12-26', // Σύναξη Θεοτόκου
    '2026-01-01', // Πρωτοχρονιά
  ],
  // Iceland
  IS: [
    '2025-01-01', // Nýársdagur
    '2025-04-17', // Skírdagur
    '2025-04-18', // Föstudagurinn langi
    '2025-04-20', // Páskadagur
    '2025-04-21', // Annar í páskum
    '2025-04-24', // Sumardagurinn fyrsti
    '2025-05-01', // Verkalýðsdagurinn
    '2025-05-29', // Uppstigningardagur
    '2025-06-08', // Hvítasunnudagur
    '2025-06-09', // Annar í hvítasunnu
    '2025-06-17', // Þjóðhátíðardagurinn
    '2025-08-04', // Frídagur verslunarmanna
    '2025-12-24', // Aðfangadagur
    '2025-12-25', // Jóladagur
    '2025-12-26', // Annar í jólum
    '2025-12-31', // Gamlársdagur
    '2026-01-01', // Nýársdagur
  ],

  // ==================== ASIA ====================
  // Japan
  JP: [
    '2025-01-01', // New Year's Day
    '2025-01-13', // Coming of Age Day
    '2025-02-11', // National Foundation Day
    '2025-02-23', // Emperor's Birthday
    '2025-03-20', // Vernal Equinox Day
    '2025-04-29', // Showa Day
    '2025-05-03', // Constitution Memorial Day
    '2025-05-04', // Greenery Day
    '2025-05-05', // Children's Day
    '2025-05-06', // Children's Day (observed)
    '2025-07-21', // Marine Day
    '2025-08-11', // Mountain Day
    '2025-09-15', // Respect for the Aged Day
    '2025-09-23', // Autumnal Equinox
    '2025-10-13', // Sports Day
    '2025-11-03', // Culture Day
    '2025-11-23', // Labor Thanksgiving Day
    '2026-01-01', // New Year's Day
  ],
  // South Korea
  KR: [
    '2025-01-01', // 신정
    '2025-01-28', // 설날 연휴
    '2025-01-29', // 설날
    '2025-01-30', // 설날 연휴
    '2025-03-01', // 삼일절
    '2025-05-05', // 어린이날
    '2025-05-06', // 부처님오신날
    '2025-06-06', // 현충일
    '2025-08-15', // 광복절
    '2025-10-05', // 추석 연휴
    '2025-10-06', // 추석
    '2025-10-07', // 추석 연휴
    '2025-10-03', // 개천절
    '2025-10-09', // 한글날
    '2025-12-25', // 크리스마스
    '2026-01-01', // 신정
  ],
  // China
  CN: [
    '2025-01-01', // 元旦
    '2025-01-28', // 春节
    '2025-01-29', // 春节
    '2025-01-30', // 春节
    '2025-01-31', // 春节
    '2025-02-01', // 春节
    '2025-02-02', // 春节
    '2025-02-03', // 春节
    '2025-04-04', // 清明节
    '2025-04-05', // 清明节
    '2025-04-06', // 清明节
    '2025-05-01', // 劳动节
    '2025-05-02', // 劳动节
    '2025-05-03', // 劳动节
    '2025-05-31', // 端午节
    '2025-06-01', // 端午节
    '2025-06-02', // 端午节
    '2025-10-01', // 国庆节
    '2025-10-02', // 国庆节
    '2025-10-03', // 国庆节
    '2025-10-04', // 国庆节
    '2025-10-05', // 国庆节
    '2025-10-06', // 中秋节
    '2025-10-07', // 国庆节
    '2026-01-01', // 元旦
  ],
  // India
  IN: [
    '2025-01-26', // Republic Day
    '2025-03-14', // Holi
    '2025-04-14', // Ambedkar Jayanti
    '2025-04-18', // Good Friday
    '2025-05-12', // Buddha Purnima
    '2025-08-15', // Independence Day
    '2025-08-16', // Janmashtami
    '2025-10-02', // Gandhi Jayanti
    '2025-10-20', // Dussehra
    '2025-11-01', // Diwali
    '2025-11-05', // Guru Nanak Jayanti
    '2025-12-25', // Christmas
    '2026-01-01', // New Year's Day
  ],
  // Singapore
  SG: [
    '2025-01-01', // New Year's Day
    '2025-01-29', // Chinese New Year
    '2025-01-30', // Chinese New Year Day 2
    '2025-04-18', // Good Friday
    '2025-05-01', // Labour Day
    '2025-05-12', // Vesak Day
    '2025-06-07', // Hari Raya Haji
    '2025-08-09', // National Day
    '2025-10-20', // Deepavali
    '2025-12-25', // Christmas
    '2026-01-01', // New Year's Day
  ],

  // ==================== OCEANIA ====================
  // Australia
  AU: [
    '2025-01-01', // New Year's Day
    '2025-01-27', // Australia Day (observed)
    '2025-04-18', // Good Friday
    '2025-04-19', // Easter Saturday
    '2025-04-21', // Easter Monday
    '2025-04-25', // Anzac Day
    '2025-06-09', // Queen's Birthday
    '2025-12-25', // Christmas
    '2025-12-26', // Boxing Day
    '2026-01-01', // New Year's Day
  ],
  // New Zealand
  NZ: [
    '2025-01-01', // New Year's Day
    '2025-01-02', // Day after New Year
    '2025-02-06', // Waitangi Day
    '2025-04-18', // Good Friday
    '2025-04-21', // Easter Monday
    '2025-04-25', // Anzac Day
    '2025-06-02', // Queen's Birthday
    '2025-10-27', // Labour Day
    '2025-12-25', // Christmas
    '2025-12-26', // Boxing Day
    '2026-01-01', // New Year's Day
  ],

  // ==================== AFRICA ====================
  // South Africa
  ZA: [
    '2025-01-01', // New Year's Day
    '2025-03-21', // Human Rights Day
    '2025-04-18', // Good Friday
    '2025-04-21', // Family Day
    '2025-04-27', // Freedom Day
    '2025-05-01', // Workers' Day
    '2025-06-16', // Youth Day
    '2025-08-09', // National Women's Day
    '2025-09-24', // Heritage Day
    '2025-12-16', // Day of Reconciliation
    '2025-12-25', // Christmas
    '2025-12-26', // Day of Goodwill
    '2026-01-01', // New Year's Day
  ],

  // ==================== INTERNATIONAL ====================
  // International (fallback - only truly global holidays)
  INTL: [
    '2025-01-01', // New Year's Day
    '2025-12-25', // Christmas
    '2025-12-26', // Boxing Day
    '2026-01-01', // New Year's Day
  ],
};

// Default to international holidays for backwards compatibility
export const PUBLIC_HOLIDAYS = HOLIDAYS_BY_COUNTRY.INTL;

/**
 * Get holidays for a specific country
 */
export function getHolidaysForCountry(countryCode: string = 'INTL'): string[] {
  return HOLIDAYS_BY_COUNTRY[countryCode] || HOLIDAYS_BY_COUNTRY.INTL;
}

// Email sending limits
export const EMAIL_LIMITS = {
  dailyMax: 40,
  intervalMinutes: 13.5, // 40 emails over 9 hours
};

// LinkedIn sending limits
export const LINKEDIN_LIMITS = {
  dailyConnectionRequests: 20,
  weeklyConnectionRequests: 100,
  intervalMinutes: 30,
};

/**
 * Check if current time is during business hours
 */
export function isBusinessHours(
  timezone: string = DEFAULT_TIMEZONE,
  hours: { start: number; end: number } = BUSINESS_HOURS
): boolean {
  const now = moment().tz(timezone);
  const hour = now.hour();
  return hour >= hours.start && hour < hours.end;
}

/**
 * Check if current day is a weekend
 */
export function isWeekend(timezone: string = DEFAULT_TIMEZONE): boolean {
  const now = moment().tz(timezone);
  const day = now.day(); // 0=Sun, 6=Sat
  return day === 0 || day === 6;
}

/**
 * Check if current day is a public holiday
 */
export function isHoliday(timezone: string = DEFAULT_TIMEZONE, countryCode: string = 'INTL'): boolean {
  const now = moment().tz(timezone);
  const dateStr = now.format('YYYY-MM-DD');
  const holidays = getHolidaysForCountry(countryCode);
  return holidays.includes(dateStr);
}

/**
 * Check if we can send messages now (business hours, not weekend/holiday)
 */
export function canSendNow(
  timezone: string = DEFAULT_TIMEZONE,
  hours: { start: number; end: number } = BUSINESS_HOURS,
  countryCode: string = 'INTL'
): { canSend: boolean; reason?: string } {
  const now = moment().tz(timezone);

  // Check weekend
  if (isWeekend(timezone)) {
    return {
      canSend: false,
      reason: `Weekend - no messages sent (${now.format('llll')})`
    };
  }

  // Check holiday
  if (isHoliday(timezone, countryCode)) {
    return {
      canSend: false,
      reason: `Holiday (${now.format('YYYY-MM-DD')}) - no messages sent`
    };
  }

  // Check business hours
  if (!isBusinessHours(timezone, hours)) {
    return {
      canSend: false,
      reason: `Outside business hours (${now.hour()}:00) - no messages sent`
    };
  }

  return { canSend: true };
}

/**
 * Get next available business day at specified hour
 */
export function getNextBusinessDay(
  daysToAdd: number = 1,
  targetHour: number = BUSINESS_HOURS.start,
  timezone: string = DEFAULT_TIMEZONE,
  countryCode: string = 'INTL'
): Date {
  let nextDay = moment().tz(timezone);
  nextDay.add(daysToAdd, 'days');
  nextDay.hour(targetHour).minute(0).second(0).millisecond(0);

  const holidays = getHolidaysForCountry(countryCode);

  // Keep advancing until we find a business day
  while (true) {
    const dayOfWeek = nextDay.day();
    const dateStr = nextDay.format('YYYY-MM-DD');

    // Check if weekend
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      nextDay.add(1, 'day');
      continue;
    }

    // Check if public holiday (using country-specific calendar)
    if (holidays.includes(dateStr)) {
      nextDay.add(1, 'day');
      continue;
    }

    // Found a business day!
    break;
  }

  return nextDay.toDate();
}

/**
 * Calculate scheduled send time for a prospect in a queue
 * Spaces messages at the specified interval, respecting business hours
 */
export function calculateScheduledTime(
  baseTime: Date,
  prospectIndex: number,
  intervalMinutes: number = EMAIL_LIMITS.intervalMinutes,
  timezone: string = DEFAULT_TIMEZONE,
  hours: { start: number; end: number } = BUSINESS_HOURS,
  countryCode: string = 'INTL'
): Date {
  let scheduledTime = moment(baseTime).tz(timezone);

  // Set to start of business hours if before
  if (scheduledTime.hour() < hours.start) {
    scheduledTime.hour(hours.start).minute(0).second(0);
  }

  // Add interval for this prospect
  scheduledTime.add(prospectIndex * intervalMinutes, 'minutes');

  const holidays = getHolidaysForCountry(countryCode);

  // Skip weekends and holidays, respect business hours
  while (true) {
    const dayOfWeek = scheduledTime.day();
    const dateStr = scheduledTime.format('YYYY-MM-DD');

    // Check weekend
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      const daysUntilMonday = dayOfWeek === 0 ? 1 : 2;
      scheduledTime.add(daysUntilMonday, 'days').hour(hours.start).minute(0).second(0);
      continue;
    }

    // Check holiday (using country-specific calendar)
    if (holidays.includes(dateStr)) {
      scheduledTime.add(1, 'day').hour(hours.start).minute(0).second(0);
      continue;
    }

    // Check if past business hours
    if (scheduledTime.hour() >= hours.end) {
      scheduledTime.add(1, 'day').hour(hours.start).minute(0).second(0);
      continue;
    }

    // Valid time found
    break;
  }

  return scheduledTime.toDate();
}

/**
 * Get smart first follow-up time (1-2hrs if in business hours, else next business day)
 */
export function getSmartFollowUpTime(
  timezone: string = DEFAULT_TIMEZONE,
  hours: { start: number; end: number } = FOLLOW_UP_HOURS,
  countryCode: string = 'INTL'
): Date {
  const now = moment().tz(timezone);
  const { canSend } = canSendNow(timezone, hours, countryCode);

  if (canSend) {
    // We're in business hours - send in 1-2 hours
    const followUpTime = moment().tz(timezone);
    const randomMinutes = 60 + Math.floor(Math.random() * 60); // 60-120 minutes
    followUpTime.add(randomMinutes, 'minutes');

    // But don't go past business hours - if we would, schedule for next business day
    if (followUpTime.hour() >= hours.end) {
      return getNextBusinessDay(1, hours.start, timezone, countryCode);
    }

    return followUpTime.toDate();
  } else {
    // Outside business hours - next business day
    return getNextBusinessDay(1, hours.start, timezone, countryCode);
  }
}
