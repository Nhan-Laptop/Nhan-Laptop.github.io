import { useEffect, useRef, useState } from 'react';
import { motion, useMotionValue, useReducedMotion, useScroll, useTransform } from 'framer-motion';
import { cometX, startSky } from './sky.js';

// Listed in scene order: each chapter sits over the matching body in formations.js.
const CHAPTERS = [
  {
    name: 'Learning',
    topic: 'learning',
    text: 'Long notes on cryptography, lattices and malware internals.',
    action: 'Read the learning notes',
    href: 'categories/learning.html',
  },
  {
    name: 'Writeups',
    topic: 'writeup',
    text: 'CTF challenges, solved step by step.',
    action: 'Read the writeups',
    href: 'categories/writeup.html',
  },
  {
    name: 'Projects',
    topic: 'project',
    text: 'Research prototypes and security tooling.',
    action: 'See the projects',
    href: 'categories/project.html',
  },
  {
    name: 'Life',
    topic: 'life',
    text: 'Travel and personal logs between the work.',
    action: 'Read the life log',
    href: 'categories/life.html',
  },
];

// The first chapter keeps the id that the hero's "Browse topics" link points to.
const chapterId = (chapter) => (chapter.topic === 'learning' ? 'topics' : `chapter-${chapter.topic}`);

const HEADLINE = ['Every secret', 'leaves a trace.'];
const GLYPHS = '0123456789abcdef';
const CHAPTER_DECODE = [0.26, 0.38, 0.62, 0.74];

// Text that reads as hex until `share` (0 to 1) has resolved it, left to right. Digits are drawn over
// each transparent letter, so the line never reflows. `tick` keeps them rolling while share holds still.
function DecodeText({ text, share, tick, reducedMotion }) {
  const root = useRef(null);

  useEffect(() => {
    if (reducedMotion) return undefined;
    const letters = [...root.current.querySelectorAll('.dc')];
    const paint = () => {
      const resolved = Math.round(share.get() * letters.length);
      const roll = Math.floor(performance.now() / 90);
      letters.forEach((letter, index) => {
        const coded = index >= resolved;
        const was = letter.classList.contains('is-coded');
        if (coded) letter.dataset.g = GLYPHS[(index * 7 + roll * (1 + (index % 3))) % 16];
        if (coded !== was) {
          letter.classList.toggle('is-coded', coded);
          letter.classList.toggle('dc-hit', !coded);
        }
      });
    };
    paint();
    const stops = [share.on('change', paint), tick?.on('change', paint)];
    return () => stops.forEach((stop) => stop?.());
  }, [share, tick, reducedMotion]);

  if (reducedMotion) return text;
  return (
    <span aria-hidden="true" ref={root}>
      {Array.from(text).map((letter, index) =>
        letter === ' ' ? (
          ' '
        ) : (
          <span key={index} className="dc is-coded" data-g="0">
            {letter}
          </span>
        ),
      )}
    </span>
  );
}

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

// Progress through a section between two scroll positions, from its measured box.
// Framer's useScroll({ target }) settled on wrong offsets for these sections, leaving chapter
// copy blurred while its planet was at rest, so this reads the page's scrollY directly.
function useSectionProgress(ref, range) {
  const { scrollY } = useScroll();
  const progress = useMotionValue(0);

  useEffect(() => {
    let box = { top: 0, height: 0, viewport: 1 };
    const update = (y) => {
      const [start, end] = range(box);
      progress.set(end > start ? Math.min(Math.max((y - start) / (end - start), 0), 1) : 0);
    };
    const measure = () => {
      const rect = ref.current.getBoundingClientRect();
      box = { top: rect.top + window.scrollY, height: rect.height, viewport: window.innerHeight };
      // Called directly: setting scrollY to the value it already holds would notify nobody,
      // leaving the page at the top with progress worked out from an unmeasured box.
      update(window.scrollY);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(document.documentElement);
    const unsubscribe = scrollY.on('change', update);
    return () => {
      observer.disconnect();
      unsubscribe();
    };
  }, [ref, range, scrollY, progress]);

  return progress;
}

const CHAPTER_RANGE = ({ top, height, viewport }) => [top - viewport, top + height];
const HERO_RANGE = ({ top, height, viewport }) => [top, top + height - viewport];
const CLOSING_ENTRY = ({ top, height, viewport }) => [top - viewport, top + height - viewport];
const CLOSING_RANGE = ({ top, height, viewport }) => [top + height / 2 - viewport / 2, top + height];

// Which chapter is on screen. A one-pixel band across the viewport's middle means
// exactly one section intersects at a time, with no scroll handler or layout reads.
function useActiveScene() {
  const [active, setActive] = useState(0);

  useEffect(() => {
    const sections = [...document.querySelectorAll('[data-scene]')];
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.find((entry) => entry.isIntersecting);
        if (visible) setActive(sections.indexOf(visible.target));
        // A jump can cross the closing section without it ever entering the band.
        else if (sections.at(-1).getBoundingClientRect().bottom < window.innerHeight / 2) setActive(-1);
      },
      { rootMargin: '-50% 0px -50% 0px' },
    );
    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, []);

  return active;
}

