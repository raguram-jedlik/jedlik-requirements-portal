import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Send,
  Sparkles,
  User,
  Layers,
  Gauge,
  BatteryCharging,
  Box,
  MapPin,
  Truck,
  ShieldCheck,
  ArrowRight,
} from 'lucide-react';
import { SECTIONS, questionsFor } from './requirementSchema';
import type { SectionId, Question } from './requirementSchema';
import { REQ_IMAGE_VARIANTS } from '../data/reqImageVariants';
import type { ReqImageVariant } from '../data/reqImageVariants';
import ResponsiveImage, { PHOTO_SIZES, THUMB_SIZES } from '@/components/ResponsiveImage';

type Answers = Record<string, string>;

const SUBMIT_URL = (import.meta.env.VITE_SUBMIT_URL || '/api/requirements');

const ICONS: Record<string, any> = {
  user: User,
  layers: Layers,
  gauge: Gauge,
  battery: BatteryCharging,
  box: Box,
  map: MapPin,
  truck: Truck,
  shield: ShieldCheck,
};

const inputBase =
  'w-full rounded-xl border border-primary/25 bg-background/60 px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25 transition-all';

const labelBase = 'block text-base font-semibold text-foreground leading-snug';
const helpBase = 'mt-1 text-xs text-muted-foreground leading-relaxed';

/* ------------------------------------------------------------------ */
/*  Building blocks                                                    */
/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */
/*  Responsive images                                                  */
/* ------------------------------------------------------------------ */

/* Question photos fill the card body; imagechoice option photos sit in a 2-up grid. */
const QUESTION_IMAGE_SIZES = '(max-width: 640px) 100vw, (max-width: 896px) 90vw, 776px';
const OPTION_IMAGE_SIZES = '(max-width: 640px) 100vw, (max-width: 896px) 45vw, 390px';

const IMG_CLASS = 'h-auto w-full object-contain';

/**
 * Build a srcset string from the generated manifest.
 *
 * WebP: one candidate per width (including the native width).
 * JPEG: one candidate per width below the native width, plus the original
 *       file (which IS the native-width JPEG) as the last candidate.
 *
 * Every path emitted here is produced by scripts/optimize_images.py and
 * exists under public/req-images/.
 */
function buildSrcSet(
  path: string,
  variant: ReqImageVariant,
  format: 'webp' | 'jpg',
): string {
  const base = path.replace(/\.[^./]+$/, '');
  const parts: string[] = [];
  for (const w of variant.widths) {
    // There is no separate "<name>-<native>.jpg": the original file is the native JPEG.
    if (format === 'jpg' && w >= variant.width) continue;
    parts.push(`${base}-${w}.${format} ${w}w`);
  }
  if (format === 'jpg') parts.push(`${path} ${variant.width}w`);
  return parts.join(', ');
}

/**
 * Responsive <picture> driven by the auto-generated manifest.
 * Explicit width/height reserve the box (no layout shift); decoding="async"
 * keeps the main thread free; srcset/sizes serve a smaller candidate on
 * small or low-DPR viewports instead of always downloading the original.
 */
function ResponsiveImage({
  src,
  alt,
  sizes,
  className = IMG_CLASS,
}: {
  src: string;
  alt: string;
  sizes: string;
  className?: string;
}) {
  const variant = REQ_IMAGE_VARIANTS[src];
  if (!variant) {
    // Unknown asset: keep the plain <img> rather than emitting a broken srcset.
    return (
      <img
        src={src}
        alt={alt}
        loading="lazy"
        decoding="async"
        className={className}
      />
    );
  }
  return (
    <picture>
      <source
        type="image/webp"
        srcSet={buildSrcSet(src, variant, 'webp')}
        sizes={sizes}
      />
      <img
        src={src}
        srcSet={buildSrcSet(src, variant, 'jpg')}
        sizes={sizes}
        width={variant.width}
        height={variant.height}
        alt={alt}
        loading="lazy"
        decoding="async"
        className={className}
      />
    </picture>
  );
}

function QuestionImage({ src, alt }: { src?: string; alt: string }) {
  if (!src) return null;
  return (
    <div className="mt-4 overflow-hidden rounded-xl border border-primary/20 bg-background/40">
      <ResponsiveImage src={src} alt={alt} sizes={QUESTION_IMAGE_SIZES} />
    </div>
  );
}

