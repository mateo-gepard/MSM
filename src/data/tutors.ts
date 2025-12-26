import { Tutor } from '@/types';

export const tutors: Tutor[] = [
  {
    id: '1',
    name: 'Juan Rivera Chopinaud',
    subjects: ['Mathematik', 'Physik', 'Spanisch'],
    achievements: [
      '1. Preis Mathematik-Olympiade',
      'IB Student an Top-Schule in England',
      'Mehrsprachig und international erfahren'
    ],
    image: '/tutors/juan.jpg',
    bio: 'Erfolgreich in Mathe und Physik, quadrilingual',
    languages: ['Deutsch', 'Englisch', 'Spanisch', 'Französisch'],
    availability: 'Di, Mi, Sa 17:30-19:00',
    grade: 'Klasse 12 (L6)',
    availableSlots: [
      { day: 'tuesday', times: ['17:30', '18:00', '18:30'] },
      { day: 'wednesday', times: ['17:30', '18:00', '18:30'] },
      { day: 'saturday', times: ['17:30', '18:00', '18:30'] }
    ],
    onlineOnly: true
  },
  {
    id: '4',
    name: 'Mateo Mamaladze',
    subjects: ['Physik', 'Informatik', 'Mathematik', 'Biologie'],
    achievements: [
      'Erfolgreiche Teilnahme an internationaler Physik-Olympiade',
      'Leitet Robotics-Kurs an seiner Schule',
      'Langjährige Erfahrung mit CAD, 3D-Druck und Programmieren'
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
      { day: 'friday', times: ['14:00', '14:30', '15:00', '15:30', '16:00', '16:30', '17:00'] }
    ]
  },
  {
    id: '2',
    name: 'Roman Daugavet',
    subjects: ['Mathematik', 'Physik'],
    achievements: [
      '1. Preis Bundeswettbewerb Mathematik',
      'Frühstudium in Mathematik',
      'Frühstudium in Luft- und Raumfahrttechnik'
    ],
    image: '/tutors/Roman.png',
    bio: 'Leidenschaftlicher Mathematiker und Physiker',
    languages: ['Deutsch', 'Russisch'],
    availability: 'Mo, Mi, Fr 15-17 Uhr',
    grade: 'Klassenstufe 11',
    availableSlots: [
      { day: 'monday', times: ['15:00', '15:30', '16:00', '16:30'] },
      { day: 'wednesday', times: ['15:00', '15:30', '16:00', '16:30'] },
      { day: 'friday', times: ['15:00', '15:30', '16:00', '16:30'] }
    ]
  },
  {
    id: '3',
    name: 'Len Sobol',
    subjects: ['Physik', 'Informatik', 'Mathematik'],
    achievements: [
      'Arbeitet seit 3 Jahren als Software Developer',
      'Frühstudium in Luft- und Raumfahrttechnik',
      'Frühstudium in Physik'
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
      { day: 'friday', times: ['14:00', '14:30', '15:00', '15:30', '16:00', '16:30', '17:00'] }
    ]
  },
  {
    id: '5',
    name: 'Johannes Jacob',
    subjects: ['Mathematik', 'Physik'],
    achievements: [
      'Bester Mathematiker unter allen Schülern in Deutschland',
      'Frühstudent in Analysis und Technischer Mechanik',
      'Sehr erfahren in Wettbewerbsvorbereitung von jungen Talenten'
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
      { day: 'friday', times: ['14:00', '14:30', '15:00', '15:30', '16:00', '16:30', '17:00'] }
    ]
  }
];
