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
    summary:
      "Self-taught developer who picked up Python, C++, Java and JavaScript on my own, then moved into React and full-stack web development. I recently taught myself TypeScript in a single hackathon night to keep up with a new team's stack, and I'm currently building an iOS app with Swift and Supabase, a language and framework I learned from scratch for the project. I'd rather learn a new tool mid-project than sit one out, and building things - fast, and often outside my comfort zone - is what keeps me in this field.",
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
        role: 'USG (Under Secretary General), Hospitality',
        org: 'SFX Greenherald International School',
        where: 'Dhaka, Bangladesh',
        when: 'Jun 2025 – Jul 2025',
        points: [
          'Managed guests and attendees with a team.',
          "Built a supportive team environment by addressing team members' needs and giving timely recognition, lifting morale and guest experience.",
        ],
      },
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
      links: [{ label: 'devpost', href: 'https://devpost.com/software/eamoslemo' }],
      when: 'Apr 2026 – present',
      description:
        'A wellness helper app that tracks your sleep, exercise and nutrition, then recommends a full weekly meal plan that fits your goals and your grocery budget. Built with a team of strangers I met on the first day of the hackathon.',
    },
    {
      name: 'Racle',
      url: 'https://devpost.com/software/rackle',
      when: 'Aug 2026',
      description:
        'A gamified AI receipt scanner that tracks food carbon footprints and maps nearby scrap vendors for instant recycling cash payouts.',
    },
    {
      name: 'PEDDY',
      url: 'https://github.com/Ariq100/Peddy',
      when: 'Dec 2025',
      description:
        "A responsive pet adoption platform built for a Programming Hero assignment. Browse pets by category, view details and adopt, with dynamic data from Programming Hero's APIs.",
      stack: ['HTML', 'Tailwind', 'DaisyUI', 'JavaScript'],
    },
  ] satisfies Project[],

  contact: [
    { label: 'linkedin', value: 'linkedin.com/in/shadman-ariq', href: 'https://www.linkedin.com/in/shadman-ariq/' },
    { label: 'github', value: 'github.com/Ariq100', href: 'https://github.com/Ariq100' },
    { label: 'email', value: '5002.ariq@gmail.com', href: 'mailto:5002.ariq@gmail.com' },
  ] satisfies ContactLink[],
};
