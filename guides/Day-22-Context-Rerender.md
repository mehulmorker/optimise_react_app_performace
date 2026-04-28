# Day 22 — Context Rerender Optimization

## Objective

Understand why React Context causes every consumer to rerender when the context value changes — even if the consumer only uses part of the value. Learn to split context, memoize context values, and decide when context is the wrong tool entirely.

---

## Real World Importance

- Global theme state: changing theme rerenders every component consuming context
- Auth context: one user property changing rerenders all authenticated views
- Shopping cart: updating quantity rerenders every component that checks cart count
- Settings context with 10 values: changing one value rerenders all 10 consumers
- Notification count badge: rerenders entire app on every notification

---

## Concepts Covered

- How context subscription works (all consumers rerender on value change)
- Why `React.memo` doesn't help for context consumers
- Splitting context into smaller pieces
- Memoizing context values with `useMemo`
- The dispatch pattern (separate state from dispatch)
- When to use Zustand/Jotai instead of context

---

## Exercise Task

Create a new file: `src/components/ContextDemo.jsx`

### Setup — Before you start

```jsx
import React, {
  createContext, useContext, useState, useMemo, useReducer
} from 'react';
```

---

### Step 1 — Build the broken context

```jsx
const AppContext = createContext(null);

function AppProvider({ children }) {
  const [user, setUser] = useState({ name: 'Alice', role: 'admin' });
  const [theme, setTheme] = useState('light');
  const [cart, setCart] = useState([]);
  const [notifications, setNotifications] = useState(0);

  const value = {
    user, setUser,
    theme, setTheme,
    cart, setCart,
    notifications, setNotifications,
  };

  return (
    <AppContext.Provider value={value}>
      {children}
    </AppContext.Provider>
  );
}

// Components that consume different parts of context
function Header() {
  const { user, theme } = useContext(AppContext);
  console.log('Header rendered');
  return <header style={{ padding: 8 }}>{user.name} — {theme}</header>;
}

function CartBadge() {
  const { cart } = useContext(AppContext);
  console.log('CartBadge rendered');
  return <span>{cart.length} items</span>;
}

function NotificationBell() {
  const { notifications } = useContext(AppContext);
  console.log('NotificationBell rendered');
  return <span>{notifications} notifications</span>;
}

function ThemeToggle() {
  const { theme, setTheme } = useContext(AppContext);
  return (
    <button onClick={() => setTheme(t => t === 'light' ? 'dark' : 'light')}>
      Toggle Theme ({theme})
    </button>
  );
}

function AddToCart() {
  const { setCart } = useContext(AppContext);
  return (
    <button onClick={() => setCart(prev => [...prev, { id: Date.now() }])}>
      Add to Cart
    </button>
  );
}

export function ContextBroken() {
  return (
    <AppProvider>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <Header />
        <CartBadge />
        <NotificationBell />
        <ThemeToggle />
        <AddToCart />
      </div>
    </AppProvider>
  );
}
```

Click **Toggle Theme**. Open the console and observe: `CartBadge` and `NotificationBell` both rerender — even though they don't use `theme`. This is the context rerender problem.

Click **Add to Cart**. Same issue: `Header` and `NotificationBell` rerender even though they don't use `cart`.

---

### Step 2 — Attempt React.memo (see why it doesn't help)

**Add this variant** — a new export showing the memo attempt:

```jsx
const CartBadgeMemo = React.memo(function CartBadgeMemo() {
  const { cart } = useContext(AppContext);
  console.log('CartBadgeMemo rendered');
  return <span>{cart.length} items (memo)</span>;
});

export function ContextMemoAttempt() {
  return (
    <AppProvider>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <CartBadgeMemo />
        <ThemeToggle />
      </div>
    </AppProvider>
  );
}
```

Click **Toggle Theme**. `CartBadgeMemo` STILL rerenders. `React.memo` only prevents rerenders from parent rerenders. Context changes bypass memo — they're a different subscription mechanism.

---

### Step 3 — Fix by splitting context

Create separate contexts and a new provider. **This is a new set of components** — the split version, not a replacement for Steps 1-2:

