# MusicVis

**[▶ Live Demo](https://lukasdiem.github.io/musicvis/)**

A browser-based music visualizer that deforms 3D meshes in real time according to music playback. It supports two rendering modes: a spectral **Manifold Harmonics** mode based on the paper *Stereo Music Visualization Through Manifold Harmonics* by T. Lewiner et al., and a **Procedural** deformation mode.

## Features

- **Manifold Harmonics mode** — reconstructs mesh positions from precomputed MHB basis vectors stored as GPU textures, deforming exactly to the spectral decomposition of the audio signal.
- **Procedural mode** — real-time vertex displacement driven by audio frequency bands and Perlin-style noise.
- **Animated background** — fBm noise nebula that pulses with low/mid/high frequency energy (dark mode).
- **Particle field** — 2500 additive particles that expand on bass hits (dark mode) or render as soft opaque dots (light mode).
- **Post-processing bloom** — `UnrealBloomPass` via Three.js `EffectComposer`, applied only in dark mode.
- **Theme switching** — light and dark modes with independent lighting and material tuning.
- **Drag and drop audio** — drop any MP3 onto the page to replace the sample track.



## Models

| Name   | Vertices | Description        |
|--|-|--|
| Head   | 9 079    | Human head scan    |
| Homer  | 585      | Homer Simpson bust |
| Eight  | 315      | Figure-eight knot  |

Each model ships with a precomputed `.mhb` binary file containing 50 manifold harmonics basis vectors.



## Tech Stack

| Tool / API | Role |
|||
| [Three.js 0.161](https://threejs.org/) | 3D rendering, shaders, particles, post-processing |
| [Vite 5.4](https://vite.dev/) | Build pipeline, asset handling, dev server |
| [WebGL](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API) | GPU rendering backend |
| [Web Audio API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API) | Audio playback and FFT frequency analysis |
| GLSL | Custom vertex/fragment shaders for manifold reconstruction, background, and particles |



## Build & Run

### Prerequisites

- [Node.js](https://nodejs.org/) 18 or later
- npm (bundled with Node.js)

### Install dependencies

```bash
npm install
```

### Development server (hot-reload)

```bash
npm run dev
```

Opens at `http://localhost:5173`.

### Production build

```bash
npm run build
```

Output is written to `dist/`.

### Preview the production build locally

```bash
npm run preview -- --host 127.0.0.1 --port 8000
```

Or use the convenience script on Windows:

```bat
startServer.bat
```

This runs `npm run build` and then starts the Vite preview server at `http://127.0.0.1:8000`.



## Deployment

The site is deployed to [GitHub Pages](https://lukasdiem.github.io/musicvis/) automatically on every push to `main` via the workflow in [`.github/workflows/deploy-pages.yml`](.github/workflows/deploy-pages.yml).



## Credits

- Music: Viacheslav Starostin (Pixabay)
- MHB algorithm: *Stereo Music Visualization Through Manifold Harmonics* — T. Lewiner et al.; *Spectral Geometry Processing with Manifold Harmonics* — B. Vallet & B. Lévy
- Originally developed as part of the *Visualisierung 2* course at TU Wien
