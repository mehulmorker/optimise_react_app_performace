# Day 26 — Smart vs Dumb Components

## Objective

Master the container/presentational pattern: separating stateful logic from UI rendering. This architectural split makes components easier to test, reuse, and reason about — and eliminates a class of unnecessary rerenders caused by mixing data fetching with rendering.

---

## Real World Importance

- A `UserCard` component that fetches its own data can't be reused in Storybook or unit tests
- A `ProductList` that sorts AND renders must rerender when sort logic changes, even if UI is identical
- A form component that handles both validation logic and field rendering is hard to change without breaking the UI
- Data fetching components: the UI should be portable, the data layer should be swappable
- Team collaboration: designers can work on "dumb" components; engineers work on "smart" containers

---

## Concepts Covered

- The container/presentational split (smart vs dumb)
- What makes a component "smart" vs "dumb"
- Extracting logic into custom hooks (the modern pattern)
- Why dumb components are easier to test and reuse
- How the split prevents logic-driven rerenders from hitting the UI
- When NOT to split (over-engineering small components)
- Colocating types and props for presentational components

---

## Exercise Task

### Step 1 — The mixed (anti-pattern) component

```jsx
// Bad: one component does everything
function UserProfile({ userId }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState({});

  useEffect(() => {
    fetch(`/api/users/${userId}`)
      .then(r => r.json())
      .then(data => {
        setUser(data);
        setDraft(data);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }, [userId]);

  const handleSave = async () => {
    await fetch(`/api/users/${userId}`, {
      method: 'PATCH',
      body: JSON.stringify(draft),
    });
    setUser(draft);
    setIsEditing(false);
  };

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div className="user-profile">
      {isEditing ? (
        <>
          <input value={draft.name} onChange={e => setDraft(d => ({ ...d, name: e.target.value }))} />
          <input value={draft.email} onChange={e => setDraft(d => ({ ...d, email: e.target.value }))} />
          <button onClick={handleSave}>Save</button>
          <button onClick={() => { setDraft(user); setIsEditing(false); }}>Cancel</button>
        </>
      ) : (
        <>
          <h2>{user.name}</h2>
          <p>{user.email}</p>
          <button onClick={() => setIsEditing(true)}>Edit</button>
        </>
      )}
    </div>
  );
}
```

Problems:
- Can't render this component in Storybook without a real API
- Can't unit test the save logic without mounting the full UI
- Can't reuse the UI for a different data source (e.g., a different API endpoint)
- Data fetching + editing logic + rendering all rerender together

### Step 2 — Extract the logic into a custom hook (smart)

```jsx
// hooks/useUserProfile.js
function useUserProfile(userId) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState({});

  useEffect(() => {
    setLoading(true);
    fetch(`/api/users/${userId}`)
      .then(r => r.json())
      .then(data => {
        setUser(data);
        setDraft(data);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }, [userId]);

  const startEditing = useCallback(() => setIsEditing(true), []);

  const cancelEditing = useCallback(() => {
    setDraft(user);
    setIsEditing(false);
  }, [user]);

  const updateDraft = useCallback((field, value) => {
    setDraft(d => ({ ...d, [field]: value }));
  }, []);

  const save = useCallback(async () => {
    await fetch(`/api/users/${userId}`, {
      method: 'PATCH',
      body: JSON.stringify(draft),
    });
    setUser(draft);
    setIsEditing(false);
  }, [userId, draft]);

  return { user, loading, error, isEditing, draft, startEditing, cancelEditing, updateDraft, save };
}
```

### Step 3 — Build the dumb (presentational) component

```jsx
// Presentational: receives everything via props, has no internal state or effects
function UserProfileView({
  user,
  loading,
  error,
  isEditing,
  draft,
  onStartEditing,
  onCancelEditing,
  onUpdateDraft,
  onSave,
}) {
  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div className="user-profile">
      {isEditing ? (
        <>
          <input
            value={draft.name}
            onChange={e => onUpdateDraft('name', e.target.value)}
          />
          <input
            value={draft.email}
            onChange={e => onUpdateDraft('email', e.target.value)}
          />
          <button onClick={onSave}>Save</button>
          <button onClick={onCancelEditing}>Cancel</button>
        </>
      ) : (
        <>
          <h2>{user.name}</h2>
          <p>{user.email}</p>
          <button onClick={onStartEditing}>Edit</button>
        </>
      )}
    </div>
  );
}
```