```jsx
const UserContext = createContext(null);
const ThemeContext = createContext(null);
const CartContext = createContext(null);
const NotificationContext = createContext(null);

function SplitAppProvider({ children }) {
  const [user, setUser] = useState({ name: 'Alice', role: 'admin' });
  const [theme, setTheme] = useState('light');
  const [cart, setCart] = useState([]);
  const [notifications, setNotifications] = useState(0);

  return (
    <UserContext.Provider value={{ user, setUser }}>
      <ThemeContext.Provider value={{ theme, setTheme }}>
        <CartContext.Provider value={{ cart, setCart }}>
          <NotificationContext.Provider value={{ notifications, setNotifications }}>
            {children}
          </NotificationContext.Provider>
        </CartContext.Provider>
      </ThemeContext.Provider>
    </UserContext.Provider>
  );
}

// Each component subscribes to only its context
function HeaderSplit() {
  const { user } = useContext(UserContext);
  const { theme } = useContext(ThemeContext);
  console.log('HeaderSplit rendered');
  return <header style={{ padding: 8 }}>{user.name} — {theme}</header>;
}

function CartBadgeSplit() {
  const { cart } = useContext(CartContext);
  console.log('CartBadgeSplit rendered');
  return <span>{cart.length} items</span>;
}

function ThemeToggleSplit() {
  const { theme, setTheme } = useContext(ThemeContext);
  return (
    <button onClick={() => setTheme(t => t === 'light' ? 'dark' : 'light')}>
      Toggle Theme ({theme})
    </button>
  );
}

function AddToCartSplit() {
  const { setCart } = useContext(CartContext);
  return (
    <button onClick={() => setCart(prev => [...prev, { id: Date.now() }])}>
      Add to Cart
    </button>
  );
}

export function ContextSplit() {
  return (
    <SplitAppProvider>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <HeaderSplit />
        <CartBadgeSplit />
        <ThemeToggleSplit />
        <AddToCartSplit />
      </div>
    </SplitAppProvider>
  );
}
```

Click **Toggle Theme**. Now only `HeaderSplit` and `ThemeToggleSplit` rerender. `CartBadgeSplit` is unaffected.

---

### Step 4 — Memoize context values

Even with split contexts, the provider rerenders when its parent rerenders, creating new context value objects. **Update `SplitAppProvider`** to memoize its values:

```jsx
// REPLACE SplitAppProvider with this memoized version
function SplitAppProvider({ children }) {
  const [user, setUser] = useState({ name: 'Alice', role: 'admin' });
  const [theme, setTheme] = useState('light');
  const [cart, setCart] = useState([]);
  const [notifications, setNotifications] = useState(0);

  // Without useMemo: new object every render → all consumers rerender
  // With useMemo: same reference when value hasn't changed
  const userValue = useMemo(() => ({ user, setUser }), [user]);
  const themeValue = useMemo(() => ({ theme, setTheme }), [theme]);
  const cartValue = useMemo(() => ({ cart, setCart }), [cart]);
  const notifValue = useMemo(() => ({ notifications, setNotifications }), [notifications]);

  return (
    <UserContext.Provider value={userValue}>
      <ThemeContext.Provider value={themeValue}>
        <CartContext.Provider value={cartValue}>
          <NotificationContext.Provider value={notifValue}>
            {children}
          </NotificationContext.Provider>
        </CartContext.Provider>
      </ThemeContext.Provider>
    </UserContext.Provider>
  );
}
```

---

### Step 5 — The state/dispatch split pattern

For complex state, separate the data from the updater. The `dispatch` function from `useReducer` is guaranteed to be stable (same reference forever) — components that only dispatch never need to rerender when state changes.

First, define the reducer:

```jsx
function cartReducer(state, action) {
  switch (action.type) {
    case 'ADD':
      return [...state, { id: action.id, name: action.name }];
    case 'REMOVE':
      return state.filter(item => item.id !== action.id);
    case 'CLEAR':
      return [];
    default:
      return state;
  }
}
```

Now build the split provider:

```jsx
const CartStateContext = createContext(null);
const CartDispatchContext = createContext(null);

function CartProvider({ children }) {
  const [cart, dispatch] = useReducer(cartReducer, []);

  return (
    <CartStateContext.Provider value={cart}>
      {/* dispatch is always the same reference — this context never triggers rerenders */}
      <CartDispatchContext.Provider value={dispatch}>
        {children}
      </CartDispatchContext.Provider>
    </CartStateContext.Provider>
  );
}

// Only subscribes to dispatch — NEVER rerenders when cart changes
function AddToCartDispatch({ productId, productName }) {
  const dispatch = useContext(CartDispatchContext);
  console.log('AddToCartDispatch rendered');
  return (
    <button onClick={() => dispatch({ type: 'ADD', id: productId, name: productName })}>
      Add to Cart
    </button>
  );
}

// Only subscribes to cart state
function CartCount() {
  const cart = useContext(CartStateContext);
  console.log('CartCount rendered');
  return <span>Cart: {cart.length}</span>;
}

export function ContextDispatchSplit() {
  return (
    <CartProvider>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <CartCount />
        <AddToCartDispatch productId={1} productName="Widget" />
        <AddToCartDispatch productId={2} productName="Gadget" />
      </div>
    </CartProvider>
  );
}
```

