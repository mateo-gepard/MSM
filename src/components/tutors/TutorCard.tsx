import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, Clock3, Languages } from 'lucide-react';
import type { Tutor } from '@/domain/catalog';
import { getSubjectName } from '@/domain/catalog';

interface TutorCardProps {
  tutor: Tutor;
}

export function TutorCard({ tutor }: TutorCardProps) {
  const titleId = `tutor-${tutor.slug}`;

  return (
    <article
      className="group interactive-surface flex h-full min-w-0 flex-col overflow-hidden border border-[var(--line)] bg-[var(--surface)]"
      aria-labelledby={titleId}
    >
      <div className="relative aspect-[16/10] w-full overflow-hidden bg-[var(--surface-raised)]">
        <Image
          src={tutor.image}
          alt={`Foto von ${tutor.name}`}
          fill
          sizes="(max-width: 767px) calc(100vw - 2rem), (max-width: 1279px) 50vw, 33vw"
          className="object-cover grayscale-[15%] transition-transform duration-300 group-hover:scale-[1.02]"
        />
        <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/65 to-transparent" aria-hidden="true" />
        {tutor.onlineOnly ? (
          <span className="absolute right-3 top-3 rounded-md border border-white/15 bg-black/70 px-2.5 py-1 text-[0.68rem] font-bold uppercase tracking-[0.1em] text-white">
            Online
          </span>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col p-5 sm:p-6">
        <div className="flex flex-wrap gap-1.5">
          {tutor.subjectIds.map((subjectId) => (
            <span
              key={subjectId}
              className="rounded-md bg-[#252136] px-2.5 py-1 text-[0.7rem] font-bold text-[#d7ceff]"
            >
              {getSubjectName(subjectId)}
            </span>
          ))}
        </div>

        <div className="mt-5">
          <h3 id={titleId} className="text-xl font-bold tracking-[-0.025em] text-[var(--ink)]">
            {tutor.name}
          </h3>
          <p className="mt-1 text-xs font-semibold uppercase tracking-[0.1em] text-[var(--ink-subtle)]">{tutor.grade}</p>
        </div>

        <div className="mt-6 flex-1 border-t border-[var(--line)] pt-5">
          <h4 className="text-xs font-bold uppercase tracking-[0.13em] text-[var(--ink-muted)]">Aus dem Profil</h4>
          <ul className="mt-3 space-y-2.5">
            {tutor.achievements.slice(0, 2).map((achievement) => (
              <li key={achievement} className="grid grid-cols-[0.45rem_1fr] gap-2.5 text-sm leading-6 text-[var(--ink-muted)]">
                <span className="mt-[0.6rem] h-1 w-1 rounded-full bg-[#6e56cf]" aria-hidden="true" />
                <span>{achievement}</span>
              </li>
            ))}
          </ul>
        </div>

        <dl className="mt-6 space-y-2.5 border-t border-[var(--line)] pt-5 text-xs text-[var(--ink-subtle)]">
          <div className="flex items-start gap-2">
            <Languages aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#9b83ff]" />
            <dt className="sr-only">Sprachen</dt>
            <dd>{tutor.languages.join(', ')}</dd>
          </div>
          <div className="flex items-start gap-2">
            <Clock3 aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#9b83ff]" />
            <dt className="sr-only">Verfügbarkeit</dt>
            <dd>{tutor.availability}</dd>
          </div>
        </dl>

        <Link
          href={`/booking?tutor=${tutor.slug}`}
          className="mt-6 inline-flex min-h-11 items-center justify-between gap-3 border-t border-[var(--line)] pt-5 text-sm font-bold text-[var(--ink)] hover:text-[var(--purple-soft)]"
          aria-label={`Termin mit ${tutor.name} auswählen`}
        >
          Termin auswählen
          <ArrowRight aria-hidden="true" className="h-4 w-4" />
        </Link>
      </div>
    </article>
  );
}