function JourneyRail() {
  const active = useActiveScene();
  return (
    <nav className="sky-rail" aria-label="Journey chapters" data-hidden={active === -1}>
      {CHAPTERS.map((chapter, index) => (
        <a
          key={chapter.name}
          href={`#${chapterId(chapter)}`}
          data-topic={chapter.topic}
          aria-current={active === index + 1 ? 'true' : undefined}
        >
          <span>{chapter.name}</span>
        </a>
      ))}
      <a className="sky-rail-skip" href="#latest-posts">
        <span>Skip to the notes</span>
      </a>
    </nav>
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
function Chapter({ chapter, reducedMotion }) {
  const ref = useRef(null);
  const scrollYProgress = useSectionProgress(ref, CHAPTER_RANGE);
  const opacity = useTransform(scrollYProgress, [0.24, 0.38, 0.62, 0.76], [0, 1, 1, 0]);
  const decoded = useTransform(scrollYProgress, CHAPTER_DECODE, [0, 1, 1, 0]);

  return (
    <section
      ref={ref}
      id={chapterId(chapter)}
      data-scene
      data-topic={chapter.topic}
      aria-labelledby={`${chapter.name}-title`}
      className="relative h-[130svh]"
    >
      <div className="sticky top-0 flex h-svh items-end overflow-hidden px-4 pb-28 sm:items-center sm:px-8 sm:pb-0">
        <motion.div aria-hidden="true" className="chapter-scrim absolute inset-0" style={reducedMotion ? undefined : { opacity }} />
        <motion.div
          className="relative mx-auto w-full max-w-6xl"
          style={reducedMotion ? undefined : { opacity }}
        >
          <h2
            id={`${chapter.name}-title`}
            aria-label={chapter.name}
            className="text-[clamp(3.5rem,19vw,5rem)] leading-[0.92] sm:text-[clamp(5rem,11.5vw,11rem)] font-light tracking-[-0.032em] whitespace-nowrap text-star"
          >
            <DecodeText text={chapter.name} share={decoded} reducedMotion={reducedMotion} />
          </h2>
          <div className="max-w-[26rem]">
            <p className="mt-3 text-xl leading-snug text-balance text-mist sm:text-2xl">{chapter.text}</p>
            <a className="btn btn-secondary mt-4" href={chapter.href}>
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
  const heroProgress = useSectionProgress(heroRef, HERO_RANGE);
  const copyOpacity = useTransform(heroProgress, [0.45, 0.95], [1, 0]);
  const copyY = useTransform(heroProgress, [0.45, 0.95], [0, -70]);
  // The comet decodes the headline on the way in, and leaving the hero encrypts it again.
  const staying = useTransform(heroProgress, [0.45, 0.85], [1, 0]);
  const introA = useMotionValue(reducedMotion ? 1 : 0);
  const introB = useMotionValue(reducedMotion ? 1 : 0);
  const decodedA = useTransform([introA, staying], ([a, b]) => Math.min(a, b));
  const decodedB = useTransform([introB, staying], ([a, b]) => Math.min(a, b));
  const introTick = useMotionValue(0);
  const lineRefs = useRef([]);

  useEffect(() => {
    if (reducedMotion) return undefined;
    const started = performance.now();
    let frame = 0;
    const step = (now) => {
      const seconds = (now - started) / 1000;
      const x = cometX(seconds);
      [introA, introB].forEach((intro, index) => {
        const box = lineRefs.current[index]?.getBoundingClientRect();
        if (!box?.width) return;
        const left = box.left / window.innerWidth;
        const width = box.width / window.innerWidth;
        intro.set(Math.min(Math.max((x - left) / width, 0), 1));
      });
      introTick.set(now);
      if (x < 1) frame = requestAnimationFrame(step);
      else {
        introA.set(1);
        introB.set(1);
      }
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [reducedMotion, introA, introB, introTick]);

  // Fades the sky back so the posts that follow the journey stay easy to read.
  const closingRef = useRef(null);
  const closingEntry = useSectionProgress(closingRef, CLOSING_ENTRY);
  const closingDecoded = useTransform(closingEntry, [0.25, 0.8], [0, 1]);
  const closingProgress = useSectionProgress(closingRef, CLOSING_RANGE);
  const skyDim = useTransform(closingProgress, [0, 1], [1, 0.2]);

  // The journey adds height above any section a link points to, so scroll again.
  useEffect(() => {
    const target = window.location.hash && document.getElementById(window.location.hash.slice(1));
    if (target) target.scrollIntoView({ behavior: 'auto' });
  }, []);

  return (
    <>
      <Sky reducedMotion={Boolean(reducedMotion)} dim={skyDim} />
      <JourneyRail />

      <section ref={heroRef} data-scene className="relative h-[130svh]">
          <div className="sticky top-0 flex h-svh items-center justify-center overflow-hidden px-4 pb-[24svh]">
            <div aria-hidden="true" className="hero-scrim absolute inset-0" />
            <motion.div
              className="relative max-w-5xl text-center"
              style={reducedMotion ? undefined : { opacity: copyOpacity, y: copyY }}
            >
              <h1
                aria-label={HEADLINE.join(' ')}
                className="text-[clamp(3.25rem,16.5vw,4.5rem)] leading-[0.96] sm:text-[clamp(4.5rem,10vw,9.25rem)] font-light tracking-[-0.03em] text-star"
              >
                {HEADLINE.map((line, index) => (
                  <motion.span
                    key={line}
                    className="block"
                    initial={reducedMotion ? false : { opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.5, duration: 0.7 }}
                  >
                    <span className="inline-block" ref={(node) => { lineRefs.current[index] = node; }}>
                      <DecodeText
                        text={line}
                        share={index === 0 ? decodedA : decodedB}
                        tick={introTick}
                        reducedMotion={reducedMotion}
                      />
                    </span>
                  </motion.span>
                ))}
              </h1>
              <FocusIn
                as="p"
                delay={1.9}
                reducedMotion={reducedMotion}
                className="mx-auto mt-5 max-w-[34rem] text-xl leading-snug text-balance text-mist sm:text-2xl"
              >
                Nguyen Trong Nhan's notes on cryptography, CTF challenges and malware,
                written while figuring them out.
              </FocusIn>
              <FocusIn
                delay={2.25}
                reducedMotion={reducedMotion}
                className="mt-7 flex flex-col items-center justify-center gap-x-6 gap-y-1 sm:flex-row"
              >
                <a className="btn btn-primary" href="#latest-posts">
                  Read the latest notes
                </a>
                <a className="btn btn-secondary" href="#topics">
                  Browse topics
                </a>
              </FocusIn>
              {!reducedMotion && (
                <FocusIn delay={3.3} reducedMotion={reducedMotion} className="sky-hint">
                  Move through the sky. Press and hold to bend it.
                </FocusIn>
              )}
            </motion.div>
          </div>
        </section>

        {CHAPTERS.map((chapter) => (
          <Chapter
            key={chapter.name}
            chapter={chapter}
            reducedMotion={reducedMotion}
          />
        ))}

        <section ref={closingRef} data-scene className="relative flex h-[90svh] items-end px-4">
          <div className="mx-auto w-full max-w-[56rem]">
            <h2
              aria-label="Start with what's new."
              className="text-[clamp(2.75rem,7vw,5.5rem)] leading-none font-light tracking-[-0.022em] text-balance text-star"
            >
              <DecodeText text="Start with what's new." share={closingDecoded} reducedMotion={reducedMotion} />
            </h2>
          </div>
        </section>
    </>
  );
}
