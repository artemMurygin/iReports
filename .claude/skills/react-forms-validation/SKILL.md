---
name: react-forms-validation
description: Comprehensive form patterns for React 19 / Next 15 — Zod schemas with type inference, Server Actions + useFormStatus + useActionState, useOptimistic for instant feedback, react-hook-form when Server Actions aren't on the table, multi-step forms with useReducer + persistence, async validation, file upload with progress, error messages with full a11y wiring (aria-invalid, aria-describedby, role=alert, focus management on errors). Use for any form-heavy interview build — newsletter signup, contact form, login, signup, multi-step onboarding, settings page, file upload. Triggers on "form", "validation", "zod", "react-hook-form", "Server Action", "useFormStatus", "useActionState", "useOptimistic", "controlled vs uncontrolled", "multi-step form", "file upload", "form a11y", "form errors", "newsletter signup".
---

# react-forms-validation

Forms come up in roughly 60% of marketing-engineering interviews. This skill covers the full spectrum — from a 3-line newsletter signup to a multi-step onboarding flow — centered on the modern **React 19 + Next 15 + Server Actions** stack.

## The decision tree

| Situation | Use |
|---|---|
| Single-field signup (newsletter, lead capture) | Server Action + `useActionState` + `useFormStatus` |
| Multi-field form with validation (contact, signup, settings) | Server Action + Zod + `useActionState` |
| Complex client-only form (calculator, configurator) | `react-hook-form` + Zod resolver |
| Multi-step flow with persistence | `useReducer` + Zod per step + localStorage |
| Quick prototype, no JS framework dependency | `FormData` + native validation (`required`, `pattern`, `:user-invalid`) |

Default to **Server Actions** if you're in Next App Router. They give you server-side validation, no client `useState` for submission state, and progressive enhancement for free.

---

## Zod schemas — the foundation

```ts
// schemas/newsletter.ts
import { z } from 'zod';

export const NewsletterSchema = z.object({
  email: z.string().email('Enter a valid email'),
});

export type NewsletterInput = z.infer<typeof NewsletterSchema>;
```

```ts
// schemas/signup.ts
import { z } from 'zod';

export const SignupSchema = z.object({
  name: z.string().min(2, 'Name is required'),
  email: z.string().email('Enter a valid email'),
  password: z
    .string()
    .min(8, 'Must be at least 8 characters')
    .regex(/[A-Z]/, 'Must contain an uppercase letter')
    .regex(/[0-9]/, 'Must contain a number'),
  terms: z.literal('on', {
    errorMap: () => ({ message: 'You must accept the terms' }),
  }),
});

export type SignupInput = z.infer<typeof SignupSchema>;
```

```ts
// Multi-step: schema per step, merge for full
const Step1 = z.object({ name: z.string().min(2) });
const Step2 = z.object({ email: z.string().email() });
const Step3 = z.object({ company: z.string().optional() });
export const FullSchema = Step1.merge(Step2).merge(Step3);
```

`z.infer<typeof Schema>` gives you the TypeScript type for free. **Single source of truth** for shape + validation + types + error messages.

---

## Server Action + useActionState (Next 15 / React 19)

The modern pattern. No client state for "submitting" or "success" — the server response drives the UI. Works without JS (progressive enhancement).

### The action

```tsx
// app/actions/subscribe.ts
'use server';
import { z } from 'zod';

const Schema = z.object({ email: z.string().email() });

export type SubscribeState = {
  status: 'idle' | 'success' | 'error';
  message?: string;
  fieldErrors?: Record<string, string>;
};

export async function subscribe(
  _prev: SubscribeState,
  formData: FormData
): Promise<SubscribeState> {
  const result = Schema.safeParse({
    email: formData.get('email'),
  });

  if (!result.success) {
    return {
      status: 'error',
      fieldErrors: Object.fromEntries(
        result.error.issues.map((i) => [i.path[0], i.message])
      ),
    };
  }

  try {
    const res = await fetch('https://api.example.com/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(result.data),
    });
    if (!res.ok) throw new Error('Subscription failed');

    return { status: 'success', message: 'Check your inbox to confirm.' };
  } catch (e) {
    return {
      status: 'error',
      message: 'Something went wrong. Please try again.',
    };
  }
}
```

### The component