### Step 4 — Wire them together with a container

```jsx
// Container: smart — owns logic, delegates rendering
function UserProfileContainer({ userId }) {
  const props = useUserProfile(userId);
  return (
    <UserProfileView
      user={props.user}
      loading={props.loading}
      error={props.error}
      isEditing={props.isEditing}
      draft={props.draft}
      onStartEditing={props.startEditing}
      onCancelEditing={props.cancelEditing}
      onUpdateDraft={props.updateDraft}
      onSave={props.save}
    />
  );
}

// In your app:
<UserProfileContainer userId="abc123" />
```

Or spread all props if the shapes align:

```jsx
function UserProfileContainer({ userId }) {
  const { user, loading, error, isEditing, draft, startEditing, cancelEditing, updateDraft, save } = useUserProfile(userId);
  return (
    <UserProfileView
      user={user}
      loading={loading}
      error={error}
      isEditing={isEditing}
      draft={draft}
      onStartEditing={startEditing}
      onCancelEditing={cancelEditing}
      onUpdateDraft={updateDraft}
      onSave={save}
    />
  );
}
```

### Step 5 — Swappable data sources

The dumb component works with any data source:

```jsx
// From API (production)
<UserProfileContainer userId="abc123" />

// From static props (Storybook / tests)
<UserProfileView
  user={{ name: 'Alice', email: 'alice@example.com' }}
  loading={false}
  error={null}
  isEditing={false}
  draft={{ name: 'Alice', email: 'alice@example.com' }}
  onStartEditing={() => {}}
  onCancelEditing={() => {}}
  onUpdateDraft={() => {}}
  onSave={() => {}}
/>

// From mock hook (integration test)
jest.mock('../hooks/useUserProfile', () => ({
  useUserProfile: () => ({
    user: { name: 'Alice', email: 'alice@example.com' },
    loading: false,
    error: null,
    isEditing: false,
    draft: { name: 'Alice', email: 'alice@example.com' },
    startEditing: jest.fn(),
    cancelEditing: jest.fn(),
    updateDraft: jest.fn(),
    save: jest.fn(),
  }),
}));
```

### Step 6 — The rerender benefit

```jsx
// Smart component: refetches when userId changes → loading/error/user change
// These state changes only affect UserProfileContainer

// Dumb component: React.memo can bail out when none of its props change
const UserProfileView = React.memo(function UserProfileView({ ... }) {
  console.log('UserProfileView rendered');
  // ...
});

// If parent refetches but data is the same, UserProfileView bails out
// If only `isEditing` changes (user clicked Edit), only isEditing-dependent JSX rerenders
```

---

## What To Observe

- Mixed component: cannot be rendered in isolation, cannot be unit tested without API mocking
- Split: `UserProfileView` works in Storybook with static props — zero setup
- `React.memo` on the dumb component: bails out when API refetches return the same data
- Swappable container: replace `UserProfileContainer` with a WebSocket version — UI is unchanged
- Testing the hook: pure function tests for logic (save, draft updates, error states) without mounting DOM

---

## Internal React Explanation

### Why mixing causes rerender coupling

A component that fetches AND renders has two reasons to rerender:
1. Data changes (fetch completes, error occurs)
2. UI interaction (hover, focus, expand, collapse)

With a mixed component, a network response rerenders the entire component — including the UI tree that's independent of the response. With the split:
- Data changes trigger a container rerender (cheap — just runs the hook)
- The container passes new props → `React.memo` on the dumb component evaluates the diff
- If the view props didn't change, the view doesn't rerender

### The custom hook as the "smart" layer

Modern React has effectively replaced the "smart component" with a "custom hook." The hook extracts all stateful logic; the container is now just the hook + render call. This means:

```
Old pattern: Smart Component → renders Dumb Component
New pattern: Custom Hook → used in Container → renders Dumb Component
```

The container is often just 5-10 lines of wiring code.

### Props interface as a contract

The presentational component's props define a contract:
- Caller promises to provide this shape
- Component promises to render correctly given any valid shape
- This contract makes components composable and independently testable

