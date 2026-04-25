# Day 6 — Controlled vs Uncontrolled Inputs

## Objective

Understand the fundamental difference between controlled and uncontrolled inputs in React, how each affects render count, when to use each pattern, and why modern form libraries default to uncontrolled inputs for performance.

---

## Real World Importance

- Large forms (10+ fields) where typing becomes laggy because every keystroke rerenders the entire form
- Real-time validation that needs to read input values without causing rerenders
- Search inputs that need debouncing — understanding what to debounce
- Registration and checkout forms where performance directly affects conversion
- Libraries like React Hook Form, Formik — understanding why they work differently

---

## Concepts Covered

- What "controlled" means in React and how it works
- What "uncontrolled" means and how refs are used
- Render count per keystroke: controlled vs uncontrolled
- When controlled inputs are necessary (real-time UI sync, formatting)
- When uncontrolled is better (large forms, performance-critical inputs)
- The hybrid approach: `defaultValue` with ref access
- How React Hook Form avoids rerenders

---

## Exercise Task

### Step 1 — Build a controlled input

```jsx
function ControlledForm() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [bio, setBio] = useState('');

  console.log('ControlledForm rendered');

  return (
    <form>
      <input
        value={name}
        onChange={e => setName(e.target.value)}
        placeholder="Name"
      />
      <input
        value={email}
        onChange={e => setEmail(e.target.value)}
        placeholder="Email"
      />
      <textarea
        value={bio}
        onChange={e => setBio(e.target.value)}
        placeholder="Bio"
      />
      <p>Name: {name}</p>
    </form>
  );
}
```

Open the console. Type in the Name field. Watch how many times "ControlledForm rendered" appears — **one render per keystroke**.

### Step 2 — Build the same form uncontrolled

```jsx
function UncontrolledForm() {
  const nameRef = useRef();
  const emailRef = useRef();
  const bioRef = useRef();

  console.log('UncontrolledForm rendered');

  const handleSubmit = (e) => {
    e.preventDefault();
    console.log({
      name: nameRef.current.value,
      email: emailRef.current.value,
      bio: bioRef.current.value,
    });
  };

  return (
    <form onSubmit={handleSubmit}>
      <input ref={nameRef} defaultValue="" placeholder="Name" />
      <input ref={emailRef} defaultValue="" placeholder="Email" />
      <textarea ref={bioRef} defaultValue="" placeholder="Bio" />
      <button type="submit">Submit</button>
    </form>
  );
}
```

Type in any field. Watch the console — **zero rerenders while typing**. The component only renders once (initial mount).

### Step 3 — Compare render counts side by side

Mount both forms on the same page. Type 10 characters in each. Count renders.

Controlled: ~10+ renders per field  
Uncontrolled: 0 renders while typing

### Step 4 — Controlled input with live preview (justified rerenders)

```jsx
function LiveMarkdown() {
  const [markdown, setMarkdown] = useState('# Hello');

  return (
    <div style={{ display: 'flex' }}>
      <textarea
        value={markdown}
        onChange={e => setMarkdown(e.target.value)}
      />
      <div dangerouslySetInnerHTML={{ __html: parseMarkdown(markdown) }} />
    </div>
  );
}
```

Here the rerender is **intentional** — you need the preview to update on every keystroke. Controlled is the right choice.

### Step 5 — Hybrid: defaultValue + ref

```jsx
function HybridForm({ initialData }) {
  const formRef = useRef();

  const handleSubmit = () => {
    const data = new FormData(formRef.current);
    console.log(Object.fromEntries(data));
  };

  return (
    <form ref={formRef}>
      <input name="name" defaultValue={initialData.name} />
      <input name="email" defaultValue={initialData.email} />
      <button type="button" onClick={handleSubmit}>Submit</button>
    </form>
  );
}
```

`defaultValue` sets the initial DOM value without React controlling subsequent changes. Read on submit via FormData or ref.

---

## What To Observe

- Controlled: every keystroke → setState → rerender → React updates DOM
- Uncontrolled: DOM manages its own value, React doesn't know about keystrokes
- Ref access works to read uncontrolled input values imperatively
- Controlled is needed when displayed UI must reflect input value in real-time
- `value` (controlled) vs `defaultValue` (uncontrolled) — different prop, different behavior

---

## Internal React Explanation

### How controlled inputs work

React overrides the browser's native input behavior. When you set `value={name}` on an input, React:

1. After every render, imperatively sets `input.value = name` via DOM API
2. The `onChange` handler is actually `oninput` under the hood (fires on every character)
3. `onChange` calls `setName()` → triggers rerender → React sets `input.value` again

The input is under React's full control. The browser's native value tracking is bypassed. This is why typing in a controlled input without an `onChange` handler appears to do nothing — React resets the value on every render.

### How uncontrolled inputs work

Uncontrolled inputs use the browser's native DOM behavior:

