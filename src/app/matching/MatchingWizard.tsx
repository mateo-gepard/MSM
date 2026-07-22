'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Award,
  BookOpen,
  Check,
  Globe2,
  Laptop,
  MapPin,
  Target,
} from 'lucide-react';
import {
  SUBJECT_CATALOG,
  TUTOR_CATALOG,
  type SubjectId,
  type Tutor,
} from '@/domain/catalog';

const GOALS = [
  {
    id: 'understand',
    label: 'Lücken schließen',
    description: 'Grundlagen sauber verstehen und sicher anwenden.',
  },
  {
    id: 'grades',
    label: 'Noten verbessern',
    description: 'Strukturiert üben und Fortschritte sichtbar machen.',
  },
  {
    id: 'exam',
    label: 'Prüfung vorbereiten',
    description: 'Mit einem klaren Plan auf Klausur oder Abitur hinarbeiten.',
  },
  {
    id: 'competition',
    label: 'Wettbewerb meistern',
    description: 'Anspruchsvolle Aufgaben und neue Denkwege trainieren.',
  },
] as const;

const LANGUAGES = ['Deutsch', 'Englisch', 'Spanisch', 'Französisch'] as const;

type GoalId = (typeof GOALS)[number]['id'];
type Language = (typeof LANGUAGES)[number];
type Location = 'online' | 'in-person';

interface MatchPreferences {
  subjectId: SubjectId | null;
  goals: GoalId[];
  language: Language;
  location: Location;
}

interface TutorMatch {
  tutor: Tutor;
  reasons: string[];
  score: number;
}

function rankTutors(preferences: MatchPreferences): TutorMatch[] {
  if (!preferences.subjectId) return [];

  const subject = SUBJECT_CATALOG.find((item) => item.id === preferences.subjectId);
  if (!subject) return [];

  return TUTOR_CATALOG.filter((tutor) => tutor.subjectIds.includes(subject.id))
    .filter((tutor) => preferences.location !== 'in-person' || !tutor.onlineOnly)
    .map((tutor) => {
      const reasons = [`Unterrichtet ${subject.name}`];
      let score = 100;

      if (tutor.languages.includes(preferences.language)) {
        score += 20;
        reasons.push(`Unterricht auf ${preferences.language}`);
      }

      if (
        preferences.goals.includes('competition') &&
        tutor.achievements.some((achievement) =>
          /olympiade|wettbewerb|preis/i.test(achievement),
        )
      ) {
        score += 15;
        reasons.push('Eigene Wettbewerbserfahrung');
      }

      if (preferences.location === 'online') {
        reasons.push('Online verfügbar');
      } else {
        reasons.push('Präsenzunterricht möglich');
      }

      return { tutor, reasons, score };
    })
    .sort((a, b) => b.score - a.score || a.tutor.name.localeCompare(b.tutor.name));
}

function SelectionMark({ selected }: { selected: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`flex size-6 shrink-0 items-center justify-center rounded-full border transition-colors ${
        selected
          ? 'border-[var(--color-accent)] bg-[var(--color-accent)] text-white'
          : 'border-white/25 text-transparent'
      }`}
    >
      <Check className="size-3.5" strokeWidth={3} />
    </span>
  );
}