```tsx
// app/components/NewsletterForm.tsx
'use client';
import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { subscribe } from '@/app/actions/subscribe';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending || undefined}
      className="h-12 px-6 rounded-md bg-brand text-white font-medium disabled:opacity-50"
    >
      {pending ? 'Subscribing…' : 'Subscribe'}
    </button>
  );
}

export function NewsletterForm() {
  const [state, action] = useActionState(subscribe, { status: 'idle' });

  if (state.status === 'success') {
    return (
      <p role="status" className="rounded-md bg-brand/10 p-4 text-brand">
        {state.message}
      </p>
    );
  }

  return (
    <form action={action} className="flex flex-col sm:flex-row gap-3">
      <div className="flex-1">
        <label htmlFor="newsletter-email" className="sr-only">
          Email
        </label>
        <input
          id="newsletter-email"
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="you@example.com"
          aria-invalid={!!state.fieldErrors?.email}
          aria-describedby={state.fieldErrors?.email ? 'email-error' : undefined}
          className="w-full h-12 px-4 rounded-md border border-border focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        />
        {state.fieldErrors?.email && (
          <p id="email-error" role="alert" className="mt-2 text-sm text-danger">
            {state.fieldErrors.email}
          </p>
        )}
      </div>
      <SubmitButton />
      {state.status === 'error' && !state.fieldErrors && (
        <p role="alert" className="text-sm text-danger sm:basis-full">
          {state.message}
        </p>
      )}
    </form>
  );
}
```

### What this pattern gives you

- **Server-side validation** — runs even if JS fails to load (progressive enhancement, Netlify ethos)
- **Single state machine** — `idle | success | error`
- **`useFormStatus`** reads pending state without prop drilling (reads from nearest enclosing `<form>`)
- **Type-safe errors** — Zod errors flow to typed `fieldErrors`
- **No client `useState`** — fewer renders, less to manage

---

## `useOptimistic` — instant UI feedback

When you want the UI to update **before** the server confirms.

```tsx
'use client';
import { useOptimistic } from 'react';

type Todo = { id: string; text: string; pending?: boolean };

export function TodoList({ todos, addTodoAction }: {
  todos: Todo[];
  addTodoAction: (text: string) => Promise<void>;
}) {
  const [optimisticTodos, addOptimistic] = useOptimistic(
    todos,
    (state, newTodo: string) => [
      ...state,
      {
        id: crypto.randomUUID(),
        text: newTodo,
        pending: true,
      },
    ]
  );

  async function handleAdd(formData: FormData) {
    const text = formData.get('text') as string;
    addOptimistic(text);             // Show it immediately
    await addTodoAction(text);       // Server confirms (or fails)
  }

  return (
    <>
      <ul>
        {optimisticTodos.map((todo) => (
          <li key={todo.id} style={{ opacity: todo.pending ? 0.5 : 1 }}>
            {todo.text}
            {todo.pending && <span aria-label="Saving" className="ml-2">…</span>}
          </li>
        ))}
      </ul>
      <form action={handleAdd}>
        <input name="text" required aria-label="New todo" />
        <button>Add</button>
      </form>
    </>
  );
}
```

When the server action throws, React rolls back the optimistic state automatically.

---

## react-hook-form alternative

Use when Server Actions aren't available (Pages Router, Vite, Astro islands) or when you need complex client-side logic — conditional fields, cross-field validation, watched values.

```tsx
'use client';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { SignupSchema, type SignupInput } from '@/schemas/signup';

export function SignupForm() {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignupInput>({
    resolver: zodResolver(SignupSchema),
    mode: 'onBlur',                  // validate on blur, not every keystroke
  });

  const onSubmit = async (data: SignupInput) => {
    const res = await fetch('/api/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Signup failed');
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
      <div>
        <label htmlFor="name">Name</label>
        <input
          id="name"
          autoComplete="name"
          {...register('name')}
          aria-invalid={!!errors.name}
          aria-describedby={errors.name ? 'name-error' : undefined}
        />
        {errors.name && (
          <p id="name-error" role="alert">{errors.name.message}</p>
        )}
      </div>

      <div>
        <label htmlFor="email">Email</label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          {...register('email')}
          aria-invalid={!!errors.email}
          aria-describedby={errors.email ? 'email-error' : undefined}
        />
        {errors.email && (
          <p id="email-error" role="alert">{errors.email.message}</p>
        )}
      </div>

      <div>
        <label htmlFor="password">Password</label>
        <input
          id="password"
          type="password"
          autoComplete="new-password"
          {...register('password')}
          aria-invalid={!!errors.password}
          aria-describedby={errors.password ? 'password-error' : 'password-hint'}
        />
        <p id="password-hint" className="text-sm text-fg-muted">
          At least 8 characters with a number and an uppercase letter.
        </p>
        {errors.password && (
          <p id="password-error" role="alert">{errors.password.message}</p>
        )}
      </div>

      <label className="flex items-center gap-2">
        <input type="checkbox" {...register('terms')} />
        I accept the terms
      </label>
      {errors.terms && <p role="alert">{errors.terms.message}</p>}

      <button
        type="submit"
        disabled={isSubmitting}
        aria-busy={isSubmitting || undefined}
      >
        {isSubmitting ? 'Creating account…' : 'Create account'}
      </button>
    </form>
  );
}
```

