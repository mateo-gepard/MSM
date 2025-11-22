# Copilot Instructions

<!-- Use this file to provide workspace-specific custom instructions to Copilot. For more details, visit https://code.visualstudio.com/docs/copilot/copilot-customization#_use-a-githubcopilotinstructionsmd-file -->

## Project Overview
This is a premium tutoring platform (Elite Tutoring Munich) built with Next.js 14, TypeScript, Tailwind CSS, and Framer Motion.

## Design System
- **Color Palette**: 
  - Primary Dark: #081525
  - Secondary Dark: #102A43
  - Accent Purple: #6E56CF
- **Design Principles**:
  - Professional but approachable
  - Use frosted glass (backdrop-blur) effects
  - Implement parallax scrolling
  - Add hover-to-enlarge animations
  - Replace emojis with icons from lucide-react
  - Modern, premium feel for high-paying clientele

## Tech Stack
- **Frontend**: Next.js 14 (App Router), TypeScript, Tailwind CSS
- **Animations**: Framer Motion
- **Authentication**: Supabase Auth
- **Booking**: Cal.com API integration
- **Messaging**: Sendbird Chat API
- **Icons**: lucide-react

## Key Features
1. Landing page with hero, tutor cards, and pricing
2. Matching wizard (5 steps): subject, goal, learning style, urgency, language
3. Booking system integrated with Cal.com
4. Parent dashboard with messaging, bookings, and calendar
5. Responsive design with advanced UI effects

## Code Standards
- Use TypeScript strictly
- Implement server components where possible
- Use "use client" only when necessary (animations, interactions)
- Follow Next.js 14 App Router conventions
- Keep components modular and reusable
- Use Tailwind CSS utility classes
- Implement proper error handling