1. The browser manages the input's value natively in the DOM node
2. React doesn't subscribe to changes via state
3. React doesn't read or update `input.value` during renders
4. You read the value imperatively via `ref.current.value` when needed (submit, validation trigger)

React still renders the component, but there's nothing that makes the input trigger a render. The component is "unaware" of typing.

### The `value` vs `defaultValue` distinction

`value` (controlled): React syncs this to `input.value` after every render.
`defaultValue` (uncontrolled): React sets `input.value` once on mount (initial render). After that, the browser owns the value and React doesn't touch it.

Changing `defaultValue` after initial mount has no effect on the displayed value — the DOM already owns it.

### Why every controlled keystroke rerenders

The flow for controlled:
```
User types 'a'
  → browser fires input event
  → React onChange handler fires
  → setState called with new value
  → React schedules rerender
  → Component function called
  → React diffs new JSX vs old
  → React updates DOM (minimal, just value)
```

For a form with 10 fields sharing one state object, all 10 fields' JSX is re-evaluated on every keystroke. For 100-field enterprise forms, this adds up.

### How React Hook Form (RHF) avoids this

RHF registers inputs with a ref (uncontrolled by default). It uses native browser events to track values without React state. Validation is triggered by blur/submit events, not every keystroke. Components don't rerender during typing. On submit, RHF reads all values from refs in one pass.

This is why RHF forms feel snappy even with 50+ fields.

---

## Optimization Challenge

**Challenge 1:** Take the controlled form and optimize it so only the changed field's preview rerenders, not the entire form. Use field-level components with `React.memo`.

**Challenge 2:** Build a live character counter below a textarea (controlled). Optimize so the counter updates but the rest of the form doesn't rerender.

**Challenge 3:** Build a search input that's uncontrolled (no state on every keystroke) but has a debounced controlled state for the search results:

```jsx
function SmartSearch() {
  const inputRef = useRef();
  const [query, setQuery] = useState('');

  const handleInput = useCallback(
    debounce(() => setQuery(inputRef.current.value), 300),
    []
  );

  return (
    <>
      <input ref={inputRef} onInput={handleInput} placeholder="Search..." />
      <SearchResults query={query} />
    </>
  );
}
```

The input itself never causes a rerender. `SearchResults` only rerenders after 300ms of pause.

---

## Why This Optimization Works

Uncontrolled inputs eliminate the state → rerender → DOM update cycle for every keystroke. For pure text entry where you only need the value on specific events (blur, submit, button click), this cycle is pure overhead.

The optimization reduces:
- Component function calls per keystroke: from N (all fields) to 0
- Virtual DOM reconciliation per keystroke: eliminated entirely
- React scheduler overhead: no state updates to process during typing

For forms with complex validation logic, computed fields, or expensive child components, this can mean the difference between 60fps typing and laggy input.

---

## Common Mistakes

**Mistake 1: Making everything controlled "because it's more React-y"**

Controlled inputs are a tool, not a default. For forms where you only need the value on submit, uncontrolled is simpler and faster.

**Mistake 2: Mixing controlled and uncontrolled on the same input**

```jsx
// React warning: Input switching from controlled to uncontrolled
<input value={name || ''} onChange={setName} />
// If name is undefined initially, this is "uncontrolled" then becomes "controlled"
```

Always provide a defined initial value for controlled inputs.

**Mistake 3: Using `defaultValue` and expecting it to update**

`defaultValue` is a one-time initializer. If your data loads asynchronously and you want to populate the form after loading, you need either controlled inputs or a `key` on the form to force remount.

**Mistake 4: Forgetting that uncontrolled inputs don't reflect state changes**

If you need to programmatically clear a form, reset a field, or populate it with data after mount, you must either use controlled inputs or imperatively update `ref.current.value`.

**Mistake 5: Debouncing setState but not the input handling**

```jsx
const debouncedSet = debounce(setQuery, 300);
<input onChange={e => debouncedSet(e.target.value)} />
```

The `onChange` still fires on every keystroke. Only the `setQuery` call is debounced. The controlled value will lag, causing the input to show stale characters. This approach needs a hybrid pattern (uncontrolled input + debounced state).

---

## Debugging Tools

### Render counter per field component

