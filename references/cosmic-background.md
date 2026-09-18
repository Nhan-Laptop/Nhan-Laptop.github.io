# Cosmic background redesign

## Direction

Replace the original cube swarm, wire rings, and eight scroll-morphed formations with a coherent spiral galaxy. This is artistic procedural imagery, not an astronomical simulation.

- Three spiral arms with seeded scatter and a compact warm stellar population.
- Pale blue/white outer stars, muted violet haze, no saturated confetti palette.
- Round Gaussian point sprites; no texture downloads or full-screen bloom passes.
- Three draw calls: distant stars, galaxy stars, diffuse galaxy haze.
- Slow disk rotation, subtle pointer parallax, and small eased scroll changes.
- Background intensity is lower on content pages than on the Universe showcase.
- 30 FPS cap on content/mobile, 45 FPS on the desktop showcase; capped pixel ratio and lower mobile particle counts. These are configuration limits, not measured performance guarantees.
- Pause control, hidden-tab suspension, reduced-motion static first frame, CSS fallback when WebGL cannot initialize.

## References consulted

- https://threejs-journey.com/lessons/animated-galaxy — GPU animation and procedural point-sprite patterns. Implementation here is original, not copied lesson code.
- https://threejs.org/docs/#Points — point-cloud rendering API.
- https://science.nasa.gov/asset/webb/webb-and-hubbles-views-of-spiral-galaxy-ngc-1672/ — visible versus infrared galaxy structure. Visual inspiration only; no NASA image is downloaded or shipped.

## Files

- `src/universe/formations.js`: seeded star positions and attributes.
- `src/universe/palette.js`: restrained warm/cool stellar colors.
- `src/universe/renderer.js`: point/haze shaders and lifecycle.
- `src/universe/runtime.js`: page mode, motion preference, pause control.
- `assets/css/redesign.css`: fallback sky and showcase presentation.
- `universe.html`: accessible, viewport-sized showcase instead of an empty 760vh scroll area.

Build through `npm run build:n1ctf`. During this preview, use `BLOG_SKIP_POSTS=life-the-first-viasm-with-crypto.md` to keep the existing untracked draft out of generated archives.