Click either "Add to Cart" button. Only `CartCount` rerenders — the two `AddToCartDispatch` buttons don't rerender because `dispatch` is stable and `CartDispatchContext` never changes.

---

## What To Observe

- Single context with multiple values: all consumers rerender when any value changes
- React.memo doesn't help for context consumers (context bypasses memo)
- Split contexts: consumers only rerender when their specific context changes
- useMemo on context value: prevents rerenders when provider's parent rerenders
- State/dispatch split: action components don't rerender when data changes

---

## Internal React Explanation

### How context subscriptions work

When you call `useContext(MyContext)`, React adds this component to the context's subscriber list. When the context value changes (new reference from `Provider`'s `value` prop), React walks the subscriber list and schedules a rerender for every subscriber — regardless of what part of the value they use.

This is the fundamental limitation: **context has no partial subscriptions**. The check is simple: `Object.is(prevValue, nextValue)`. If different → rerender all subscribers.

The comparison is on the **entire value object**. `{ theme: 'dark', user: alice }` is a new reference from `{ theme: 'light', user: alice }` — so all consumers rerender even if `user` didn't change.

### Why React.memo doesn't help

`React.memo` intercepts rerenders coming from parent component renders. Context rerenders are triggered through a separate subscription mechanism, **bypassing the normal parent-child rerender path**. Memo has no visibility into this.

### Context value reference stability

```jsx
function Provider({ children }) {
  const [count, setCount] = useState(0);
  const [name, setName] = useState('Alice');

  // New object reference every render!
  return <MyContext.Provider value={{ count, name }}>
```

Every time `Provider` rerenders (for any reason), `{ count, name }` is a new object. `Object.is` returns false. All consumers rerender.

`useMemo(() => ({ count, name }), [count, name])` returns the same reference as long as neither `count` nor `name` changes.

---

## Optimization Challenge

**Challenge 1:** Build an auth context that separates:
- `AuthStateContext`: user data (rerenders consumers when user changes)
- `AuthActionsContext`: login/logout functions (never rerenders — stable dispatch)

**Challenge 2:** Build a theme context that a `ThemeToggle` component and 20 other components use. Measure: how many components rerender when theme changes? (should be: just theme consumers). How many when a user profile updates? (should be: zero theme consumers).

**Challenge 3:** Replace the context entirely with Zustand:

```js
import { create } from 'zustand';

const useAppStore = create(set => ({
  theme: 'light',
  setTheme: (t) => set({ theme: t }),
  cart: [],
  addToCart: (item) => set(state => ({ cart: [...state.cart, item] })),
}));

// Usage:
function CartBadge() {
  const cartLength = useAppStore(state => state.cart.length);
  // Only rerenders when cart.length changes — not on theme changes!
  return <span>{cartLength}</span>;
}
```

Zustand's selector pattern: consumers rerender only when the selected value changes.

---

## Why This Optimization Works

Split context ensures each subscriber is only notified about changes it cares about. Instead of all N consumers rerendering when any of M values changes (O(N × M)), only the relevant subscribers rerender.

The state/dispatch split pattern is particularly powerful: most "action" components (buttons, forms) only need the dispatch function, not the data. They can be completely immune to data changes.

---

## Common Mistakes

**Mistake 1: One giant context for all global state**

Every app feature's state in one context means everything rerenders on any change. Split by domain: `UserContext`, `ThemeContext`, `CartContext`.

**Mistake 2: Not memoizing context values**

```jsx
<AppContext.Provider value={{ user, theme, setUser, setTheme }}>
```

Even with split contexts, if the provider doesn't memoize the value, a parent rerender recreates the object and triggers all consumers.

**Mistake 3: Using context for state that changes frequently**

Context is efficient for infrequently-changing global state (user auth, theme, locale). For frequently-changing state (search query, animation frame, scroll position), context would cause performance issues regardless of optimization.

**Mistake 4: Selecting from context with useContext then ignoring most of it**

```jsx
const { user, theme, cart, notifications } = useContext(AppContext);
// Only uses 'user' but rerenders on ALL changes
```

