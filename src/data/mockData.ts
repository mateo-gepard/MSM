import { Tutor, Package, Subject } from '@/types';

export const tutors: Tutor[] = [
  {
    id: '1',
    name: 'Alexander Schmidt',
    subjects: ['Mathematik', 'Physik'],
    achievements: [
      'Bundessieger Mathematik-Olympiade 2023',
      'Gold-Medaille Internationale Physik-Olympiade',
      'Student TU München (Mathematik)'
    ],
    hourlyRate: 65,
    image: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=400&fit=crop',
    bio: 'Olympiade-Sieger mit Leidenschaft für höhere Mathematik',
    languages: ['Deutsch', 'Englisch'],
    availability: 'Mo-Fr nachmittags',
    availableSlots: [
      { day: 'monday', times: ['14:00', '15:00', '16:00', '17:00'] },
      { day: 'tuesday', times: ['14:00', '15:00', '16:00', '17:00'] },
      { day: 'wednesday', times: ['14:00', '15:00', '16:00', '17:00'] },
      { day: 'thursday', times: ['14:00', '15:00', '16:00', '17:00'] },
      { day: 'friday', times: ['14:00', '15:00', '16:00', '17:00'] }
    ]
  },
  {
    id: '2',
    name: 'Sophie Weber',
    subjects: ['Chemie', 'Biologie'],
    achievements: [
      '1. Platz Jugend forscht (Chemie)',
      'Stipendiatin Studienstiftung',
      'Studentin LMU München (Biochemie)'
    ],
    hourlyRate: 60,
    image: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&h=400&fit=crop',
    bio: 'Forscherin und begeisterte Naturwissenschaftlerin',
    languages: ['Deutsch', 'Englisch', 'Französisch'],
    availability: 'Mo, Mi, Fr',
    availableSlots: [
      { day: 'monday', times: ['10:00', '11:00', '12:00', '15:00', '16:00'] },
      { day: 'wednesday', times: ['10:00', '11:00', '12:00', '15:00', '16:00'] },
      { day: 'friday', times: ['10:00', '11:00', '12:00', '15:00', '16:00'] }
    ]
  },
  {
    id: '3',
    name: 'Maximilian Hoffmann',
    subjects: ['Informatik', 'Mathematik'],
    achievements: [
      'Bundeswettbewerb Informatik Sieger',
      'First Robotics Competition Team Lead',
      'Student ETH Zürich (Computer Science)'
    ],
    hourlyRate: 70,
    image: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&h=400&fit=crop',
    bio: 'Programmierer und Robotik-Experte',
    languages: ['Deutsch', 'Englisch'],
    availability: 'Di-Do abends',
    availableSlots: [
      { day: 'tuesday', times: ['17:00', '18:00', '19:00', '20:00'] },
      { day: 'wednesday', times: ['17:00', '18:00', '19:00', '20:00'] },
      { day: 'thursday', times: ['17:00', '18:00', '19:00', '20:00'] }
    ]
  },
  {
    id: '4',
    name: 'Laura Zimmermann',
    subjects: ['Englisch', 'Spanisch'],
    achievements: [
      'Cambridge Proficiency Grade A',
      'DELE C2 (Spanisch)',
      'Studentin Dolmetschen München'
    ],
    hourlyRate: 55,
    image: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400&h=400&fit=crop',
    bio: 'Mehrsprachige Sprachtalent mit didaktischem Geschick',
    languages: ['Deutsch', 'Englisch', 'Spanisch'],
    availability: 'Flexibel',
    availableSlots: [
      { day: 'monday', times: ['09:00', '10:00', '11:00', '14:00', '15:00', '16:00'] },
      { day: 'tuesday', times: ['09:00', '10:00', '11:00', '14:00', '15:00', '16:00'] },
      { day: 'wednesday', times: ['09:00', '10:00', '11:00', '14:00', '15:00', '16:00'] },
      { day: 'thursday', times: ['09:00', '10:00', '11:00', '14:00', '15:00', '16:00'] },
      { day: 'friday', times: ['09:00', '10:00', '11:00', '14:00', '15:00', '16:00'] },
      { day: 'saturday', times: ['10:00', '11:00', '12:00', '13:00'] }
    ]
  },
  {
    id: '5',
    name: 'David Chen',
    subjects: ['Mathematik', 'Informatik', 'Physik'],
    achievements: [
      'Internationale Mathematik-Olympiade Medaille',
      'Google Science Fair Finalist',
      'Student MIT (Applied Mathematics)'
    ],
    hourlyRate: 70,
    image: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=400&h=400&fit=crop',
    bio: 'Multitalent mit internationaler Olympiade-Erfahrung',
    languages: ['Deutsch', 'Englisch', 'Chinesisch'],
    availability: 'Online flexibel',
    availableSlots: [
      { day: 'monday', times: ['10:00', '12:00', '14:00', '16:00', '18:00', '20:00'] },
      { day: 'tuesday', times: ['10:00', '12:00', '14:00', '16:00', '18:00', '20:00'] },
      { day: 'wednesday', times: ['10:00', '12:00', '14:00', '16:00', '18:00', '20:00'] },
      { day: 'thursday', times: ['10:00', '12:00', '14:00', '16:00', '18:00', '20:00'] },
      { day: 'friday', times: ['10:00', '12:00', '14:00', '16:00', '18:00', '20:00'] },
      { day: 'saturday', times: ['11:00', '13:00', '15:00'] },
      { day: 'sunday', times: ['11:00', '13:00', '15:00'] }
    ]
  },
  {
    id: '6',
    name: 'Emma Müller',
    subjects: ['Latein', 'Geschichte', 'Deutsch'],
    achievements: [
      'Bundeswettbewerb Fremdsprachen 1. Platz',
      'Certamen Ciceronianum Gold',
      'Studentin Altphilologie Heidelberg'
    ],
    hourlyRate: 50,
    image: 'https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?w=400&h=400&fit=crop',
    bio: 'Geisteswissenschaftlerin mit Passion für Sprachen',
    languages: ['Deutsch', 'Englisch', 'Latein', 'Altgriechisch'],
    availability: 'Wochenende',
    availableSlots: [
      { day: 'saturday', times: ['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00'] },
      { day: 'sunday', times: ['10:00', '11:00', '12:00', '13:00', '14:00', '15:00'] }
    ]
  }
];

