export const TUTOR_SLUGS = [
  'juan-rivera-chopinaud',
  'mateo-mamaladze',
  'roman-daugavet',
  'len-sobol',
  'johannes-jacob',
] as const;

export const SUBJECT_IDS = [
  'math',
  'physics',
  'biology',
  'cs',
  'english',
  'german',
  'spanish',
  'history',
] as const;

export const PACKAGE_IDS = ['trial', 'medium', 'small', 'single'] as const;

export type TutorSlug = (typeof TUTOR_SLUGS)[number];
export type SubjectId = (typeof SUBJECT_IDS)[number];
export type PackageId = (typeof PACKAGE_IDS)[number];

export interface AvailabilitySlot {
  day:
    | 'monday'
    | 'tuesday'
    | 'wednesday'
    | 'thursday'
    | 'friday'
    | 'saturday'
    | 'sunday';
  times: readonly string[];
}

export interface Tutor {
  /** Stable public identifier. Never use an array index or a display name as an ID. */
  id: TutorSlug;
  slug: TutorSlug;
  /** Deterministic database seed identifier. */
  dbId: string;
  name: string;
  subjectIds: readonly SubjectId[];
  achievements: readonly string[];
  image: string;
  bio: string;
  languages: readonly string[];
  availability: string;
  grade: string;
  onlineOnly?: boolean;
  availableSlots: readonly AvailabilitySlot[];
}

export interface Subject {
  id: SubjectId;
  name: string;
  icon: string;
}

export interface Package {
  id: PackageId;
  /** Deterministic database seed identifier. */
  dbId: string;
  name: string;
  sessions: number;
  /** Catalog price in whole euro cents. */
  priceCents: number;
  hourlyRateCents?: number;
  savingsCents?: number;
  popular?: boolean;
  features: readonly string[];
}

export const SUBJECT_CATALOG: readonly Subject[] = [
  { id: 'math', name: 'Mathematik', icon: 'calculator' },
  { id: 'physics', name: 'Physik', icon: 'atom' },
  { id: 'biology', name: 'Biologie', icon: 'microscope' },
  { id: 'cs', name: 'Informatik', icon: 'code' },
  { id: 'english', name: 'Englisch', icon: 'languages' },
  { id: 'german', name: 'Deutsch', icon: 'book-open' },
  { id: 'spanish', name: 'Spanisch', icon: 'message-circle' },
  { id: 'history', name: 'Geschichte', icon: 'landmark' },
] as const;

export const PACKAGE_CATALOG: readonly Package[] = [
  {
    id: 'trial',
    dbId: 'a497cc91-10a1-5ac1-9000-000000000001',
    name: 'Probestunde',
    sessions: 1,
    priceCents: 0,
    features: [
      'Kostenlose 60-minütige Probestunde',
      'Kennenlernen des Tutors',
      'Individuelle Bedarfsanalyse',
      'Erstellung eines Lernplans',
      'Nur für Neukunden',
    ],
  },
  {
    id: 'medium',
    dbId: 'a497cc91-10a1-5ac1-9000-000000000002',
    name: '10er-Paket',
    sessions: 10,
    priceCents: 29_000,
    hourlyRateCents: 2_900,
    savingsCents: 10_000,
    popular: true,
    features: [
      '10 × 60 Minuten',
      '€100 Ersparnis',
      'Umfassende Lernbegleitung',
      'Individuelle Lernmaterialien',
      'Zwischenevaluationen',
      'Elterngespräche inklusive',
    ],
  },
  {
    id: 'small',
    dbId: 'a497cc91-10a1-5ac1-9000-000000000003',
    name: '5er-Paket',
    sessions: 5,
    priceCents: 17_500,
    hourlyRateCents: 3_500,
    savingsCents: 2_000,
    features: [
      '5 × 60 Minuten',
      '€20 Ersparnis',
      'Kontinuierlicher Lernfortschritt',
      'Priorität bei Terminbuchung',
      'Wöchentliche Fortschrittsberichte',
    ],
  },
  {
    id: 'single',
    dbId: 'a497cc91-10a1-5ac1-9000-000000000004',
    name: 'Einzelstunde',
    sessions: 1,
    priceCents: 3_900,
    features: [
      '60 Minuten intensive Betreuung',
      'Flexibel buchbar',
      'Online oder vor Ort',
      'Personalisierter Unterricht',
    ],
  },
] as const;

