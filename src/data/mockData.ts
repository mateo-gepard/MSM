import { Package, Subject } from '@/types';
import { tutors } from './tutors';

export { tutors };

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
    id: 'medium',
    name: '10er-Paket',
    sessions: 10,
    price: 290,
    hourlyRate: 29,
    savings: 100,
    popular: true,
    features: [
      '10 × 60 Minuten',
      '€100 Ersparnis',
      'Umfassende Lernbegleitung',
      'Individuelle Lernmaterialien',
      'Zwischenevaluationen',
      'Elterngespräche inklusive'
    ]
  },
  {
    id: 'small',
    name: '5er-Paket',
    sessions: 5,
    price: 175,
    hourlyRate: 35,
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
    id: 'single',
    name: 'Einzelstunde',
    sessions: 1,
    price: 39,
    features: [
      '60 Minuten intensive Betreuung',
      'Flexibel buchbar',
      'Online oder vor Ort',
      'Personalisierter Unterricht'
    ]
  },
];

export const subjects: Subject[] = [
  { id: 'math', name: 'Mathematik', icon: 'calculator' },
  { id: 'physics', name: 'Physik', icon: 'atom' },
  { id: 'biology', name: 'Biologie', icon: 'microscope' },
  { id: 'cs', name: 'Informatik', icon: 'code' },
  { id: 'english', name: 'Englisch', icon: 'languages' },
  { id: 'german', name: 'Deutsch', icon: 'book-open' },
  { id: 'spanish', name: 'Spanisch', icon: 'message-circle' },
  { id: 'history', name: 'Geschichte', icon: 'landmark' }
];