---

## Optimization Challenge

**Challenge 1:** Refactor this into smart/dumb:

```jsx
function NotificationList() {
  const [notifications, setNotifications] = useState([]);
  const [filter, setFilter] = useState('all'); // 'all' | 'unread' | 'read'

  useEffect(() => {
    const interval = setInterval(() => {
      fetch('/api/notifications')
        .then(r => r.json())
        .then(setNotifications);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const filtered = notifications.filter(n => {
    if (filter === 'unread') return !n.read;
    if (filter === 'read') return n.read;
    return true;
  });

  const markRead = async (id) => {
    await fetch(`/api/notifications/${id}/read`, { method: 'POST' });
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  };

  return (
    <div>
      <select value={filter} onChange={e => setFilter(e.target.value)}>
        <option value="all">All</option>
        <option value="unread">Unread</option>
        <option value="read">Read</option>
      </select>
      {filtered.map(n => (
        <div key={n.id}>
          <span>{n.message}</span>
          {!n.read && <button onClick={() => markRead(n.id)}>Mark Read</button>}
        </div>
      ))}
    </div>
  );
}
```

**Challenge 2:** After splitting, add a loading skeleton and an error state to `NotificationListView` without touching `useNotificationList`. Verify the hook is unchanged.

---

## Common Mistakes

**Mistake 1: Splitting every tiny component**

A `Button` component with one prop doesn't need a container. The split pays off when there's non-trivial stateful logic (data fetching, complex local state, effects). Don't split `<Button label="Click" onClick={fn} />`.

**Mistake 2: Putting derived state in the container**

Filtering and sorting are logic, not UI. They belong in the hook:

```jsx
// Wrong: derived state computed in the container (mixes concerns back)
function Container() {
  const { notifications } = useNotifications();
  const filtered = notifications.filter(n => !n.read); // ← belongs in hook
  return <NotificationListView notifications={filtered} />;
}

// Right: hook returns already-filtered data
function useNotifications(filter) {
  // ... fetch logic ...
  const filtered = useMemo(() => notifications.filter(...), [notifications, filter]);
  return { notifications: filtered, ... };
}
```

**Mistake 3: Leaking smart concerns into dumb components**

If your presentational component imports `fetch`, `useEffect`, or calls an API directly, it's no longer dumb. Presentational components should only import React and UI utilities (CSS, icon libraries, formatters).

**Mistake 4: Naming containers and views identically**

Without clear naming (`UserProfileContainer` / `UserProfileView`, or `useUserProfile` + `UserProfile`), the team can't tell which is which. Be consistent: `*Container` + `*View`, or `use*` hook + `*` component.

**Mistake 5: Forgetting to memo the presentational component**

The whole point of the split is that the view can bail out when data hasn't changed. Without `React.memo`, it rerenders on every container render regardless.

---

## Debugging Tools

### Verify the dumb component is truly stateless

Search the presentational component for: `useState`, `useEffect`, `useReducer`, `fetch`, `axios`. If any are present, logic has leaked into the view.

### Test isolation check

Can you render the presentational component in a test like this?

```jsx
render(<UserProfileView {...staticProps} />);
```

If yes — it's truly dumb. If you need to mock `fetch` or set up context to render it — logic has leaked in.

### Render count logging

```jsx
const UserProfileView = React.memo(function UserProfileView(props) {
  console.count('UserProfileView render');
  // ...
});
```

When the container fetches new data, this counter should only increment if the data actually changed.

---

## Interview Questions

1. What is the container/presentational (smart/dumb) component pattern?
2. What belongs in a smart component vs a dumb component?
3. How does a custom hook modernize the container pattern?
4. What are the testing benefits of dumb components?
5. How does the split affect rerenders?
6. When should you NOT apply the smart/dumb split?
7. What makes a component "truly presentational"?
8. How do you swap data sources using this pattern?
9. What is a "props contract" in the context of presentational components?
10. How does `React.memo` interact with the smart/dumb split?

---

## Interview Answers

**1. Container/presentational pattern?**
A structural pattern where one component (the container/smart) owns all stateful logic — data fetching, effects, state management — and another component (the presentational/dumb) only handles rendering. The container computes what to show; the view handles how to show it.

