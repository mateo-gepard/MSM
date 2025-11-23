export interface Tutor {
  id: string;
  name: string;
  subjects: string[];
  achievements: string[];
  hourlyRate: number;
  image: string;
  bio: string;
  languages: string[];
  availability: string;
  availableSlots?: {
    day: string; // 'monday', 'tuesday', etc.
    times: string[]; // ['09:00', '10:00', '11:00']
  }[];
  calcomUsername?: string; // For Cal.com integration
}

export interface Subject {
  id: string;
  name: string;
  icon: string;
}

export interface Goal {
  id: string;
  name: string;
  description: string;
}

export interface LearningStyle {
  id: string;
  name: string;
  description: string;
}

export interface Urgency {
  id: string;
  name: string;
  description: string;
}

export interface Language {
  id: string;
  name: string;
  code: string;
}

export interface Booking {
  id: string;
  tutorId: string;
  studentId: string;
  subject: string;
  date: string;
  time: string;
  duration: number;
  status: 'scheduled' | 'completed' | 'cancelled';
  location: 'online' | 'in-person';
  price: number;
}

export interface Package {
  id: string;
  name: string;
  sessions: number;
  price: number;
  savings?: number;
  popular?: boolean;
  features: string[];
}

export interface MatchingData {
  subjects: string[];
  goals: string[];
  learningStyle: string;
  urgency: string;
  languages: string[];
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: 'parent' | 'student' | 'tutor';
  createdAt: string;
}