export const TUTOR_CATALOG: readonly Tutor[] = [
  {
    id: 'juan-rivera-chopinaud',
    slug: 'juan-rivera-chopinaud',
    dbId: '65af49a0-33dc-5a71-9000-000000000001',
    name: 'Juan Rivera Chopinaud',
    subjectIds: ['math', 'physics', 'spanish'],
    achievements: [
      '1. Preis Mathematik-Olympiade',
      'IB Student an Top-Schule in England',
      'Mehrsprachig und international erfahren',
    ],
    image: '/tutors/juan.jpg',
    bio: 'Erfolgreich in Mathe und Physik, quadrilingual',
    languages: ['Deutsch', 'Englisch', 'Spanisch', 'Französisch'],
    availability: 'Di, Mi, Sa 17:30-19:00',
    grade: 'Klasse 12 (L6)',
    availableSlots: [
      { day: 'tuesday', times: ['17:30', '18:00', '18:30'] },
      { day: 'wednesday', times: ['17:30', '18:00', '18:30'] },
      { day: 'saturday', times: ['17:30', '18:00', '18:30'] },
    ],
    onlineOnly: true,
  },
  {
    id: 'mateo-mamaladze',
    slug: 'mateo-mamaladze',
    dbId: '65af49a0-33dc-5a71-9000-000000000002',
    name: 'Mateo Mamaladze',
    subjectIds: ['physics', 'cs', 'math', 'biology'],
    achievements: [
      'Erfolgreiche Teilnahme an internationaler Physik-Olympiade',
      'Leitet Robotics-Kurs an seiner Schule',
      'Langjährige Erfahrung mit CAD, 3D-Druck und Programmieren',
    ],
    image: '/tutors/Mateo.JPG',
    bio: 'Hobby-Ingenieur und Physik-Begeisterter',
    languages: ['Deutsch', 'Englisch', 'Georgisch'],
    availability: 'Mo-Fr ab 14 Uhr',
    grade: 'Klassenstufe 12',
    availableSlots: [
      { day: 'monday', times: ['14:00', '14:30', '15:00', '15:30', '16:00', '16:30', '17:00'] },
      { day: 'tuesday', times: ['14:00', '14:30', '15:00', '15:30', '16:00', '16:30', '17:00'] },
      { day: 'wednesday', times: ['14:00', '14:30', '15:00', '15:30', '16:00', '16:30', '17:00'] },
      { day: 'thursday', times: ['14:00', '14:30', '15:00', '15:30', '16:00', '16:30', '17:00'] },
      { day: 'friday', times: ['14:00', '14:30', '15:00', '15:30', '16:00', '16:30', '17:00'] },
    ],
  },
  {
    id: 'roman-daugavet',
    slug: 'roman-daugavet',
    dbId: '65af49a0-33dc-5a71-9000-000000000003',
    name: 'Roman Daugavet',
    subjectIds: ['math', 'physics'],
    achievements: [
      '1. Preis Bundeswettbewerb Mathematik',
      'Frühstudium in Mathematik',
      'Frühstudium in Luft- und Raumfahrttechnik',
    ],
    image: '/tutors/Roman.png',
    bio: 'Leidenschaftlicher Mathematiker und Physiker',
    languages: ['Deutsch', 'Russisch'],
    availability: 'Mo, Mi, Fr 15-17 Uhr',
    grade: 'Klassenstufe 11',
    availableSlots: [
      { day: 'monday', times: ['15:00', '15:30', '16:00', '16:30'] },
      { day: 'wednesday', times: ['15:00', '15:30', '16:00', '16:30'] },
      { day: 'friday', times: ['15:00', '15:30', '16:00', '16:30'] },
    ],
  },
  {
    id: 'len-sobol',
    slug: 'len-sobol',
    dbId: '65af49a0-33dc-5a71-9000-000000000004',
    name: 'Len Sobol',
    subjectIds: ['physics', 'cs', 'math'],
    achievements: [
      'Arbeitet seit 3 Jahren als Software Developer',
      'Frühstudium in Luft- und Raumfahrttechnik',
      'Frühstudium in Physik',
    ],
    image: '/tutors/Len.JPG',
    bio: 'Physiker, talentierter Programmierer und Robotik-Experte',
    languages: ['Deutsch', 'Englisch'],
    availability: 'Mo-Fr ab 14 Uhr',
    grade: 'Klassenstufe 13',
    availableSlots: [
      { day: 'monday', times: ['16:30', '17:00', '17:30', '18:00'] },
      { day: 'wednesday', times: ['14:00', '14:30', '15:00', '15:30', '16:00', '16:30', '17:00'] },
      { day: 'thursday', times: ['14:00', '14:30', '15:00', '15:30', '16:00', '16:30', '17:00'] },
      { day: 'friday', times: ['14:00', '14:30', '15:00', '15:30', '16:00', '16:30', '17:00'] },
    ],
  },
  {
    id: 'johannes-jacob',
    slug: 'johannes-jacob',
    dbId: '65af49a0-33dc-5a71-9000-000000000005',
    name: 'Johannes Jacob',
    subjectIds: ['math', 'physics'],
    achievements: [
      'Bester Mathematiker unter allen Schülern in Deutschland',
      'Frühstudent in Analysis und Technischer Mechanik',
      'Sehr erfahren in Wettbewerbsvorbereitung von jungen Talenten',
    ],
    image: '/tutors/Johannes.jpg',
    bio: 'Äußerst erfolgreicher Mathematiker',
    languages: ['Deutsch'],
    availability: 'Mo-Fr ab 14 Uhr',
    grade: 'Klassenstufe 11',
    availableSlots: [
      { day: 'monday', times: ['14:00', '14:30', '15:00', '15:30', '16:00', '16:30', '17:00'] },
      { day: 'tuesday', times: ['14:00', '14:30', '15:00', '15:30', '16:00', '16:30', '17:00'] },
      { day: 'wednesday', times: ['14:00', '14:30', '15:00', '15:30', '16:00', '16:30', '17:00'] },
      { day: 'thursday', times: ['14:00', '14:30', '15:00', '15:30', '16:00', '16:30', '17:00'] },
      { day: 'friday', times: ['14:00', '14:30', '15:00', '15:30', '16:00', '16:30', '17:00'] },
    ],
  },
] as const;

export function isTutorSlug(value: string): value is TutorSlug {
  return (TUTOR_SLUGS as readonly string[]).includes(value);
}

export function isSubjectId(value: string): value is SubjectId {
  return (SUBJECT_IDS as readonly string[]).includes(value);
}

export function isPackageId(value: string): value is PackageId {
  return (PACKAGE_IDS as readonly string[]).includes(value);
}

export function getTutorBySlug(slug: TutorSlug): Tutor {
  return TUTOR_CATALOG.find((tutor) => tutor.slug === slug)!;
}

export function getTutorByDbId(id: string): Tutor | undefined {
  return TUTOR_CATALOG.find((tutor) => tutor.dbId === id);
}

export function getSubjectById(id: SubjectId): Subject {
  return SUBJECT_CATALOG.find((subject) => subject.id === id)!;
}

export function getPackageById(id: PackageId): Package {
  return PACKAGE_CATALOG.find((item) => item.id === id)!;
}

export function getPackageByDbId(id: string): Package | undefined {
  return PACKAGE_CATALOG.find((item) => item.dbId === id);
}

export function getSubjectName(id: SubjectId): string {
  return getSubjectById(id).name;
}
