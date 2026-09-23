# Ariq — 3D Portfolio

My personal portfolio, built as a macOS Terminal session you scroll through. Each section types its own commands and prints the output, while wireframe 3D models float behind the text and the cursor rips holes through the screen.

**Live:** [ariq100.vercel.app](https://ariq100.vercel.app/)

## Stack

Vite 7 · React 19 · TypeScript 5.9 (strict) · three.js via @react-three/fiber. No CSS framework, router or state library.

## Layout

```
public/
  images/     photos used by the site
  models/     wireframes extracted from 3D models, loaded at boot
src/
  data/profile.ts   all content: bio, fun facts, projects, links
  components/       terminal, nav, boot screen, tear canvas, 3D scene
  sections/         home, about-me, projects, contact
  three/            model builders, loaders, text-coverage check
  styles.css        every style
tools/
  extract_wireframe.py   Blender: a real 3D model → a wireframe file
  prepare_home_photo.py  home photo → the web copy the site loads
```

Everything the site says lives in [`src/data/profile.ts`](src/data/profile.ts).