`mode: 'onBlur'` validates on blur — not on every keystroke — which avoids the "red ring after the first character" UX paper cut.

---

## Multi-step forms with persistence

```tsx
'use client';
import { useReducer, useEffect } from 'react';
import { Step1, Step2, Step3, FullSchema, type FullInput } from '@/schemas/onboarding';

type State = {
  step: number;
  data: Partial<FullInput>;
  errors: Record<string, string>;
};

type Action =
  | { type: 'next'; values: Partial<FullInput> }
  | { type: 'back' }
  | { type: 'set_errors'; errors: Record<string, string> }
  | { type: 'reset' };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'next':
      return {
        step: state.step + 1,
        data: { ...state.data, ...action.values },
        errors: {},
      };
    case 'back':
      return { ...state, step: Math.max(0, state.step - 1), errors: {} };
    case 'set_errors':
      return { ...state, errors: action.errors };
    case 'reset':
      return { step: 0, data: {}, errors: {} };
  }
}

const STORAGE_KEY = 'onboarding-progress';

function validateStep(step: number, values: Record<string, unknown>) {
  const schemas = [Step1, Step2, Step3];
  const result = schemas[step].safeParse(values);
  if (result.success) return null;
  return Object.fromEntries(
    result.error.issues.map((i) => [i.path[0], i.message])
  );
}

export function OnboardingFlow({ onComplete }: { onComplete: (data: FullInput) => void }) {
  const [state, dispatch] = useReducer(reducer, { step: 0, data: {}, errors: {} });

  // Restore on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.data && typeof parsed.step === 'number') {
          dispatch({ type: 'next', values: parsed.data });
          // Note: with this reducer shape, restoring step requires a separate action.
          // Add { type: 'restore', state } if you need it.
        }
      }
    } catch {}
  }, []);

  // Persist on change
  useEffect(() => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ step: state.step, data: state.data })
    );
  }, [state.step, state.data]);

  // Move focus to the step heading on advance (a11y)
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    headingRef.current?.focus();
  }, [state.step]);

  const onNext = (values: Partial<FullInput>) => {
    const errors = validateStep(state.step, { ...state.data, ...values });
    if (errors) {
      dispatch({ type: 'set_errors', errors });
      return;
    }
    if (state.step === 2) {
      onComplete({ ...state.data, ...values } as FullInput);
      localStorage.removeItem(STORAGE_KEY);
    } else {
      dispatch({ type: 'next', values });
    }
  };

  return (
    <section aria-labelledby="onboarding-title">
      <ProgressBar current={state.step + 1} total={3} />
      <h2 id="onboarding-title" ref={headingRef} tabIndex={-1}>
        {['Tell us about yourself', 'Your email', 'Your company'][state.step]}
      </h2>
      {/* render step components, pass state.data and state.errors */}
      <div className="mt-8 flex justify-between">
        <button
          type="button"
          onClick={() => dispatch({ type: 'back' })}
          disabled={state.step === 0}
        >
          Back
        </button>
        {/* "Continue" is the submit button of the step form */}
      </div>
    </section>
  );
}
```

Why focus moves to the step heading: screen reader users need to know they advanced. Tab order alone doesn't announce the change.

---

## Async validation (debounced)

For checking "is this username taken?", "is this domain available?", etc.