export const packages: Package[] = [
  {
    id: 'trial',
    name: 'Probestunde',
    sessions: 1,
    price: 0,
    features: [
      'Kostenlose 60-minütige Probestunde',
      'Kennenlernen des Tutors',
      'Individuelle Bedarfsanalyse',
      'Erstellung eines Lernplans',
      'Nur für Neukunden'
    ]
  },
  {
    id: 'single',
    name: 'Einzelstunde',
    sessions: 1,
    price: 60,
    features: [
      '60 Minuten intensive Betreuung',
      'Flexibel buchbar',
      'Online oder vor Ort',
      'Personalisierter Unterricht'
    ]
  },
  {
    id: 'small',
    name: '5er-Paket',
    sessions: 5,
    price: 280,
    savings: 20,
    features: [
      '5 × 60 Minuten',
      '€20 Ersparnis',
      'Kontinuierlicher Lernfortschritt',
      'Priorität bei Terminbuchung',
      'Wöchentliche Fortschrittsberichte'
    ]
  },
  {
    id: 'medium',
    name: '10er-Paket',
    sessions: 10,
    price: 520,
    savings: 80,
    popular: true,
    features: [
      '10 × 60 Minuten',
      '€80 Ersparnis',
      'Umfassende Lernbegleitung',
      'Individuelle Lernmaterialien',
      'Zwischenevaluationen',
      'Elterngespräche inklusive'
    ]
  },
  {
    id: 'olympiad',
    name: 'Olympiaden-Vorbereitung',
    sessions: 15,
    price: 900,
    savings: 150,
    features: [
      '15 × 60 Minuten',
      '€150 Ersparnis',
      'Spezialisierte Olympiaden-Trainer',
      'Übungsaufgaben auf Wettbewerbsniveau',
      'Strategie- und Zeitmanagement-Training',
      'Simulation von Prüfungssituationen',
      'Zugang zu exklusiven Lernressourcen'
    ]
  }
];

export const subjects: Subject[] = [
  { id: 'math', name: 'Mathematik', icon: 'calculator' },
  { id: 'physics', name: 'Physik', icon: 'atom' },
  { id: 'chemistry', name: 'Chemie', icon: 'flask-conical' },
  { id: 'biology', name: 'Biologie', icon: 'microscope' },
  { id: 'cs', name: 'Informatik', icon: 'code' },
  { id: 'english', name: 'Englisch', icon: 'languages' },
  { id: 'german', name: 'Deutsch', icon: 'book-open' },
  { id: 'spanish', name: 'Spanisch', icon: 'message-circle' },
  { id: 'latin', name: 'Latein', icon: 'scroll' },
  { id: 'history', name: 'Geschichte', icon: 'landmark' }
];