If you're destructuring but only using some properties, split the context.

**Mistake 5: Context for prop drilling avoidance in performance-critical paths**

Context subscription has overhead. If a piece of data only needs to go 3 levels deep, direct props may be more appropriate.

---

## Debugging Tools

### Identify which context triggers rerenders

```jsx
function CartBadge() {
  const cart = useContext(CartContext);
  console.log('CartBadge rendered, cart:', cart);
  return <span>{cart.length}</span>;
}
```

### React DevTools — "Why did this render?"

Enable "Record why each component rendered" in Profiler. Context-triggered rerenders show as "Context changed" with the context name.

---

## Interview Questions

1. Why does every context consumer rerender when the context value changes?
2. Why doesn't `React.memo` prevent context-triggered rerenders?
3. What is the benefit of splitting a large context into smaller ones?
4. Why should context values be memoized?
5. What is the state/dispatch context split pattern?
6. When should you use a state management library instead of context?
7. How does `useReducer` + context compare to `useState` + context?
8. What is the "children composition" pattern as an alternative to context?
9. Can context work efficiently for frequently-changing state?
10. How do Zustand selectors differ from context subscriptions?

---

## Interview Answers

**1. Why every consumer rerenders?**
Context has no partial subscriptions. When the `Provider`'s `value` prop changes (new reference), React marks all components that called `useContext(MyContext)` as needing an update, regardless of which properties they use. The check is `Object.is(prevValue, nextValue)` on the whole value.

**2. React.memo doesn't help?**
`React.memo` intercepts the parent-child rerender path. Context updates take a different code path in React's reconciler — they directly mark subscribed fibers as "needing update" and bypass memo's bailout check.

**3. Benefit of split context?**
Each consumer subscribes only to the context it needs. When theme changes, only theme consumers are notified. Cart consumers are unaffected. O(relevant consumers) instead of O(all consumers) per change.

**4. Why memoize context values?**
Without `useMemo`, every provider render creates a new object reference. `Object.is` returns false on every render. All consumers rerender on every provider render — even when the data didn't change.

**5. State/dispatch split?**
Two contexts: one for state (data), one for dispatch (updater). Components that only trigger actions subscribe to `DispatchContext` (whose value — the dispatch function — never changes). They don't rerender when state changes.

**6. When to use state library instead?**
When: state changes frequently (>10/second), you need granular subscriptions (select specific fields), complex state machines, or you need devtools, time travel, or middleware. Zustand, Jotai, Recoil, Redux Toolkit all offer selector patterns that context doesn't.

**7. useReducer + context vs useState + context?**
`useReducer` is better when state transitions are complex, you want predictable state updates via actions, or you want to separate the dispatch function (which is stable) from state for the split pattern.

**8. Children composition alternative?**
Instead of `<Parent>` using context to pass data to `<GrandChild>`, compose:
```jsx
<Parent child={<GrandChild data={data} />} />
```
`data` is passed to `GrandChild` at the same level as `Parent`, not through context.

**9. Context for frequently-changing state?**
Technically possible but inefficient. Every change rerenders all consumers. For scroll position, animation frames, or real-time data, use local state or a library with fine-grained subscriptions (Jotai, Recoil).

**10. Zustand selectors vs context?**
Context: subscribe to entire value, rerender on any change. Zustand: subscribe to a selected slice via a selector function, rerender only when the selected value changes. Fine-grained, prop-level subscriptions.

---

## Senior-Level Thinking

**Context is for infrequently-changing global state.**

Theme, locale, auth user, feature flags — these change rarely (once per session). Context is perfect for them. The consumer-rerender problem is acceptable when changes are rare.

For cart, notifications, form state, search results — these change frequently. Context will cause too many rerenders. Use local state, URL state, or a dedicated store.

---

## Revision Notes

- All context consumers rerender when context value changes (any change)
- React.memo does NOT prevent context-triggered rerenders
- Split contexts: each consumer subscribes to only what it needs
- Always useMemo on context value objects/arrays
- State/dispatch split: dispatch is stable, reduces "action" component rerenders
- Define cartReducer (or any reducer) outside the component/provider
- Context for: rarely-changing global state (theme, auth, locale)
- Library for: frequently-changing state, fine-grained subscriptions

---

## Next Day Preview

**Day 23 — React.lazy + Suspense**

Code splitting with dynamic imports. How `React.lazy` defers loading a component until it's needed. How `Suspense` shows a fallback while loading. Route-level code splitting to reduce initial bundle size.