**2. What belongs where?**
Smart: `useState`, `useEffect`, `useReducer`, API calls, data transformation, event handlers that trigger side effects. Dumb: JSX, conditional rendering, layout, styles, calling callbacks passed as props. The dumb component never imports `fetch` or uses effects.

**3. Custom hook modernizes containers?**
In modern React, the "smart" logic lives in a custom hook (`useUserProfile`). The container becomes a thin wrapper: call the hook, pass its output as props to the view. This makes the logic reusable (multiple containers can use the same hook) and testable in isolation.

**4. Testing benefits of dumb components?**
Presentational components can be tested with static props — no API mocking, no context, no effect setup. A component that renders correctly given valid props is fully tested. The hook logic can be tested separately with `renderHook`. No integration setup needed to test the UI layer.

**5. Effect on rerenders?**
The smart layer (hook/container) rerenders when data changes. The dumb layer rerenders only when its props change. With `React.memo` on the view, if a refetch returns the same data, the view bails out entirely. Decoupling makes bailouts effective.

**6. When not to split?**
Small, single-purpose components (buttons, badges, simple form fields). Components that are used in exactly one place and have simple state (toggle, accordion). When the "logic" is 2 lines — the split creates more files than value. Apply when: the logic is non-trivial, the UI needs to be reusable, or the component needs to work in multiple data contexts (real API, Storybook, tests).

**7. Truly presentational?**
A component is truly presentational if: it takes all data and callbacks as props, imports no data-fetching utilities, has no `useEffect` or `useReducer`, and can be rendered fully with static props in a test. No side effects, no data dependencies beyond its props.

**8. Swapping data sources?**
The container (or hook) is what changes. The view stays the same:
- Production: `useProductSearch` fetches from `/api`
- Storybook: same `ProductListView` with `products={mockProducts}`
- Test: `renderHook(() => useProductSearch(...))` tests the logic independently

**9. Props contract?**
The prop types (TypeScript interface or PropTypes) of a presentational component define a contract: "given this shape of data and these callbacks, I will render correctly." The caller commits to that shape; the component commits to that behavior. Stable contracts enable reuse and independent evolution.

**10. React.memo + smart/dumb split?**
`React.memo` on the dumb component makes the split pay off at runtime. When the container rerenders (e.g., polling refetch), `React.memo` compares old and new props. If the data is unchanged, the view doesn't rerender. Without the split, every rerender was a full component rerender. With it, rerenders are skipped unless something the view actually renders has changed.

---

## Senior-Level Thinking

**The hook IS the container.**

In class component days, containers were `React.Component` classes with lifecycle methods. Hooks collapsed that into a function. Today, `useUserProfile` IS the container — it owns all the logic. The "container component" is often just:

```jsx
function UserProfileContainer({ userId }) {
  return <UserProfileView {...useUserProfile(userId)} />;
}
```

One line of JSX, rest is in the hook. The pattern survives; the class wrapper doesn't.

**Storybook as architecture pressure.**

Teams using Storybook heavily naturally arrive at the smart/dumb split. If you can't write a Story for a component with static props, the component is not truly presentational. Storybook forces good architecture because untestable components can't be documented.

**The "view model" analogy.**

The custom hook returns a "view model" — a data shape optimized for rendering, not for the API's shape. The hook translates between the API's world (raw data, effects, loading states) and the component's world (exactly what it needs to render). This is the same principle as MVVM. The view (dumb component) never knows about the model (API). The hook is the ViewModel.

---

## Revision Notes

- Smart = logic, state, effects, API calls
- Dumb = rendering only, all data from props, no side effects
- Custom hook = modern "smart component" — logic extracted, fully reusable
- Container = thin wrapper: `<View {...useHook()} />`
- `React.memo` on view: bails out when data unchanged (split makes this effective)
- Testing: view → static props; hook → `renderHook`; no integration required
- Don't split small, single-use components — overhead exceeds benefit

---

## Next Day Preview

**Day 27 — Error Boundary**

How to build a class-based `ErrorBoundary` to catch runtime errors in any child subtree. Preventing a crashing child from taking down the entire app. Displaying graceful fallback UI, logging errors, and resetting after recovery.
