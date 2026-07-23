import { FaqSection } from '@/components/sections/FaqSection';
import { FeaturesSection } from '@/components/sections/FeaturesSection';
import { FinalCtaSection } from '@/components/sections/FinalCtaSection';
import { Hero } from '@/components/sections/Hero';
import { PricingSection } from '@/components/sections/PricingSection';
import { TutorsSection } from '@/components/sections/TutorsSection';

export const dynamic = 'force-dynamic';

export default function Home() {
  return (
    <>
      <Hero />
      <TutorsSection />
      <FeaturesSection />
      <PricingSection />
      <FaqSection />
      <FinalCtaSection />
    </>
  );
}