function OtherInput({
  show,
  value,
  onChange,
}: {
  show: boolean;
  value: string;
  onChange: (v: string) => void;
}) {
  if (!show) return null;
  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      className="mt-3 overflow-hidden"
    >
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Please specify"
        className={inputBase}
      />
    </motion.div>
  );
}

function OptionChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group relative rounded-xl border px-4 py-3 text-left text-sm font-medium transition-all duration-200 ${
        active
          ? 'border-primary bg-primary/15 text-foreground shadow-[0_0_20px_-6px_hsl(var(--primary))]'
          : 'border-primary/20 bg-background/40 text-muted-foreground hover:border-primary/50 hover:text-foreground hover:bg-primary/5'
      }`}
    >
      <span className="flex items-center gap-2">
        {active && (
          <motion.span
            layoutId="chip-check"
            className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-primary"
          >
            <Check className="h-3 w-3 text-white" />
          </motion.span>
        )}
        {children}
      </span>
    </button>
  );
}

/* ------------------------------------------------------------------ */
/*  Field renderer                                                     */
/* ------------------------------------------------------------------ */

function Field({
  q,
  value,
  onChange,
  otherValue,
  onOtherChange,
}: {
  q: Question;
  value: string;
  onChange: (v: string) => void;
  otherValue: string;
  onOtherChange: (v: string) => void;
}) {
  const isOther = value === 'other';
  const hasOther = !!q.options?.some((o) => o.value === 'other');

  switch (q.type) {
    case 'text':
    case 'email':
    case 'tel':
      return (
        <input
          type={q.type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={q.placeholder}
          className={inputBase}
        />
      );

    case 'number':
      return (
        <div className="relative">
          <input
            type="number"
            min={q.min}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={q.placeholder}
            className={`${inputBase} pr-28`}
          />
          {q.unit && (
            <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
              {q.unit}
            </span>
          )}
        </div>
      );

    case 'textarea':
      return (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={q.placeholder}
          rows={3}
          className={`${inputBase} resize-y`}
        />
      );

    case 'select':
    case 'radio':
      return (
        <>
          <div className="grid gap-2 sm:grid-cols-2">
            {q.options?.map((o) => (
              <OptionChip
                key={o.value}
                active={value === o.value}
                onClick={() => onChange(value === o.value ? '' : o.value)}
              >
                {o.label}
              </OptionChip>
            ))}
          </div>
          <OtherInput
            show={hasOther && isOther}
            value={otherValue}
            onChange={onOtherChange}
          />
        </>
      );

    case 'imagechoice':
      return (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            {q.options?.map((o) => {
              const active = value === o.value;
              return (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => onChange(value === o.value ? '' : o.value)}
                  className={`group overflow-hidden rounded-2xl border text-left transition-all duration-300 ${
                    active
                      ? 'border-primary bg-primary/10 shadow-[0_0_30px_-8px_hsl(var(--primary))]'
                      : 'border-primary/20 bg-background/40 hover:border-primary/50 hover:bg-primary/5'
                  }`}
                >
                  {o.image && (
                    <div className="relative overflow-hidden">
                      <ResponsiveImage
                        src={o.image}
                        alt={o.label}
                        sizes={THUMB_SIZES}
                        className="h-auto w-full object-contain"
                      />
                      {active && (
                        <div className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full bg-primary shadow-lg">
                          <Check className="h-4 w-4 text-white" />
                        </div>
                      )}
                    </div>
                  )}
                  <div className="p-4">
                    <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                      {o.label}
                    </div>
                    {o.desc && (
                      <div className="mt-1 text-xs leading-relaxed text-muted-foreground">
                        {o.desc}
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
          <OtherInput
            show={hasOther && isOther}
            value={otherValue}
            onChange={onOtherChange}
          />
        </>
      );

    case 'yesno': {
      const yes = value === 'yes';
      const no = value === 'no';
      return (
        <div className="grid gap-2 sm:grid-cols-2">
          <OptionChip active={yes} onClick={() => onChange(yes ? '' : 'yes')}>
            Yes
          </OptionChip>
          <OptionChip active={no} onClick={() => onChange(no ? '' : 'no')}>
            No
          </OptionChip>
        </div>
      );
    }

    case 'slider': {
      const min = q.min ?? 0;
      const max = q.max ?? 100;
      const num = value === '' ? Math.round((min + max) / 2) : Number(value);
      const pct = ((num - min) / (max - min)) * 100;
      const band =
        num < 0
          ? 'Sub-zero'
          : num < 15
          ? 'Cold'
          : num < 30
          ? 'Mild'
          : num < 40
          ? 'Warm'
          : 'Hot';
      return (
        <div className="rounded-2xl border border-primary/20 bg-background/40 p-5">
          <div className="mb-5 flex items-end justify-between">
            <div className="text-3xl font-bold tabular-nums text-primary">
              {num > 0 ? '+' : ''}
              {num}
              {q.unit}
            </div>
            <div className="text-xs text-muted-foreground">{band} range</div>
          </div>
          <div className="relative h-2 w-full rounded-full bg-background">
            <div
              className="absolute h-2 rounded-full bg-gradient-to-r from-primary/40 to-primary"
              style={{ width: `${pct}%` }}
            />
            <input
              type="range"
              min={min}
              max={max}
              step={q.step ?? 1}
              value={num}
              onChange={(e) => onChange(e.target.value)}
              className="absolute -top-1.5 left-0 h-5 w-full cursor-pointer appearance-none bg-transparent"
            />
          </div>
          <div className="mt-3 flex justify-between text-[11px] text-muted-foreground">
            <span>
              {min}
              {q.unit}
            </span>
            <span>Low</span>
            <span>High</span>
            <span>
              {max}
              {q.unit}
            </span>
          </div>
        </div>
      );
    }

    default:
      return null;
  }
}

/* ------------------------------------------------------------------ */
/*  Question block                                                     */
/* ------------------------------------------------------------------ */

function QuestionBlock({
  q,
  value,
  onChange,
  otherValue,
  onOtherChange,
}: {
  q: Question;
  value: string;
  onChange: (v: string) => void;
  otherValue: string;
  onOtherChange: (v: string) => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className="rounded-2xl border border-primary/15 bg-card/40 p-5 sm:p-6"
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-primary/15 text-[11px] font-bold text-primary">
          ?
        </span>
        <div className="min-w-0 flex-1">
          <div className={labelBase}>
            {q.label}
            {q.required && <span className="ml-1 text-primary">*</span>}
          </div>
          {q.help && <div className={helpBase}>{q.help}</div>}
        </div>
      </div>

      <div className="mt-4 sm:pl-9">
        <Field
          q={q}
          value={value}
          onChange={onChange}
          otherValue={otherValue}
          onOtherChange={onOtherChange}
        />
        <QuestionImage src={q.image} alt={q.label} />
      </div>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main page                                                          */
/* ------------------------------------------------------------------ */

const RequirementPortalPage = () => {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Answers>({});
  const [others, setOthers] = useState<Answers>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [started, setStarted] = useState(false);

  const section = SECTIONS[step];
  const questions = useMemo(() => questionsFor(section.id), [section.id]);

  const isVisible = (q: Question) => {
    if (!q.conditional) return true;
    return answers[q.conditional.field] === q.conditional.equals;
  };

  const answered = (q: Question) => {
    const v = answers[q.id] ?? '';
    if (v === 'other') return !!others[q.id];
    return v.trim().length > 0;
  };

  const visibleQuestions = questions.filter(isVisible);

  const sectionComplete = (sectionId: SectionId) =>
    questionsFor(sectionId).filter(isVisible).every(answered);

  const allRequiredDone = SECTIONS.every((s) => sectionComplete(s.id));

  const progress = useMemo(() => {
    const total = questionsFor('contact')
      .concat(
        SECTIONS.filter((s) => s.id !== 'contact').flatMap((s) => questionsFor(s.id))
      )
      .filter(isVisible).length;
    const done = SECTIONS.flatMap((s) => questionsFor(s.id))
      .filter(isVisible)
      .filter(answered).length;
    return total ? Math.round((done / total) * 100) : 0;
  }, [answers, others]);

  const setAnswer = (id: string, v: string) =>
    setAnswers((prev) => ({ ...prev, [id]: v }));

  const setOther = (id: string, v: string) =>
    setOthers((prev) => ({ ...prev, [id]: v }));

  const gateQuestions = useMemo(() => questionsFor('contact'), []);
  const gateReady = gateQuestions.every(answered);

  const buildPayload = () => {
    const data: Record<string, string> = { ...answers };
    Object.keys(others).forEach((k) => {
      if (answers[k] === 'other') data[k] = others[k];
    });
    return data;
  };

  const handleSubmit = async () => {
    setError('');
    setSubmitting(true);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20_000);
    try {
      const res = await fetch(SUBMIT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildPayload()),
        signal: controller.signal,
      });
      if (!res.ok) throw new Error(`Submit failed with status ${res.status}`);
    } catch {
      setError('Something went wrong while submitting. Please try again, or email us at info@jedlik.in.');
      setSubmitting(false);
      return;
    } finally {
      clearTimeout(timer);
    }
    setSubmitted(true);
    setSubmitting(false);
  };

  /* ---------------- SCREEN 1 : IDENTITY GATE ---------------- */
  if (!started) {
    return (
      <div className="relative min-h-screen overflow-hidden">
        <div className="glow-primary pointer-events-none absolute inset-x-0 top-0 h-[600px]" />
        <div className="grid-backdrop pointer-events-none absolute inset-x-0 top-0 h-[700px]" />

        <div className="relative z-10 mx-auto max-w-3xl px-4 pb-20 pt-16 sm:pt-24">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-center"
          >
            <img
              src="/jedlik_logo_transparent.png"
              alt="Jedlik Motors"
              className="mx-auto h-20 w-auto object-contain"
            />
            <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-primary">
              <Sparkles className="h-3.5 w-3.5" />
              e-POD Requirement Portal
            </div>
            <h1 className="mt-5 text-3xl font-bold leading-tight text-foreground sm:text-5xl">
              Tell us what you need.
              <br />
              <span className="text-primary">We'll build it to spec.</span>
            </h1>
            <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">
              A guided requirement form for fleets, logistics operators and
              delivery partners. Roughly 5 minutes. Your answers go straight to
              our engineering team.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="card-glow mt-10 rounded-2xl border border-primary/20 bg-card/40 p-6 backdrop-blur-sm sm:p-8"
          >
            <div className="mb-6 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15">
                <User className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-foreground">
                  Let's start with the basics
                </h2>
                <p className="text-xs text-muted-foreground">
                  Three quick details, then we open the full form.
                </p>
              </div>
            </div>

            <div className="space-y-5">
              {gateQuestions.map((q) => (
                <div key={q.id}>
                  <label className={labelBase}>
                    {q.label}
                    <span className="ml-1 text-primary">*</span>
                  </label>
                  <div className="mt-2">
                    <Field
                      q={q}
                      value={answers[q.id] ?? ''}
                      onChange={(v) => setAnswer(q.id, v)}
                      otherValue={others[q.id] ?? ''}
                      onOtherChange={(v) => setOther(q.id, v)}
                    />
                  </div>
                </div>
              ))}
            </div>

            <button
              type="button"
              disabled={!gateReady}
              onClick={() => {
                setStarted(true);
                setStep(1);
              }}
              className="mt-7 flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-6 py-4 text-sm font-bold uppercase tracking-wide text-white transition-all duration-300 hover:bg-primary/90 enabled:hover:shadow-[0_0_30px_-6px_hsl(var(--primary))] disabled:cursor-not-allowed disabled:opacity-35"
            >
              Start Requirement Form
              <ArrowRight className="h-4 w-4" />
            </button>
          </motion.div>
        </div>
      </div>
    );
  }

  /* ---------------- SCREEN 2 : SUCCESS ---------------- */
  if (submitted) {
    return (
      <div className="relative min-h-screen overflow-hidden">
        <div className="glow-primary pointer-events-none absolute inset-x-0 top-0 h-[500px]" />
        <div className="relative z-10 mx-auto max-w-2xl px-4 pb-20 pt-20">
          <motion.div
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            className="card-glow rounded-2xl border border-primary/25 bg-card/40 p-8 text-center backdrop-blur-sm sm:p-12"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.15, type: 'spring', stiffness: 220 }}
              className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-primary/15"
            >
              <Check className="h-10 w-10 text-primary" />
            </motion.div>
            <h1 className="mt-6 text-3xl font-bold text-foreground">
              Requirement received
            </h1>
            <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">
              Thank you, {answers.contactName}. Our engineering team has your
              specification and will revert with a technical proposal and
              commercial quote within 3 working days.
            </p>
            <div className="mt-8 rounded-xl border border-primary/15 bg-background/40 p-5 text-left">
              <div className="text-xs font-semibold uppercase tracking-wider text-primary">
                Your reference
              </div>
              <div className="mt-1 font-mono text-sm text-foreground">
                {answers.companyName} &middot; {answers.pilotQuantity} pilot units
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setAnswers({});
                setOthers({});
                setSubmitted(false);
                setStarted(false);
                setStep(0);
              }}
              className="mt-6 text-xs text-muted-foreground underline underline-offset-4 hover:text-primary"
            >
              Submit another requirement
            </button>
          </motion.div>
        </div>
      </div>
    );
  }

  /* ---------------- SCREEN 3 : THE FORM ---------------- */
  const Icon = ICONS[section.icon] || User;
  const isLast = step === SECTIONS.length - 1;

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="glow-primary pointer-events-none absolute inset-x-0 top-0 h-[450px]" />

      <div className="relative z-10 mx-auto max-w-4xl px-4 pb-24 pt-12 sm:pt-16">
        {/* header */}
        <div className="mb-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <img
              src="/jedlik_logo_transparent.png"
              alt="Jedlik Motors"
              className="h-12 w-auto object-contain"
            />
            <div className="hidden sm:block">
              <div className="text-sm font-semibold text-foreground">
                e-POD Requirement Portal
              </div>
              <div className="text-xs text-muted-foreground">
                {answers.companyName}
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold tabular-nums text-primary">
              {progress}%
            </div>
            <div className="text-[11px] text-muted-foreground">complete</div>
          </div>
        </div>

        {/* progress bar */}
        <div className="mb-8 h-1.5 w-full overflow-hidden rounded-full bg-background">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-primary/50 to-primary"
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.4 }}
          />
        </div>

        {/* section tabs */}
        <div className="mb-8 flex flex-wrap gap-2">
          {SECTIONS.map((s, i) => {
            const done = sectionComplete(s.id);
            const active = i === step;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => setStep(i)}
                className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-all ${
                  active
                    ? 'border-primary bg-primary/15 text-foreground'
                    : done
                    ? 'border-primary/30 bg-primary/5 text-primary'
                    : 'border-primary/15 text-muted-foreground hover:text-foreground'
                }`}
              >
                {done && !active ? (
                  <Check className="h-3 w-3" />
                ) : (
                  <span className="tabular-nums">{i + 1}</span>
                )}
                {s.short}
              </button>
            );
          })}
        </div>

        {/* section heading */}
        <motion.div
          key={section.id}
          initial={{ opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.35 }}
          className="mb-8"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-primary/25 bg-primary/10">
              <Icon className="h-5 w-5 text-primary" />
            </div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-primary">
                Step {step + 1} of {SECTIONS.length}
              </div>
              <h1 className="text-2xl font-bold text-foreground sm:text-3xl">
                {section.title}
              </h1>
            </div>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">{section.intro}</p>
        </motion.div>

        {/* questions */}
        <div className="space-y-4">
          <AnimatePresence mode="wait">
            {visibleQuestions.map((q) => (
              <QuestionBlock
                key={q.id}
                q={q}
                value={answers[q.id] ?? ''}
                onChange={(v) => setAnswer(q.id, v)}
                otherValue={others[q.id] ?? ''}
                onOtherChange={(v) => setOther(q.id, v)}
              />
            ))}
          </AnimatePresence>
        </div>

        {error && (
          <div className="mt-6 rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {/* nav */}
        <div className="mt-10 flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={step === 0}
            className="flex items-center gap-2 rounded-xl border border-primary/25 px-5 py-3 text-sm font-medium text-muted-foreground transition-all hover:border-primary/60 hover:text-foreground disabled:opacity-30"
          >
            <ChevronLeft className="h-4 w-4" />
            Back
          </button>

          {isLast ? (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting || !allRequiredDone}
              className="flex items-center gap-2 rounded-xl bg-primary px-7 py-3 text-sm font-bold uppercase tracking-wide text-white transition-all hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-35"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Submitting
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  Submit Requirement
                </>
              )}
            </button>
          ) : (
            <button
              type="button"
              onClick={() =>
                setStep((s) => Math.min(SECTIONS.length - 1, s + 1))
              }
              className="flex items-center gap-2 rounded-xl bg-primary px-7 py-3 text-sm font-bold uppercase tracking-wide text-white transition-all hover:bg-primary/90"
            >
              Continue
              <ChevronRight className="h-4 w-4" />
            </button>
          )}
        </div>

        {!isLast && !sectionComplete(section.id) && (
          <p className="mt-4 text-center text-xs text-muted-foreground">
            Answer every question in this section, then continue.
          </p>
        )}
      </div>
    </div>
  );
};

export default RequirementPortalPage;
