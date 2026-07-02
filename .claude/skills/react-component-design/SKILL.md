---
name: react-component-design
description: React component architecture and API design — composition, compound components, headless patterns, prop interfaces, controlled vs uncontrolled, polymorphic components, TypeScript prop typing, slot patterns. Use when designing component APIs, building reusable components, structuring a component library, or refactoring component structure. Triggers on "component API", "reusable", "compound component", "headless", "polymorphic", "props", "design a component".
---

# react-component-design

How a senior engineer designs components: small APIs, composition over configuration, and prop interfaces that read like English.

## The 3 questions before writing the API

1. **Who calls this component?** One page? Many pages? An external consumer?
   - One caller → keep it specific, inline logic, fewer props
   - Many callers → composition + slots, fewer assumptions

2. **What does the caller need to control vs. what should I decide?**
   - Caller controls: content, intent (variant), event handlers
   - You decide: spacing, typography, motion, semantics

3. **What's the minimum viable prop list?**
   - Start with zero props, add only when you can name a real use case
   - If a prop has only one realistic value, remove it

## Composition over configuration

Bad — config-bloat:
```tsx
<Card
  title="Pro Plan"
  titleSize="lg"
  showBadge
  badgeText="Popular"
  badgeColor="green"
  ctaText="Choose Pro"
  ctaVariant="primary"
  features={["Unlimited builds", "Priority support"]}
  featureIcon="check"
/>
```

Good — composition:
```tsx
<Card>
  <Card.Badge tone="success">Popular</Card.Badge>
  <Card.Title>Pro Plan</Card.Title>
  <Card.Features>
    <Card.Feature>Unlimited builds</Card.Feature>
    <Card.Feature>Priority support</Card.Feature>
  </Card.Features>
  <Card.CTA href="/signup">Choose Pro</Card.CTA>
</Card>
```

The composed version absorbs new requirements without breaking the API. The config version requires a new prop for every new wish.

## Compound components (parent + named children sharing context)

When children need to coordinate (Tabs, Accordion, Select, Disclosure):

```tsx
const TabsContext = createContext<{
  active: string;
  setActive: (id: string) => void;
}>(null!);

function Tabs({ defaultValue, children }: TabsProps) {
  const [active, setActive] = useState(defaultValue);
  return (
    <TabsContext.Provider value={{ active, setActive }}>
      <div className="tabs">{children}</div>
    </TabsContext.Provider>
  );
}

function TabList({ children }: { children: ReactNode }) {
  return <div role="tablist" className="tab-list">{children}</div>;
}

function Tab({ value, children }: { value: string; children: ReactNode }) {
  const { active, setActive } = useContext(TabsContext);
  const isActive = active === value;
  return (
    <button
      role="tab"
      aria-selected={isActive}
      aria-controls={`panel-${value}`}
      id={`tab-${value}`}
      tabIndex={isActive ? 0 : -1}
      onClick={() => setActive(value)}
    >
      {children}
    </button>
  );
}

function Panel({ value, children }: { value: string; children: ReactNode }) {
  const { active } = useContext(TabsContext);
  if (active !== value) return null;
  return (
    <div role="tabpanel" id={`panel-${value}`} aria-labelledby={`tab-${value}`}>
      {children}
    </div>
  );
}

Tabs.List = TabList;
Tabs.Tab = Tab;
Tabs.Panel = Panel;
```

Usage:
```tsx
<Tabs defaultValue="overview">
  <Tabs.List>
    <Tabs.Tab value="overview">Overview</Tabs.Tab>
    <Tabs.Tab value="pricing">Pricing</Tabs.Tab>
  </Tabs.List>
  <Tabs.Panel value="overview">…</Tabs.Panel>
  <Tabs.Panel value="pricing">…</Tabs.Panel>
</Tabs>
```

**Senior tradeoff to articulate**: "I used compound components so the caller controls structure and content while I own the a11y wiring (`role`, `aria-selected`, `aria-controls`, roving tabindex). A flat `<Tabs items={...} />` API would be smaller but couples me to a specific layout."

## Headless / hook pattern (logic without markup)

When the logic is reusable but the visual is bespoke per consumer:

```tsx
function useDisclosure(initial = false) {
  const [open, setOpen] = useState(initial);
  return {
    open,
    onOpen: () => setOpen(true),
    onClose: () => setOpen(false),
    onToggle: () => setOpen(o => !o),
    getTriggerProps: () => ({
      'aria-expanded': open,
      onClick: () => setOpen(o => !o),
    }),
    getPanelProps: () => ({
      hidden: !open,
    }),
  };
}
```

Consumers bring their own markup; the hook hands them the right props. This is how Radix, Headless UI, and React Aria scale.

