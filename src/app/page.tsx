import { Hero } from '@/components/sections/Hero';
import { FeaturesSection } from '@/components/sections/FeaturesSection';
import { TutorsSection } from '@/components/sections/TutorsSection';
import { PricingSection } from '@/components/sections/PricingSection';

export default function Home() {
  return (
    <>
      <Hero />
      <TutorsSection />
      <FeaturesSection />
      <PricingSection />
    </>
  );
}

