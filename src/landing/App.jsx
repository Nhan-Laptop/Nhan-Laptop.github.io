import { useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion, useScroll, useTransform } from 'framer-motion';
import { startSky } from './sky.js';

// Listed in scene order: each chapter sits over the matching body in formations.js.
const CHAPTERS = [
  {
    name: 'Learning',
    text: 'Long notes on cryptography, lattices and malware internals.',
    action: 'Read the learning notes',
    href: 'categories/learning.html',
  },
  {
    name: 'Writeups',
    text: 'CTF challenges, solved step by step.',
    action: 'Read the writeups',
    href: 'categories/writeup.html',
  },
  {
    name: 'Projects',
    text: 'Research prototypes and security tooling.',
    action: 'See the projects',
    href: 'categories/project.html',
  },
  {
    name: 'Life',
    text: 'Travel and personal logs between the work.',
    action: 'Read the life log',
    href: 'categories/life.html',
  },
];

const HEADLINE = ['Every secret', 'leaves a trace.'];

// Reads where each [data-scene] section holds still, then maps scrollY onto a
// fractional scene index. Offsets are cached because reading layout per frame is slow.
function useSceneTracker() {
  const anchors = useRef([0]);

  useEffect(() => {
    const measure = () => {
      const vh = window.innerHeight;
      anchors.current = [...document.querySelectorAll('[data-scene]')].map((section) =>
        Math.max(section.offsetTop + (section.offsetHeight - vh) / 2, 0),
      );
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  return () => {
    const list = anchors.current;
    const y = window.scrollY;
    const height = document.documentElement.scrollHeight - window.innerHeight;
    const scroll = height > 0 ? Math.min(y / height, 1) : 0;
    let scene = list.length - 1;
    for (let i = 0; i < list.length - 1; i += 1) {
      if (y < list[i + 1]) {
        scene = i + Math.max((y - list[i]) / (list[i + 1] - list[i]), 0);
        break;
      }
    }
    const rest = y > list[list.length - 1] + window.innerHeight * 0.7;
    return { scene, scroll, rest };
  };
}

function Sky({ reducedMotion, dim }) {
  const canvasRef = useRef(null);
  const [failed, setFailed] = useState(false);
  const [paused, setPaused] = useState(false);
  const pausedRef = useRef(false);
  pausedRef.current = paused;
  const getView = useSceneTracker();
  const viewRef = useRef(getView);
  viewRef.current = getView;

  useEffect(() => {
    try {
      const stop = startSky(canvasRef.current, {
        getView: () => viewRef.current(),
        isPaused: () => pausedRef.current,
        reducedMotion,
        onLost: () => setFailed(true),
      });
      if (!stop) setFailed(true);
      return stop ?? undefined;
    } catch (error) {
      console.error(error);
      setFailed(true);
      return undefined;
    }
  }, [reducedMotion]);

  return (
    <>
      <motion.div aria-hidden="true" className="fixed inset-0 -z-10 overflow-hidden bg-void" style={{ opacity: dim }}>
        {failed ? (
          <div className="sky-fallback absolute inset-0" />
        ) : (
          <canvas ref={canvasRef} className="absolute inset-0 size-full" />
        )}
      </motion.div>
      {!failed && !reducedMotion && (
        <button type="button" className="cosmic-motion-button" onClick={() => setPaused((value) => !value)}>
          {paused ? 'Play cosmos' : 'Pause cosmos'}
        </button>
      )}
    </>
  );
}

// One blur-to-sharp reveal, timed to land as the stars finish unfolding.
function FocusIn({ as = 'div', delay, reducedMotion, className, children }) {
  const Component = motion[as];
  if (reducedMotion) {
    const Static = as;
    return <Static className={className}>{children}</Static>;
  }
  return (
    <Component
      className={className}
      initial={{ opacity: 0, filter: 'blur(14px)' }}
      animate={{ opacity: 1, filter: 'blur(0px)' }}
      transition={{ delay, duration: 1.3, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </Component>
  );
}

// Copy focuses in while its planet forms, and blurs away as that planet breaks up.
function Chapter({ chapter, id, reducedMotion }) {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] });
  const opacity = useTransform(scrollYProgress, [0.24, 0.38, 0.62, 0.76], [0, 1, 1, 0]);
  const blur = useTransform(
    scrollYProgress,
    [0.24, 0.38, 0.62, 0.76],
    ['blur(12px)', 'blur(0px)', 'blur(0px)', 'blur(12px)'],
  );

  return (
    <section ref={ref} id={id} data-scene aria-labelledby={`${chapter.name}-title`} className="relative h-[190svh]">
      <div className="sticky top-0 flex h-svh items-end overflow-hidden px-4 pb-28 sm:items-center sm:px-8 sm:pb-0">
        <motion.div
          className="mx-auto w-full max-w-6xl"
          style={reducedMotion ? undefined : { opacity, filter: blur }}
        >
          <div className="max-w-[26rem]">
            <h2
              id={`${chapter.name}-title`}
              className="text-[clamp(3rem,7vw,5.5rem)] leading-none font-light tracking-[-0.035em] text-star"
            >
              {chapter.name}
            </h2>
            <p className="mt-4 text-lg leading-relaxed font-light text-balance text-mist sm:text-xl">{chapter.text}</p>
            <a className="btn btn-secondary mt-8" href={chapter.href}>
              {chapter.action}
            </a>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

export default function App() {
  const reducedMotion = useReducedMotion();
  const heroRef = useRef(null);
  const { scrollYProgress: heroProgress } = useScroll({
    target: heroRef,
    offset: ['start start', 'end end'],
  });
  const copyOpacity = useTransform(heroProgress, [0.45, 0.95], [1, 0]);
  const copyY = useTransform(heroProgress, [0.45, 0.95], [0, -70]);
  const copyBlur = useTransform(heroProgress, [0.45, 0.95], ['blur(0px)', 'blur(10px)']);

  // Fades the sky back so the posts that follow the journey stay easy to read.
  const closingRef = useRef(null);
  const { scrollYProgress: closingProgress } = useScroll({
    target: closingRef,
    offset: ['center center', 'end start'],
  });
  const skyDim = useTransform(closingProgress, [0, 1], [1, 0.32]);

  // The journey adds height above any section a link points to, so scroll again.
  useEffect(() => {
    const target = window.location.hash && document.getElementById(window.location.hash.slice(1));
    if (target) target.scrollIntoView({ behavior: 'auto' });
  }, []);

  return (
    <>
      <Sky reducedMotion={Boolean(reducedMotion)} dim={skyDim} />

      <section ref={heroRef} data-scene className="relative h-[170svh]">
          <div className="sticky top-0 flex h-svh items-center justify-center overflow-hidden px-4 pb-[24svh]">
            <div aria-hidden="true" className="hero-scrim absolute inset-0" />
            <motion.div
              className="relative max-w-3xl text-center"
              style={reducedMotion ? undefined : { opacity: copyOpacity, y: copyY, filter: copyBlur }}
            >
              <h1 className="text-[clamp(2.75rem,8.5vw,6.5rem)] leading-[1.02] font-light tracking-[-0.035em] text-star">
                {HEADLINE.map((line, index) => (
                  <FocusIn
                    key={line}
                    delay={1.1 + index * 0.35}
                    reducedMotion={reducedMotion}
                    className="block"
                  >
                    {line}
                  </FocusIn>
                ))}
              </h1>
              <FocusIn
                as="p"
                delay={1.9}
                reducedMotion={reducedMotion}
                className="mx-auto mt-6 max-w-[34rem] text-lg leading-relaxed font-light text-balance text-mist sm:text-xl"
              >
                Notes on cryptography, CTF challenges and malware, written while
                figuring them out.
              </FocusIn>
              <FocusIn
                delay={2.25}
                reducedMotion={reducedMotion}
                className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row"
              >
                <a className="btn btn-primary" href="#latest-posts">
                  Read the latest notes
                </a>
                <a className="btn btn-secondary" href="#topics">
                  Browse topics
                </a>
              </FocusIn>
            </motion.div>
          </div>
        </section>

        {CHAPTERS.map((chapter, index) => (
          <Chapter
            key={chapter.name}
            chapter={chapter}
            id={index === 0 ? 'topics' : undefined}
            reducedMotion={reducedMotion}
          />
        ))}

        <section ref={closingRef} data-scene className="relative flex h-[130svh] items-end justify-center px-4 pb-[35svh]">
          <div className="text-center">
            <h2 className="text-[clamp(2.25rem,6vw,4.5rem)] leading-tight font-light tracking-[-0.03em] text-balance text-star">
              Start with what's new.
            </h2>
            <a className="btn btn-primary mt-8" href="#latest-posts">
              Read the latest notes
            </a>
          </div>
        </section>
    </>
  );
}