export default function MatchingWizard() {
  const [step, setStep] = useState(1);
  const [preferences, setPreferences] = useState<MatchPreferences>({
    subjectId: null,
    goals: [],
    language: 'Deutsch',
    location: 'online',
  });

  const matches = useMemo(() => rankTutors(preferences), [preferences]);
  const subject = SUBJECT_CATALOG.find((item) => item.id === preferences.subjectId);

  const toggleGoal = (goalId: GoalId) => {
    setPreferences((current) => ({
      ...current,
      goals: current.goals.includes(goalId)
        ? current.goals.filter((id) => id !== goalId)
        : [...current.goals, goalId],
    }));
  };

  const canContinue =
    (step === 1 && Boolean(preferences.subjectId)) ||
    (step === 2 && preferences.goals.length > 0);

  return (
    <div className="min-h-screen bg-[var(--color-ink)] pb-24 pt-28 text-white sm:pt-36">
      <div className="site-container max-w-5xl">
        <div className="mb-8 flex items-end justify-between gap-6">
          <div>
            <p className="eyebrow mb-3">Tutorsuche</p>
            <h1 className="max-w-3xl text-3xl font-semibold tracking-[-0.04em] sm:text-5xl">
              In drei kurzen Schritten zum passenden Mentor.
            </h1>
          </div>
          <p className="hidden text-sm text-white/55 sm:block">Schritt {step} von 3</p>
        </div>

        <div className="mb-8 h-1 overflow-hidden rounded-full bg-white/10" aria-hidden="true">
          <div
            className="h-full rounded-full bg-[var(--color-accent)] transition-[width] duration-300"
            style={{ width: `${(step / 3) * 100}%` }}
          />
        </div>

        <section className="rounded-[2rem] border border-white/10 bg-white/[0.045] p-5 shadow-2xl shadow-black/20 sm:p-8 lg:p-10">
          {step === 1 && (
            <fieldset>
              <legend className="text-2xl font-semibold tracking-tight sm:text-3xl">
                Wobei brauchst du Unterstützung?
              </legend>
              <p className="mt-2 text-white/60">Wähle das Fach für deinen ersten Termin.</p>
              <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {SUBJECT_CATALOG.map((item) => {
                  const selected = preferences.subjectId === item.id;
                  return (
                    <label
                      key={item.id}
                      className={`choice-card group flex min-h-28 cursor-pointer flex-col justify-between rounded-2xl border p-4 transition-colors ${
                        selected
                          ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/12'
                          : 'border-white/10 bg-black/10 hover:border-white/25 hover:bg-white/[0.04]'
                      }`}
                    >
                      <input
                        type="radio"
                        name="subject"
                        value={item.id}
                        checked={selected}
                        onChange={() =>
                          setPreferences((current) => ({ ...current, subjectId: item.id }))
                        }
                        className="sr-only"
                      />
                      <BookOpen className="size-5 text-[var(--color-accent-soft)]" />
                      <span className="flex items-center justify-between gap-3 font-medium">
                        {item.name}
                        <SelectionMark selected={selected} />
                      </span>
                    </label>
                  );
                })}
              </div>
            </fieldset>
          )}

          {step === 2 && (
            <div>
              <fieldset>
                <legend className="text-2xl font-semibold tracking-tight sm:text-3xl">
                  Was soll sich zuerst verbessern?
                </legend>
                <p className="mt-2 text-white/60">Mehrfachauswahl ist möglich.</p>
                <div className="mt-7 grid gap-3 sm:grid-cols-2">
                  {GOALS.map((goal) => {
                    const selected = preferences.goals.includes(goal.id);
                    return (
                      <label
                        key={goal.id}
                        className={`choice-card flex cursor-pointer items-start gap-4 rounded-2xl border p-4 transition-colors ${
                          selected
                            ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/12'
                            : 'border-white/10 bg-black/10 hover:border-white/25'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={() => toggleGoal(goal.id)}
                          className="sr-only"
                        />
                        <SelectionMark selected={selected} />
                        <span>
                          <span className="block font-medium">{goal.label}</span>
                          <span className="mt-1 block text-sm leading-6 text-white/55">
                            {goal.description}
                          </span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              </fieldset>

              <div className="mt-8 grid gap-6 border-t border-white/10 pt-8 sm:grid-cols-2">
                <fieldset>
                  <legend className="flex items-center gap-2 font-medium">
                    <Globe2 className="size-4 text-[var(--color-accent-soft)]" />
                    Unterrichtssprache
                  </legend>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    {LANGUAGES.map((language) => (
                      <label
                        key={language}
                        className={`choice-card cursor-pointer rounded-xl border px-3 py-2.5 text-center text-sm transition-colors ${
                          preferences.language === language
                            ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/12 text-white'
                            : 'border-white/10 text-white/65 hover:border-white/25'
                        }`}
                      >
                        <input
                          className="sr-only"
                          type="radio"
                          name="language"
                          checked={preferences.language === language}
                          onChange={() =>
                            setPreferences((current) => ({ ...current, language }))
                          }
                        />
                        {language}
                      </label>
                    ))}
                  </div>
                </fieldset>

                <fieldset>
                  <legend className="flex items-center gap-2 font-medium">
                    <MapPin className="size-4 text-[var(--color-accent-soft)]" />
                    Unterrichtsort
                  </legend>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    {(
                      [
                        ['online', 'Online', Laptop],
                        ['in-person', 'In München', MapPin],
                      ] as const
                    ).map(([value, label, Icon]) => (
                      <label
                        key={value}
                        className={`choice-card flex cursor-pointer items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm transition-colors ${
                          preferences.location === value
                            ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/12 text-white'
                            : 'border-white/10 text-white/65 hover:border-white/25'
                        }`}
                      >
                        <input
                          className="sr-only"
                          type="radio"
                          name="location"
                          checked={preferences.location === value}
                          onChange={() =>
                            setPreferences((current) => ({ ...current, location: value }))
                          }
                        />
                        <Icon className="size-4" />
                        {label}
                      </label>
                    ))}
                  </div>
                </fieldset>
              </div>
            </div>
          )}

          {step === 3 && (
            <div>
              <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
                <div>
                  <p className="eyebrow mb-3">Deine Auswahl für {subject?.name}</p>
                  <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                    Diese Mentoren passen fachlich zu deiner Anfrage.
                  </h2>
                </div>
                <p className="max-w-sm text-sm leading-6 text-white/55">
                  Die Reihenfolge berücksichtigt Fach, Sprache, Unterrichtsort und gegebenenfalls Wettbewerbserfahrung.
                </p>
              </div>

              {matches.length > 0 ? (
                <div className="mt-8 grid gap-4 lg:grid-cols-2">
                  {matches.map(({ tutor, reasons }, index) => {
                    const params = new URLSearchParams({
                      tutor: tutor.slug,
                      subject: preferences.subjectId ?? '',
                      location: preferences.location,
                    });

                    return (
                      <article
                        key={tutor.slug}
                        className="overflow-hidden rounded-2xl border border-white/10 bg-black/15"
                      >
                        <div className="grid grid-cols-[7.5rem_1fr] gap-4 p-4">
                          <div className="relative min-h-40 overflow-hidden rounded-xl bg-white/5">
                            <Image
                              src={tutor.image}
                              alt={`Porträt von ${tutor.name}`}
                              fill
                              sizes="120px"
                              className="object-cover"
                            />
                          </div>
                          <div className="min-w-0 py-1">
                            <div className="flex items-center justify-between gap-3">
                              <p className="text-xs font-medium uppercase tracking-[0.16em] text-[var(--color-accent-soft)]">
                                {index === 0 ? 'Erste Empfehlung' : 'Weitere Empfehlung'}
                              </p>
                              <Award className="size-4 text-[var(--ink-subtle)]" />
                            </div>
                            <h3 className="mt-2 text-xl font-semibold">{tutor.name}</h3>
                            <p className="mt-1 text-sm leading-6 text-white/55">{tutor.bio}</p>
                            <ul className="mt-3 space-y-1.5 text-xs text-white/65">
                              {reasons.slice(0, 3).map((reason) => (
                                <li key={reason} className="flex items-center gap-2">
                                  <Check className="size-3.5 text-[var(--color-accent-soft)]" />
                                  {reason}
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>
                        <Link
                          href={`/booking?${params.toString()}`}
                          className="flex items-center justify-between border-t border-white/10 px-4 py-3.5 text-sm font-medium text-white transition-colors hover:bg-white/[0.05]"
                        >
                          Termin mit {tutor.name.split(' ')[0]} finden
                          <ArrowRight className="size-4" />
                        </Link>
                      </article>
                    );
                  })}
                </div>
              ) : (
                <div className="mt-8 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-8 text-center">
                  <Target className="mx-auto size-8 text-[var(--color-accent-soft)]" />
                  <h3 className="mt-4 text-lg font-medium">Aktuell kein exakter Treffer</h3>
                  <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-white/55">
                    Für diese Kombination ist noch kein Mentor hinterlegt. Schreib uns kurz. Wir
                    prüfen persönlich, wer passen könnte.
                  </p>
                  <a
                    href="mailto:munichscholarmentors@gmail.com"
                    className="mt-5 inline-flex items-center gap-2 font-medium text-[var(--color-accent-soft)]"
                  >
                    Anfrage per E Mail senden <ArrowRight className="size-4" />
                  </a>
                </div>
              )}
            </div>
          )}
        </section>

        <div className="mt-6 flex items-center justify-between gap-4">
          {step > 1 ? (
            <button
              type="button"
              onClick={() => setStep((current) => current - 1)}
              className="inline-flex min-h-11 items-center gap-2 rounded-full border border-white/15 px-5 text-sm font-medium text-white/75 transition-colors hover:border-white/35 hover:text-white"
            >
              <ArrowLeft className="size-4" /> Zurück
            </button>
          ) : (
            <Link
              href="/"
              className="inline-flex min-h-11 items-center gap-2 rounded-full px-2 text-sm font-medium text-white/55 hover:text-white"
            >
              <ArrowLeft className="size-4" /> Zur Startseite
            </Link>
          )}

          {step < 3 && (
            <button
              type="button"
              disabled={!canContinue}
              onClick={() => setStep((current) => current + 1)}
              className="inline-flex min-h-11 items-center gap-2 rounded-full bg-[var(--color-accent)] px-6 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-accent-strong)] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {step === 2 ? 'Empfehlungen anzeigen' : 'Weiter'}
              <ArrowRight className="size-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