```jsx
const FieldInput = React.memo(function FieldInput({ label, value, onChange }) {
  const renderCount = useRef(0);
  renderCount.current++;
  console.log(`${label} field rendered #${renderCount.current}`);
  return <input value={value} onChange={onChange} placeholder={label} />;
});
```

### Performance.mark for typing latency

```jsx
const handleChange = (e) => {
  performance.mark('change-start');
  setValue(e.target.value);
  requestAnimationFrame(() => {
    performance.mark('change-end');
    performance.measure('change', 'change-start', 'change-end');
    const [entry] = performance.getEntriesByName('change');
    console.log(`Typing latency: ${entry.duration.toFixed(2)}ms`);
  });
};
```

---

## Interview Questions

1. What is the difference between a controlled and uncontrolled input?
2. How does React manage controlled input values internally?
3. How many rerenders does typing in a controlled input cause?
4. When should you prefer uncontrolled inputs?
5. What is `defaultValue` and how does it differ from `value`?
6. How does React Hook Form avoid rerenders during typing?
7. What happens if you don't provide an `onChange` handler for a controlled input?
8. How do you read an uncontrolled input's value?
9. Can you programmatically change the value of an uncontrolled input?
10. What is the "switching from controlled to uncontrolled" warning?

---

## Interview Answers

**1. Controlled vs uncontrolled?**
Controlled: input value is driven by React state (`value={state}`). Every change must go through `onChange` → `setState` → rerender → React updates DOM. React owns the value. Uncontrolled: browser's native DOM manages the value. React only reads it on demand via ref. No state updates per keystroke.

**2. How React manages controlled input?**
React attaches a synthetic event listener for `input` events. On change, your `onChange` fires, updating state. On rerender, React imperatively calls `input.value = stateValue` via the DOM API to sync the DOM with React state. This happens after every render.

**3. How many rerenders per keystroke?**
One rerender per keystroke for the component owning the state, plus any non-memoized children. For a large form in a single component, every keystroke rerenders all fields.

**4. When to prefer uncontrolled?**
When you only need the value at specific events (submit, blur, validation trigger). Large forms with many fields. Forms that feel sluggish because of rerender overhead. When using React Hook Form or similar libraries.

**5. defaultValue vs value?**
`defaultValue` sets the initial value once at mount. The DOM takes ownership afterward — React never updates it again. `value` keeps React in control — React syncs the DOM value to match state after every render.

**6. How React Hook Form avoids rerenders?**
RHF uses refs to register inputs (uncontrolled). Field values are tracked in a mutable object, not React state. Validation and subscriptions are managed via an event emitter pattern. Components only rerender when their specific field's error or validation state changes, not on every keystroke.

**7. Controlled input without onChange?**
React renders the input with `value={state}` but throws a warning: "You provided a `value` prop without an `onChange` handler, making it read-only." The input appears to accept no typing — every render resets the value to `state`.

**8. Reading uncontrolled input value?**
Via `ref.current.value`: `const value = inputRef.current.value`. Or via `FormData`: `const data = new FormData(formElement); data.get('fieldName')`. Or via native events: `event.target.value` in submit/blur handlers.

**9. Programmatically changing uncontrolled input?**
Yes: `inputRef.current.value = 'new value'` directly manipulates the DOM. For React to "know" about it (e.g., for validation), you'd also dispatch an input event: `inputRef.current.dispatchEvent(new Event('input', { bubbles: true }))`. Alternatively, use controlled inputs when you need this.

**10. Controlled/uncontrolled switching warning?**
Occurs when a component starts as uncontrolled (`value={undefined}`) and later becomes controlled (`value="something"`) — or vice versa. React can't switch an input from one mode to the other after mount. Fix by ensuring `value` is never `undefined` if using controlled: initialize state to `''` not `undefined`.

---

## Senior-Level Thinking

**The performance profile of your form matters at scale.**

For a simple 3-field login form, controlled is fine. For a data-entry form with 30+ fields, complex validation, and a preview panel that must update as you type, the architecture decision is real. RHF exists because real-world forms need the performance of uncontrolled with the ergonomics of a form library.

**Controlled inputs enable powerful patterns.**

Real-time formatting (credit card numbers, phone numbers), live character counts, instant validation feedback, dependent fields that update based on other field values — all of these require controlled inputs. The rerenders are the feature.

**`useId` for accessibility.**

When building accessible forms with controlled inputs, use `useId()` (React 18+) to generate stable IDs for label-input associations. Don't use index-based IDs.

**Uncontrolled doesn't mean "no validation."**

RHF and other libraries do full validation with uncontrolled inputs — they just trigger validation on specific events (blur, submit) rather than every keystroke. You lose real-time typing validation but that's often acceptable and less distracting to users.

---

## Revision Notes

- Controlled: React owns value via state, rerenders on every keystroke
- Uncontrolled: DOM owns value, zero rerenders during typing
- `value` = controlled, `defaultValue` = uncontrolled initial value (set once)
- Read uncontrolled values via ref or FormData
- Controlled = necessary for real-time UI sync (previews, formatting)
- Uncontrolled = better for large forms, submit-only validation
- React Hook Form = uncontrolled + smart re-subscription for validation errors
- Mixing controlled/uncontrolled on same input → React warning

---

## Next Day Preview

**Day 7 — Weekly Review Project: Optimized Todo App**

Apply everything from Week 1 in a single project: proper keys, `React.memo`, `useCallback`, `useMemo`, and the right input pattern. Build it with render logging to verify your optimizations work.
