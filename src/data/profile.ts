/**
 * All personal content lives here. Edit this file to update the site.
 * Anything wrapped in <angle brackets> is a placeholder to replace.
 */

export interface Project {
  name: string;
  url: string;
  description: string;
  stack: string[];
}

export interface ContactLink {
  label: string;
  value: string;
  href: string;
}

export const profile = {
  /** Shown as the site title, hero heading and terminal username. */
  name: 'Ariq',
  /** Lowercase handle used in the shell prompt, e.g. ariq@portfolio. */
  handle: 'ariq',
  role: 'Software Developer',
  location: '<Your City, Country>',

  funFacts: [
    '<Fun fact #1 — e.g. I wrote my first program at 12 to cheat at a browser game>',
    '<Fun fact #2 — e.g. I have visited 14 countries>',
    '<Fun fact #3 — e.g. I can solve a Rubik’s cube in under a minute>',
    '<Fun fact #4 — e.g. My coffee order is embarrassingly long>',
    '<Fun fact #5 — e.g. I prefer tabs, but I will not fight you about it>',
  ],

  about: {
    summary:
      '<A few sentences about who you are, what you build and what you care about. Keep it friendly and specific.>',
    details: [
      { key: 'name', value: 'Ariq' },
      { key: 'role', value: 'Software Developer' },
      { key: 'education', value: '<Degree, University>' },
      { key: 'experience', value: '<N years building web apps>' },
      { key: 'currently', value: '<What you are working on or learning>' },
      { key: 'interests', value: '<Hobbies outside of code>' },
    ],
    skills: ['TypeScript', 'React', 'Node.js', 'Three.js', '<Skill>', '<Skill>'],
  },

  projects: [
    {
      name: '<Project One>',
      url: 'https://example.com',
      description: '<One or two sentences on what this website does and who it is for.>',
      stack: ['React', 'TypeScript'],
    },
    {
      name: '<Project Two>',
      url: 'https://example.com',
      description: '<One or two sentences on what this website does and who it is for.>',
      stack: ['Node.js', 'PostgreSQL'],
    },
    {
      name: '<Project Three>',
      url: 'https://example.com',
      description: '<One or two sentences on what this website does and who it is for.>',
      stack: ['Next.js', 'Tailwind'],
    },
  ] satisfies Project[],

  contact: [
    { label: 'linkedin', value: 'linkedin.com/in/<username>', href: 'https://www.linkedin.com/in/<username>' },
    { label: 'github', value: 'github.com/<username>', href: 'https://github.com/<username>' },
    { label: 'email', value: '<you@example.com>', href: 'mailto:<you@example.com>' },
  ] satisfies ContactLink[],
};