## Controlled vs. uncontrolled

```tsx
// Uncontrolled — component owns state, parent reads via ref/callback
<input defaultValue="hi" onChange={…} />

// Controlled — parent owns state
<input value={value} onChange={e => setValue(e.target.value)} />
```

Rules of thumb:
- **Uncontrolled** by default — fewer renders, simpler
- **Controlled** when the parent needs to read/transform/validate per keystroke
- **Both** for reusable form components: accept `value` + `defaultValue`, switch internally

```tsx
function Input({ value, defaultValue, onChange, ...rest }: InputProps) {
  const isControlled = value !== undefined;
  const [internal, setInternal] = useState(defaultValue ?? '');
  const current = isControlled ? value : internal;
  return (
    <input
      value={current}
      onChange={e => {
        if (!isControlled) setInternal(e.target.value);
        onChange?.(e);
      }}
      {...rest}
    />
  );
}
```

## Polymorphic components (`as` prop)

When the same visual should render as different HTML elements (button → link, h2 → h3):

```tsx
type PolymorphicProps<E extends ElementType> = {
  as?: E;
  children: ReactNode;
} & Omit<ComponentPropsWithoutRef<E>, 'as' | 'children'>;

function Heading<E extends ElementType = 'h2'>({
  as,
  children,
  ...rest
}: PolymorphicProps<E>) {
  const Tag = as ?? 'h2';
  return <Tag className="heading" {...rest}>{children}</Tag>;
}

// <Heading>Default h2</Heading>
// <Heading as="h1">A page title</Heading>
// <Heading as="a" href="/x">A link styled as a heading</Heading>
```

**When NOT to do this**: if the variants are 2-3 and named, just expose `<HeadingPrimary>` / `<HeadingSecondary>`. Polymorphism adds TS complexity — only worth it when callers genuinely need flexibility.

## Slot pattern for flexible content insertion

When a layout component needs to accept structured children:

```tsx
type CardProps = {
  media?: ReactNode;
  title: ReactNode;
  body?: ReactNode;
  actions?: ReactNode;
};

function Card({ media, title, body, actions }: CardProps) {
  return (
    <article className="card">
      {media && <div className="card__media">{media}</div>}
      <h3 className="card__title">{title}</h3>
      {body && <div className="card__body">{body}</div>}
      {actions && <footer className="card__actions">{actions}</footer>}
    </article>
  );
}
```