```tsx
'use client';
import { useEffect, useState } from 'react';
import { useDebounce } from '@/hooks/useDebounce';

type Status = 'idle' | 'checking' | 'available' | 'taken' | 'error';

export function UsernameField() {
  const [value, setValue] = useState('');
  const debounced = useDebounce(value, 400);
  const [status, setStatus] = useState<Status>('idle');

  useEffect(() => {
    if (!debounced) {
      setStatus('idle');
      return;
    }
    setStatus('checking');
    const controller = new AbortController();
    fetch(`/api/username-available?u=${encodeURIComponent(debounced)}`, {
      signal: controller.signal,
    })
      .then((r) => r.json())
      .then((data) => {
        setStatus(data.available ? 'available' : 'taken');
      })
      .catch((e) => {
        if (e.name !== 'AbortError') setStatus('error');
      });
    return () => controller.abort();
  }, [debounced]);

  return (
    <div>
      <label htmlFor="username">Username</label>
      <input
        id="username"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        aria-describedby="username-status"
        aria-invalid={status === 'taken' || status === 'error'}
      />
      <p id="username-status" role="status" aria-live="polite" className="text-sm">
        {status === 'checking' && 'Checking availability…'}
        {status === 'available' && '✓ Available'}
        {status === 'taken' && '✗ This username is taken'}
        {status === 'error' && 'Could not check availability'}
      </p>
    </div>
  );
}
```

Key moves:
- **Debounce input** — don't fire on every keystroke
- **Cancel stale requests** — `AbortController` so the response order doesn't matter
- **`aria-live="polite"`** — screen readers hear the result without interruption
- **`role="status"`** — status region (less urgent than `role="alert"`)

---

## File upload with progress

```tsx
'use client';
import { useState, type ChangeEvent } from 'react';

type FileUploadProps = {
  accept?: string;
  maxSizeMB?: number;
  onUploaded?: (url: string) => void;
};

export function FileUpload({
  accept = 'image/*',
  maxSizeMB = 5,
  onUploaded,
}: FileUploadProps) {
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [uploading, setUploading] = useState(false);

  const onChange = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    setError(null);
    if (!f) {
      setFile(null);
      return;
    }
    if (f.size > maxSizeMB * 1024 * 1024) {
      setError(`File must be under ${maxSizeMB}MB`);
      setFile(null);
      return;
    }
    setFile(f);
  };

  const upload = () => {
    if (!file) return;
    setUploading(true);
    setProgress(0);

    const data = new FormData();
    data.append('file', file);

    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/upload');

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) setProgress((e.loaded / e.total) * 100);
    };

    xhr.onload = () => {
      setUploading(false);
      if (xhr.status >= 200 && xhr.status < 300) {
        setProgress(100);
        const res = JSON.parse(xhr.responseText);
        onUploaded?.(res.url);
      } else {
        setError('Upload failed');
      }
    };

    xhr.onerror = () => {
      setUploading(false);
      setError('Upload failed');
    };

    xhr.send(data);
  };

  return (
    <div className="space-y-3">
      <div>
        <label htmlFor="file">Upload file</label>
        <input
          id="file"
          type="file"
          accept={accept}
          onChange={onChange}
          disabled={uploading}
          aria-describedby={error ? 'file-error' : 'file-hint'}
          aria-invalid={!!error}
        />
        <p id="file-hint" className="text-sm text-fg-muted">
          Max {maxSizeMB}MB. Accepted: {accept}.
        </p>
        {error && <p id="file-error" role="alert">{error}</p>}
      </div>
      {file && !uploading && (
        <button onClick={upload}>Upload {file.name}</button>
      )}
      {uploading && (
        <div role="status" aria-live="polite">
          <progress value={progress} max={100} aria-label="Upload progress" />
          <span>{Math.round(progress)}%</span>
        </div>
      )}
    </div>
  );
}
```

Why `XMLHttpRequest` instead of `fetch`: the Fetch API doesn't expose upload progress events. For modern alternatives, look at `ReadableStream` + `fetch` (more complex but standard).

---

## Error message a11y patterns

Three layers, all wired together.

### 1. Inline field errors

```tsx
<input
  id="email"
  type="email"
  aria-invalid={!!error}
  aria-describedby={error ? 'email-error' : undefined}
/>
{error && <p id="email-error" role="alert">{error}</p>}
```

- `aria-invalid` — screen reader announces the field as invalid
- `aria-describedby` — screen reader reads the error after the field name
- `role="alert"` — error is announced when it appears (assertive live region)

### 2. Form-level error summary

For long forms, summarize all errors at the top + focus the summary on submit failure:

```tsx
'use client';
import { useEffect, useRef } from 'react';

export function ErrorSummary({ errors }: { errors: Record<string, string> }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (Object.keys(errors).length > 0) {
      ref.current?.focus();
    }
  }, [errors]);

  if (Object.keys(errors).length === 0) return null;

  return (
    <div
      ref={ref}
      role="alert"
      aria-labelledby="errors-heading"
      tabIndex={-1}
      className="rounded-md border border-danger bg-danger/5 p-4"
    >
      <h2 id="errors-heading" className="font-semibold">
        There were {Object.keys(errors).length} errors with your submission
      </h2>
      <ul className="mt-2 list-disc list-inside">
        {Object.entries(errors).map(([field, msg]) => (
          <li key={field}>
            <a href={`#${field}`} className="underline">
              {msg}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

Auto-focusing the summary on submit failure means it gets announced to screen reader users without them needing to navigate to find it.

### 3. Success announcements

```tsx
<div role="status" aria-live="polite" className="sr-only">
  {state.status === 'success' && 'Form submitted successfully. Check your email.'}
</div>
```

`sr-only` makes it visually hidden but screen-reader-audible.

---

## Controlled vs uncontrolled

| Use uncontrolled (`defaultValue` + `FormData`) when | Use controlled (`value` + `onChange`) when |
|---|---|
| Form submits as a unit (most marketing forms) | Per-keystroke logic (live preview, formatting) |
| Server Action handles validation | Async validation on each keystroke |
| Performance matters (no re-render per keystroke) | Cross-field conditional rendering |
| You want zero state management | You need to transform input (currency, phone mask) |

**Default to uncontrolled** unless you can name a concrete reason to control.

---

## Common form smells

| Smell | Fix |
|---|---|
| `useState` per field for a 10-field form | `FormData` + server validation |
| Validation runs on every keystroke from char 1 | `mode: 'onBlur'` (RHF) or `:user-invalid` (CSS) |
| `setSubmitting(true)` / `setSubmitting(false)` | `useFormStatus` or `useActionState` |
| Email error stays after user fixes it | Clear errors on next keystroke OR re-validate on blur |
| Error shown in red color only | Pair color with icon + sr-only text |
| `placeholder="Email"` as the label | Real `<label>` (placeholder disappears on type, low contrast by default) |
| Submit button doesn't disable while submitting | `disabled={pending}` + `aria-busy` |
| Required indicator (*) without explaining | Add "Fields marked * are required" once at top |
| `type="text"` for email/phone/url | Use specific type → mobile keyboard + autofill |
| No `autoComplete` | Add it — password managers and browser autofill help users |
| Errors announce on every render | Conditionally render `role="alert"` element only when error exists |
| Multi-step form has no way back | Always allow back; warn before destroying data |

---

## Narration phrases

- "I went with Server Actions + `useActionState` so validation runs server-side and the form works even if JS fails to load — progressive enhancement is the Netlify ethos."
- "Zod gives me schema + type inference + error messages in one place — single source of truth, no drift between the form and the type."
- "I'm using uncontrolled inputs because the form submits as a unit and I don't need per-keystroke state — every keystroke is a re-render I'm not paying."
- "Errors clear on the next keystroke so the user isn't shamed after they fix the problem."
- "`useFormStatus` lets the submit button track pending state without prop drilling — it reads from the nearest enclosing form."
- "I added `aria-live='polite'` on the status region so screen reader users hear the same feedback sighted users get visually."
- "On submit failure I focus the error summary at the top — keyboard users don't have to hunt for what went wrong."
- "Async validation uses AbortController so out-of-order responses can't show stale results."

## Authoritative references

- React 19 `useActionState`: https://react.dev/reference/react/useActionState
- React 19 `useFormStatus`: https://react.dev/reference/react-dom/hooks/useFormStatus
- React 19 `useOptimistic`: https://react.dev/reference/react/useOptimistic
- Next.js Server Actions: https://nextjs.org/docs/app/building-your-application/data-fetching/server-actions-and-mutations
- Zod docs: https://zod.dev/
- react-hook-form: https://react-hook-form.com/
- WAI-ARIA APG — Form patterns: https://www.w3.org/WAI/ARIA/apg/practices/form-instructions/
- WebAIM Form validation: https://webaim.org/techniques/formvalidation/
- MDN Constraint Validation: https://developer.mozilla.org/en-US/docs/Web/HTML/Constraint_validation
- MDN FormData: https://developer.mozilla.org/en-US/docs/Web/API/FormData
