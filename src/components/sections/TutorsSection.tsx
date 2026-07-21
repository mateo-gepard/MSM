import { TUTOR_CATALOG } from '@/domain/catalog';
import { TutorCard } from '@/components/tutors/TutorCard';

export function TutorsSection() {
  return (
    <section id="tutoren" className="site-section scroll-mt-24" aria-labelledby="tutoren-title">
      <div className="site-container">
        <div className="grid gap-7 lg:grid-cols-[1fr_0.8fr] lg:items-end">
          <div>
            <p className="eyebrow">Das Team</p>
            <h2 id="tutoren-title" className="section-heading mt-6 text-[var(--ink)]">
              Unsere Tutoren
            </h2>
          </div>
          <p className="text-pretty max-w-xl text-base leading-7 text-[var(--ink-muted)] lg:justify-self-end">
            Unsere Tutoren verbinden fachliche Expertise mit nachweisbaren Erfolgen, Wettbewerbserfahrung und Frühstudium.
          </p>
        </div>

        <div className="mt-12 grid items-stretch gap-5 md:grid-cols-2 xl:grid-cols-3">
          {TUTOR_CATALOG.map((tutor) => (
            <TutorCard key={tutor.slug} tutor={tutor} />
          ))}
        </div>
      </div>
    </section>
  );
}