Tradeoff vs. compound components: slots are simpler (one component, named props) but less flexible (caller can't reorder).

## State shape patterns

How a component owns its state matters as much as its props. Five patterns to know.

### Discriminated union for state machines (idle → loading → success | error)

Better than three booleans:

```tsx
type FormState =
  | { status: 'idle' }
  | { status: 'submitting' }
  | { status: 'success'; message: string }
  | { status: 'error'; message: string; canRetry: boolean };

const [state, setState] = useState<FormState>({ status: 'idle' });

// TypeScript narrows automatically:
if (state.status === 'error') {
  // state.canRetry is known to exist here
}
```

Three booleans (`isLoading`, `isSuccess`, `hasError`) admit impossible states (all three true). A discriminated union makes them mutually exclusive at the type level.

### `useReducer` for multi-key state with rules

When state has 3+ keys and updates touch multiple keys atomically:

```tsx
type State = {
  items: Item[];
  selected: Set<string>;
  filter: 'all' | 'active' | 'done';
};

type Action =
  | { type: 'add'; item: Item }
  | { type: 'toggle'; id: string }
  | { type: 'select_all' }
  | { type: 'set_filter'; filter: State['filter'] };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'add':
      return { ...state, items: [...state.items, action.item] };
    case 'toggle':
      return {
        ...state,
        items: state.items.map(i =>
          i.id === action.id ? { ...i, done: !i.done } : i
        ),
      };
    case 'select_all':
      return { ...state, selected: new Set(state.items.map(i => i.id)) };
    case 'set_filter':
      return { ...state, filter: action.filter };
  }
}

const [state, dispatch] = useReducer(reducer, initialState);
```

Why this beats multiple `useState`:
- All updates flow through one place — easier to reason about
- Updates that touch multiple keys stay atomic
- The action type is documentation for what can happen
- TypeScript catches invalid dispatches at compile time

### Lightweight state machine (no library)

Sometimes you want explicit transition rules but xstate is too heavy:

```tsx
type State = 'idle' | 'editing' | 'submitting' | 'saved' | 'error';
type Event = 'edit' | 'submit' | 'cancel' | 'resolve' | 'reject' | 'retry' | 'reset';

const transitions: Record<State, Partial<Record<Event, State>>> = {
  idle:       { edit: 'editing' },
  editing:    { submit: 'submitting', cancel: 'idle' },
  submitting: { resolve: 'saved', reject: 'error' },
  saved:      { reset: 'idle' },
  error:      { retry: 'submitting', cancel: 'idle' },
};

function transition(current: State, event: Event): State {
  return transitions[current][event] ?? current;
}

// Usage:
const [state, setState] = useState<State>('idle');
const send = (event: Event) => setState(s => transition(s, event));
```

Tradeoff to articulate: "I considered xstate but the state machine is small enough to inline. If transitions grew past ~10 or I needed parallel states or guards, I'd reach for xstate."

### Derived state — don't store, compute

The most common antipattern: storing data that can be derived from existing state or props.

```tsx
// Bad
const [items, setItems] = useState([]);
const [count, setCount] = useState(0);   // duplicates items.length

useEffect(() => {
  setCount(items.length);                // sync-state-with-effect antipattern
}, [items]);

// Good — derive at render
const [items, setItems] = useState([]);
const count = items.length;              // computed every render, free
```

For expensive derivations:
```tsx
const filtered = useMemo(
  () => items.filter(i => i.status === filter),
  [items, filter]
);
```

But default to inline compute. Memoize only when profiling shows benefit. See [react.dev/learn/you-might-not-need-an-effect](https://react.dev/learn/you-might-not-need-an-effect) for the canonical anti-pattern catalog.

### URL state for shareable / refreshable views

Search query, filter, page number, sort — these belong in the URL, not local state:

```tsx
// React Router
import { useSearchParams } from 'react-router-dom';

function ProductList() {
  const [params, setParams] = useSearchParams();
  const query = params.get('q') ?? '';

  return (
    <input
      value={query}
      onChange={e => {
        params.set('q', e.target.value);
        setParams(params);
      }}
    />
  );
}

// Next App Router
import { useRouter, useSearchParams } from 'next/navigation';

const router = useRouter();
const params = useSearchParams();
const update = (q: string) => router.push(`?q=${encodeURIComponent(q)}`);
```

Why: refresh-safe, shareable, back-button works, no state-sync needed.

## Prop API rules of thumb

- **Boolean props default to false** — `<Button disabled>` reads better than `<Button enabled={false}>`
- **Enums over booleans** when there are 3+ states — `variant="primary" | "secondary" | "ghost"` not 3 booleans
- **Children for content, props for behavior** — `<Button onClick={…}>Save</Button>` not `<Button label="Save" />`
- **Don't expose `className` unless you mean it** — once you do, callers will rely on overriding internals
- **Forward refs** for low-level primitives (`Button`, `Input`) — needed for focus management, libraries
- **Spread `...rest`** at the bottom level so callers can pass `id`, `aria-*`, `data-*` without you naming each

```tsx
const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', children, ...rest }, ref) => (
    <button ref={ref} className={cn('btn', `btn--${variant}`)} {...rest}>
      {children}
    </button>
  )
);
Button.displayName = 'Button';
```

## TypeScript prop patterns

```tsx
// Discriminated union for mutually exclusive props
type ButtonProps =
  | { variant: 'link'; href: string; onClick?: never }
  | { variant: 'button'; onClick: () => void; href?: never };

// Make prop required when another is set
type IconProps =
  | { icon: ReactNode; 'aria-label': string }   // icon-only → label required
  | { icon?: never; children: ReactNode };       // text → label optional

// Extend native element props
type ButtonProps = ComponentPropsWithoutRef<'button'> & {
  variant?: 'primary' | 'secondary';
};
```

## Common smells (and fixes)

| Smell | Fix |
|---|---|
| `useState` derived from props | Compute inline or `useMemo` |
| `useEffect` to sync state with props | Lift state up or derive |
| Many `isX` boolean props | Collapse to one `state` enum |
| Component takes `data` shaped exactly like its rendering | Pass children instead |
| Prop name describes implementation (`flexDirection`) | Rename to intent (`layout="vertical"`) |
| `any` in props | Use `ComponentPropsWithoutRef<'el'>` or a real type |
| Magic strings in className | Use a `cn`/`clsx` helper + tokens |

## Narration phrases

When walking through component design choices:
- "I made this a compound component because the caller needs to control structure and ordering — a flat API would have locked them in."
- "I went uncontrolled here because the parent doesn't need per-keystroke values; controlled would double the renders."
- "The `as` prop is there because the design uses this same visual for both buttons and links — a polymorphic component avoids a parallel `<LinkButton>`."
- "I forwarded the ref because a parent might need to focus this programmatically — common for modals."
