/**
 * All personal content lives here. Edit this file to update the site.
 * Details come from Resume.pdf.
 */

export interface Project {
  name: string;
  /** Where clicking the project name goes. */
  url: string;
  /** Extra links shown under the description, e.g. a Devpost page. */
  links?: { label: string; href: string }[];
  when: string;
  description: string;
  stack?: string[];
}

export interface ContactLink {
  label: string;
  value: string;
  href: string;
}

export interface Experience {
  role: string;
  org: string;
  where: string;
  when: string;
  points: string[];
}

export const profile = {
  /** Shown as the site title, hero heading and terminal username. */
  name: 'Ariq',
  fullName: 'Shadman Muhtasim Ariq',
  /** Lowercase handle used in the shell prompt, e.g. ariq@portfolio. */
  handle: 'ariq',
  /** Home screen lines under the name. */
  role: 'Computer Science, Monash University',
  location: 'Melbourne, Victoria',

  funFacts: ['Jack of all trades, master of none', 'I always have more than 15 tabs open', 'Bob the Builder'],

  about: {
    /** README.md in about-me; blank lines start new paragraphs. */
    summary:
      "Love to build software and algorithms that ships. Systems that scale.\n\nI'm ambitious. I work across the full stack, I still have a lot to learn, and I throw myself at every opportunity to learn it.",
    details: [
      { key: 'name', value: 'Shadman Muhtasim Ariq' },
      { key: 'studying', value: 'Bachelor of Computer Science' },
      { key: 'specialisation', value: 'Algorithms and Software' },
      { key: 'university', value: 'Monash University (Jan 2026 – present)' },
      { key: 'based in', value: 'Melbourne, Victoria' },
      { key: 'currently', value: 'Building an iOS app with Swift and Supabase' },
      { key: 'before', value: 'A levels in Computer Science, Physics & Maths, SFX Greenherald International School (Certificate for Honors, straight A’s)' },
    ],
    involvement: [
      'Projects Team member, MNET (Monash Nexus Emerging Tech)',
      "Social Media Manager, gdgmonash (Google Developer's Club Monash)",
      'Hackathon Finalist, MelbourneHack (hosted by the University of Melbourne)',
    ],
    experience: [
      {
        role: 'Intern, Graphic Design',
        org: 'Holycity Developments Limited',
        where: 'Dhaka, Bangladesh',
        when: 'Jun 2024 – Aug 2024',
        points: ['Created their physical portfolio showing the history of the company and all of their projects.'],
      },
    ] satisfies Experience[],
    skills: [
      'TypeScript',
      'JavaScript',
      'React',
      'Next.js',
      'Vite',
      'FastAPI',
      'Supabase',
      'Python',
      'C++',
      'Java',
      'Swift',
      'HTML',
      'CSS',
      'pnpm',
    ],
  },

  projects: [
    {
      name: 'EaMoSleMo',
      url: 'https://eamoslemo.vercel.app/',
      links: [
        { label: 'website', href: 'https://eamoslemo.vercel.app/' },
        { label: 'devpost', href: 'https://devpost.com/software/eamoslemo' },
      ],
      when: 'Apr 2026 – present',
      description:
        'A wellness helper app that tracks your sleep, exercise and nutrition, then recommends a full weekly meal plan that fits your goals and your grocery budget. Built with a team of strangers I met on the first day of the hackathon.',
    },
    {
      name: 'Racle',
      url: 'https://racle-one.vercel.app/',
      links: [
        { label: 'website', href: 'https://racle-one.vercel.app/' },
        { label: 'github', href: 'https://github.com/Ariq100/Racle' },
        { label: 'devpost', href: 'https://devpost.com/software/rackle' },
      ],
      when: 'Aug 2026',
      description:
        'A gamified AI receipt scanner that tracks food carbon footprints and maps nearby scrap vendors for instant recycling cash payouts.',
    },
    {
      name: 'PEDDY',
      url: 'https://petad0pti0n.netlify.app/',
      links: [
        { label: 'website', href: 'https://petad0pti0n.netlify.app/' },
        { label: 'github', href: 'https://github.com/Ariq100/Peddy' },
      ],
      when: 'Dec 2025',
      description:
        "A responsive pet adoption platform built for a Programming Hero assignment. Browse pets by category, view details and adopt, with dynamic data from Programming Hero's APIs.",
    },
  ] as Project[],

  contact: [
    { label: 'linkedin', value: 'linkedin.com/in/shadman-ariq', href: 'https://www.linkedin.com/in/shadman-ariq/' },
    { label: 'github', value: 'github.com/Ariq100', href: 'https://github.com/Ariq100' },
    { label: 'email', value: '5002.ariq@gmail.com', href: 'mailto:5002.ariq@gmail.com' },
  ] satisfies ContactLink[],
};
