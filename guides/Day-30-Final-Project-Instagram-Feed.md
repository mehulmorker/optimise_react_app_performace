# Day 30 — Final Project: Instagram Feed Clone

## Objective

Build a production-quality **Instagram Feed Clone** that applies every technique from all 30 days. This is the capstone: virtualized list, memoized cards, lazy-loaded images, infinite scroll, context-optimized global state, error boundaries, code splitting, and debounced interactions — all working together.

---

## Concepts Applied

- **React.memo** — feed cards don't rerender when unrelated state changes
- **useCallback + useMemo** — stable handlers for memoized children
- **Keys + reconciliation** — stable post keys prevent identity loss during infinite load
- **React.lazy + Suspense** — story viewer and comment panel load on demand
- **Suspense UX** — skeleton screens, no layout shift
- **useDeferredValue + useTransition** — smooth search/navigation
- **Virtualized list** — `react-window` renders only visible feed items
- **useDebounce** — search input rate-limited
- **Context split** — auth and theme in separate contexts, no cascade rerenders
- **State locality** — like/save/comment state lives in the card, not the feed
- **Smart/dumb components** — hooks own logic, card views own rendering
- **Error boundaries** — broken cards don't crash the feed
- **Why Did You Render** — development audit confirms zero wasted renders

---

## Exercise Task

Build in layers. Verify each layer before moving to the next.

---

### Setup — Before you start

**1. Install packages:**

```bash
npm install react-window react-virtualized-auto-sizer
```

**2. Create the folder structure:**

```
src/
  components/
    PostCardView.jsx
    PostCard.jsx
    LazyImage.jsx
    VirtualFeed.jsx
    StoriesBar.jsx
    StoryViewer.jsx      ← lazy-loaded, create minimal version
  contexts/
    AuthContext.jsx
    ThemeContext.jsx
  hooks/
    useFeedPosts.js
    usePostCard.js
```

**3. Define the `useLocalStorage` hook** (used by `ThemeProvider`). Create `src/hooks/useLocalStorage.js`:

```js
import { useState } from 'react';

export function useLocalStorage(key, initialValue) {
  const [stored, setStored] = useState(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch {
      return initialValue;
    }
  });

  const setValue = (value) => {
    const valueToStore = typeof value === 'function' ? value(stored) : value;
    setStored(valueToStore);
    try { window.localStorage.setItem(key, JSON.stringify(valueToStore)); } catch {}
  };

  return [stored, setValue];
}
```

**4. Add the mock data and API** (no backend needed). Create `src/data/mockFeed.js`:

```js
// 50 mock posts — replace Layer 2's real fetch with this
export const MOCK_POSTS = Array.from({ length: 50 }, (_, i) => ({
  id: `post_${i}`,
  author: {
    id: `user_${i % 8}`,
    username: `user${i % 8}`,
    avatar: `https://i.pravatar.cc/40?u=user${i % 8}`,
  },
  imageUrl: `https://picsum.photos/seed/post${i}/400/400`,
  caption: `Caption for post ${i + 1}. Check out this awesome photo! #react #coding`,
  likeCount: Math.floor(Math.random() * 500) + 10,
  likedByCurrentUser: false,
  savedByCurrentUser: false,
}));

// Simulates GET /api/feed?page=N&limit=10
export function mockFetchFeed(page, limit = 10) {
  return new Promise(resolve => {
    setTimeout(() => {
      const start = (page - 1) * limit;
      const posts = MOCK_POSTS.slice(start, start + limit);
      resolve({ posts, hasMore: start + limit < MOCK_POSTS.length });
    }, 600);
  });
}
```

**5. Define placeholder components** — create these stub files now. You'll build them properly as you reach each layer.

```jsx
// src/components/StoryViewer.jsx — create this NOW (it's lazy-loaded, must exist)
export default function StoryViewer({ story, onClose }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ color: 'white', textAlign: 'center' }}>
        <p>Story by @{story.username}</p>
        <button onClick={onClose} style={{ background: 'white', color: 'black', padding: '8px 16px', borderRadius: 4, border: 'none', cursor: 'pointer' }}>Close</button>
      </div>
    </div>
  );
}
```

**6. Define shared stub components** — add these to `src/components/shared.jsx` (or inline where used):

```jsx
// src/components/shared.jsx
export function Spinner() {
  return <div style={{ padding: 16, textAlign: 'center', color: '#888' }}>Loading...</div>;
}

export function BrokenCardPlaceholder() {
  return <div style={{ padding: 16, background: '#fff3cd', textAlign: 'center' }}>This post failed to load.</div>;
}

export function PostImageSkeleton() {
  return <div style={{ width: '100%', aspectRatio: '1/1', background: '#f0f0f0' }} />;
}

export function StoryViewerSkeleton() {
  return <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Spinner /></div>;
}

export function TopBar() {
  return <header style={{ padding: '8px 16px', borderBottom: '1px solid #eee', fontWeight: 'bold' }}>Instagram</header>;
}

export function ErrorState({ message }) {
  return <div style={{ padding: 16, color: '#c00' }}>Error: {message}</div>;
}
```

**7. Define `STORY_USERS`** — the stories bar needs this data. Add to `src/data/mockFeed.js`:

```js
export const STORY_USERS = Array.from({ length: 8 }, (_, i) => ({
  id: `user_${i}`,
  username: `user${i}`,
  avatar: `https://i.pravatar.cc/56?u=user${i}`,
}));
```

**8. Define `StoryAvatar`** — add to `src/components/shared.jsx`:

```jsx
export function StoryAvatar({ user, onClick, onMouseEnter }) {
  return (
    <button
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}
    >
      <img
        src={user.avatar}
        alt={user.username}
        style={{ width: 56, height: 56, borderRadius: '50%', border: '2px solid #e1306c' }}
      />
      <span style={{ fontSize: 11 }}>{user.username}</span>
    </button>
  );
}
```

**9. Define `ErrorBoundary`** — add to `src/components/ErrorBoundary.jsx` (the class from Day 27):

```jsx
import React from 'react';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(error, info) { console.error('ErrorBoundary:', error, info.componentStack); }
  render() {
    if (this.state.hasError) return this.props.fallback ?? <div>Something went wrong.</div>;
    return this.props.children;
  }
}
```

---

### Layer 1: Context architecture

```jsx
// contexts/AuthContext.jsx
const AuthStateContext = createContext(null);
const AuthActionsContext = createContext(null);

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState({
    id: 'user_1',
    username: 'you',
    avatar: 'https://i.pravatar.cc/40?u=you',
  });

  const actions = useMemo(() => ({
    updateProfile: (updates) => setCurrentUser(u => ({ ...u, ...updates })),
  }), []);

  return (
    <AuthStateContext.Provider value={currentUser}>
      <AuthActionsContext.Provider value={actions}>
        {children}
      </AuthActionsContext.Provider>
    </AuthStateContext.Provider>
  );
}

export const useCurrentUser = () => useContext(AuthStateContext);
export const useAuthActions = () => useContext(AuthActionsContext);

// contexts/ThemeContext.jsx
import { useLocalStorage } from '../hooks/useLocalStorage';

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useLocalStorage('ig-theme', 'light');
  const value = useMemo(() => ({
    theme,
    toggleTheme: () => setTheme(t => t === 'light' ? 'dark' : 'light'),
  }), [theme, setTheme]);

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
```

### Layer 2: Data hook with infinite scroll

```jsx
// hooks/useFeedPosts.js
import { useState, useEffect, useCallback } from 'react';
import { mockFetchFeed } from '../data/mockFeed';

export function useFeedPosts() {
  const [posts, setPosts] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchPage = useCallback(async (pageNum) => {
    setLoading(true);
    try {
      const data = await mockFetchFeed(pageNum);
      setPosts(prev => pageNum === 1 ? data.posts : [...prev, ...data.posts]);
      setHasMore(data.hasMore);
      setPage(pageNum);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchPage(1); }, [fetchPage]);

  const loadMore = useCallback(() => {
    if (!loading && hasMore) fetchPage(page + 1);
  }, [loading, hasMore, page, fetchPage]);

  const refresh = useCallback(() => fetchPage(1), [fetchPage]);

  return { posts, loading, error, hasMore, loadMore, refresh };
}
```

> In a real app, replace `mockFetchFeed` with `fetch('/api/feed?page=N')`. The `AbortController` pattern from Day 21 should be added for production use to cancel stale requests.
```

### Layer 3: Card logic hook (smart layer)

```jsx
// hooks/usePostCard.js
import { useState, useCallback } from 'react';
import { useCurrentUser } from '../contexts/AuthContext';

// Mock API helpers — replace with real fetch in production
const mockLike = (postId, liked) => new Promise(r => setTimeout(r, 200));
const mockSave = (postId, saved) => new Promise(r => setTimeout(r, 200));
const mockComment = (postId, text) => new Promise(r => setTimeout(r, 300));

export function usePostCard(post) {
  const currentUser = useCurrentUser();
  const [liked, setLiked] = useState(post.likedByCurrentUser ?? false);
  const [likeCount, setLikeCount] = useState(post.likeCount ?? 0);
  const [saved, setSaved] = useState(post.savedByCurrentUser ?? false);
  const [commentText, setCommentText] = useState('');

  const toggleLike = useCallback(async () => {
    const newLiked = !liked;
    setLiked(newLiked);
    setLikeCount(c => newLiked ? c + 1 : c - 1);
    await mockLike(post.id, newLiked).catch(() => {
      // Revert on failure (optimistic update pattern)
      setLiked(!newLiked);
      setLikeCount(c => newLiked ? c - 1 : c + 1);
    });
  }, [liked, post.id]);

  const toggleSave = useCallback(async () => {
    const newSaved = !saved;
    setSaved(newSaved);
    await mockSave(post.id, newSaved).catch(() => setSaved(!newSaved));
  }, [saved, post.id]);

  const submitComment = useCallback(async () => {
    if (!commentText.trim()) return;
    const text = commentText;
    setCommentText('');
    await mockComment(post.id, text);
  }, [commentText, post.id]);

  return {
    liked, likeCount, saved, commentText,
    toggleLike, toggleSave, submitComment,
    onCommentChange: setCommentText,
  };
}
```

> `currentUser` is imported but not used in the mock version. In production you'd pass `currentUser.id` in the comment payload to the real API.
```

### Layer 4: Dumb card view

```jsx
// PostCardView.jsx — pure rendering, all data from props
const PostCardView = React.memo(function PostCardView({
  post,
  liked, likeCount, saved, commentText,
  onLike, onSave, onComment, onCommentChange,
}) {
  return (
    <article style={{ borderBottom: '1px solid #eee', paddingBottom: 16, marginBottom: 16 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', padding: '8px 0' }}>
        <LazyImage
          src={post.author.avatar}
          alt={post.author.username}
          style={{ width: 36, height: 36, borderRadius: '50%', marginRight: 10 }}
        />
        <strong>{post.author.username}</strong>
      </div>

      {/* Image */}
      <LazyImage
        src={post.imageUrl}
        alt={post.caption}
        style={{ width: '100%', aspectRatio: '1/1', objectFit: 'cover' }}
        placeholder={<PostImageSkeleton />}
      />

      {/* Actions */}
      <div style={{ display: 'flex', gap: 12, padding: '8px 0' }}>
        <button onClick={onLike} aria-label={liked ? 'Unlike' : 'Like'}>
          {liked ? '❤️' : '🤍'} {likeCount}
        </button>
        <button onClick={onSave} aria-label={saved ? 'Unsave' : 'Save'}>
          {saved ? '🔖' : '📄'}
        </button>
      </div>

      {/* Caption */}
      <p><strong>{post.author.username}</strong> {post.caption}</p>

      {/* Comment input */}
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          value={commentText}
          onChange={e => onCommentChange(e.target.value)}
          placeholder="Add a comment..."
          style={{ flex: 1 }}
        />
        <button onClick={onComment} disabled={!commentText.trim()}>Post</button>
      </div>
    </article>
  );
});
```

### Layer 5: Smart card container

```jsx
// PostCard.jsx — wires hook to view
function PostCard({ post }) {
  const cardProps = usePostCard(post);
  return (
    <ErrorBoundary fallback={<BrokenCardPlaceholder />}>
      <PostCardView
        post={post}
        liked={cardProps.liked}
        likeCount={cardProps.likeCount}
        saved={cardProps.saved}
        commentText={cardProps.commentText}
        onLike={cardProps.toggleLike}
        onSave={cardProps.toggleSave}
        onComment={cardProps.submitComment}
        onCommentChange={cardProps.onCommentChange}
      />
    </ErrorBoundary>
  );
}
```

### Layer 6: Lazy image with skeleton fallback

```jsx
// LazyImage.jsx — uses IntersectionObserver for true lazy loading
function LazyImage({ src, alt, style, placeholder }) {
  const [loaded, setLoaded] = useState(false);
  const [inView, setInView] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setInView(true); observer.disconnect(); } },
      { rootMargin: '200px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} style={style}>
      {!loaded && (placeholder ?? <div style={{ ...style, background: '#f0f0f0' }} />)}
      {inView && (
        <img
          src={src}
          alt={alt}
          style={{ ...style, display: loaded ? 'block' : 'none' }}
          onLoad={() => setLoaded(true)}
        />
      )}
    </div>
  );
}
```

`rootMargin: '200px'` — images start loading 200px before they enter the viewport. Users see images as they scroll, never a loading flash.

### Layer 7: Virtualized feed with infinite scroll

```jsx
import { VariableSizeList } from 'react-window';
import AutoSizer from 'react-virtualized-auto-sizer';

const CARD_HEIGHT = 520; // approximate — use VariableSizeList for varying heights
const LOADING_ROW_HEIGHT = 60;

function VirtualFeed({ posts, hasMore, loading, onLoadMore }) {
  const listRef = useRef(null);

  const itemCount = posts.length + (hasMore ? 1 : 0);

  const getItemSize = useCallback((index) => {
    if (index >= posts.length) return LOADING_ROW_HEIGHT;
    return CARD_HEIGHT;
  }, [posts.length]);

  const handleItemsRendered = useCallback(({ visibleStopIndex }) => {
    if (visibleStopIndex >= posts.length - 3 && hasMore && !loading) {
      onLoadMore();
    }
  }, [posts.length, hasMore, loading, onLoadMore]);

  const itemData = useMemo(() => ({ posts, hasMore, loading }), [posts, hasMore, loading]);

  return (
    <AutoSizer>
      {({ height, width }) => (
        <VariableSizeList
          ref={listRef}
          height={height}
          width={width}
          itemCount={itemCount}
          itemSize={getItemSize}
          itemData={itemData}
          onItemsRendered={handleItemsRendered}
          overscanCount={2}
        >
          {FeedRow}
        </VariableSizeList>
      )}
    </AutoSizer>
  );
}

const FeedRow = React.memo(function FeedRow({ index, style, data }) {
  const { posts, hasMore, loading } = data;
  if (index >= posts.length) {
    return (
      <div style={{ ...style, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {loading ? <Spinner /> : hasMore ? null : <p>You're all caught up!</p>}
      </div>
    );
  }
  return (
    <div style={style}>
      <PostCard post={posts[index]} />
    </div>
  );
});
```

### Layer 8: Lazy-loaded story viewer

```jsx
// Story viewer only loads when user clicks stories bar
const StoryViewer = lazy(() => import('./StoryViewer'));

function StoriesBar() {
  const [activeStory, setActiveStory] = useState(null);
  const [isPending, startTransition] = useTransition();

  const openStory = useCallback((story) => {
    startTransition(() => setActiveStory(story));
  }, []);

  return (
    <>
      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', padding: 8 }}>
        {STORY_USERS.map(user => (
          <StoryAvatar
            key={user.id}
            user={user}
            onClick={() => openStory(user)}
            onMouseEnter={() => import('./StoryViewer')} // preload on hover
          />
        ))}
      </div>

      {activeStory && (
        <ErrorBoundary fallback={<p>Story failed to load.</p>}>
          <Suspense fallback={<StoryViewerSkeleton />}>
            <StoryViewer story={activeStory} onClose={() => setActiveStory(null)} />
          </Suspense>
        </ErrorBoundary>
      )}
    </>
  );
}
```

### Layer 9: App shell

```jsx
function App() {
  return (
    <AuthProvider>
      <ThemeProvider>
        <div style={{ maxWidth: 468, margin: '0 auto', height: '100vh', display: 'flex', flexDirection: 'column' }}>
          <TopBar />
          <StoriesBar />
          <FeedContainer />
        </div>
      </ThemeProvider>
    </AuthProvider>
  );
}

function FeedContainer() {
  const { posts, loading, error, hasMore, loadMore } = useFeedPosts();

  if (error) return <ErrorState message={error} />;

  return (
    <div style={{ flex: 1, overflow: 'hidden' }}>
      <VirtualFeed
        posts={posts}
        hasMore={hasMore}
        loading={loading}
        onLoadMore={loadMore}
      />
    </div>
  );
}
```

---

## Architecture Map

```
App
├── AuthProvider (user state + actions — split)
│   └── ThemeProvider (theme — separate context)
│       ├── TopBar
│       ├── StoriesBar
│       │   └── Suspense → StoryViewer (lazy, only on click)
│       └── FeedContainer
│           └── useFeedPosts() → VirtualFeed
│               └── FeedRow × visible-window (React.memo)
│                   └── PostCard
│                       ├── usePostCard() — like/save/comment logic
│                       ├── ErrorBoundary — broken card is isolated
│                       └── PostCardView (React.memo — pure rendering)
│                           └── LazyImage × 2 (IntersectionObserver)
```

---

## What To Observe

| Action | Expected behavior |
|--------|-------------------|
| Initial load | First 10 posts render, skeletons for images loading |
| Scroll down | Images load as they approach viewport (200px ahead) |
| Near bottom | Next 10 posts load, appended to virtual list |
| Scroll through 200 posts | DOM node count stays constant (virtualization) |
| Like a post | Only that PostCardView rerenders — no other cards affected |
| Toggle theme | Only theme consumers rerender — feed cards unaffected |
| Click stories | StoryViewer chunk downloads, old UI stays (startTransition) |
| Hover story avatar | Chunk preloads before click |
| Broken card data | That card shows placeholder — feed continues scrolling |
| WDYR (dev mode) | Zero logs after full optimization |

---

## Debugging Checklist

- [ ] Scroll 200 items: check Memory tab → DOM node count is constant
- [ ] Like post: React DevTools Profiler → only that card's PostCardView renders
- [ ] Toggle theme: Profiler → no feed card renders
- [ ] WDYR enabled: zero console logs during all interactions above
- [ ] Network tab: lazy story chunk downloads only on first click
- [ ] Image loading: images appear just before scrolling to them (not on scroll)
- [ ] Stale request: rapid page scrolls create no duplicate API calls (AbortController)

---

## Common Mistakes in This Project

**Mistake 1:** Defining `getItemSize` or `itemData` inline in `VirtualFeed` render — recreated every render, breaks `FeedRow.memo` and forces `VariableSizeList` to remeasure every item.

**Mistake 2:** Storing like/save state in the feed list — liking one post rerenders all 10 visible cards. State locality: each card owns its interaction state.

**Mistake 3:** Passing `currentUser` as a prop down to `PostCard` instead of using `useCurrentUser` inside `usePostCard` — forces all cards to rerender when the user profile updates.

**Mistake 4:** No `ErrorBoundary` around `PostCard` — one post with malformed data (null `author`) throws and unmounts the entire feed.

**Mistake 5:** Using `FixedSizeList` for feed cards — Instagram-style posts have variable heights (long captions, multiple comments). `VariableSizeList` handles this; `FixedSizeList` would misalign scroll positions.

**Mistake 6:** Loading all stories eagerly — the story viewer is heavy (video player, progress bar, gesture handling). Lazy-load it and only on click.

---

## Interview Questions

1. Why does state locality matter so much in an infinite scroll feed?
2. How does `react-window` keep memory constant as you scroll through 500 posts?
3. Why does `itemData` need to be memoized in the virtual list?
4. How does `LazyImage` with `IntersectionObserver` differ from the native `loading="lazy"` attribute?
5. How does the smart/dumb split in `PostCard` make the like button testable?
6. What happens if a single post has corrupt data? How is it handled?
7. Why is the story viewer lazy-loaded and not just conditionally rendered?
8. How does the split context architecture prevent feed rerenders when the theme changes?
9. What role does `startTransition` play in opening the story viewer?
10. If you needed to add real-time like counts (WebSocket), where would that state live?

---

## Interview Answers

**1. State locality in a feed?**
A feed of 100 posts. If like state lives at the feed level, liking post #42 triggers a state update in `FeedContainer`, which rerenders the virtual list, which re-evaluates all visible `FeedRow` components. With `React.memo` and stable `itemData`, most bail out — but React still does work. With state locality, the like state lives in `PostCard` — only that one card rerenders. Zero overhead to the rest of the feed.

**2. react-window and constant memory?**
`react-window` only renders the DOM nodes for the currently visible items (plus a small overscan). As you scroll down, it unmounts items scrolled past (beyond overscan) and mounts new items coming into view. At any scroll position, the DOM contains ~10-15 items regardless of total list size. 500 items in state, 15 in the DOM.

**3. Why memoize itemData?**
`FeedRow` is wrapped in `React.memo`. Its `data` prop is `itemData`. If `itemData` is a new object on every `VirtualFeed` render, the shallow comparison fails — every visible row rerenders on every feed state change (e.g., loading state toggling). Memoized `itemData` keeps the reference stable; rows only rerender when `posts`, `hasMore`, or `loading` actually changes.

**4. IntersectionObserver vs loading="lazy"?**
`loading="lazy"` is a browser hint — support varies, behavior is browser-defined, and you can't control the rootMargin or respond to load events reliably. `IntersectionObserver` gives full control: trigger at 200px before viewport entry, start showing a skeleton, swap in the real image when loaded, disconnect after load. More consistent behavior, better DX.

**5. Like button testability?**
`usePostCard` is a hook — testable with `renderHook`. Assert that `toggleLike` sets `liked: true`, increments `likeCount`, and calls the correct API endpoint. No DOM, no mounting, no image rendering required. `PostCardView` is a pure function of props — test the UI separately with static props. The seam between them is the clear interface `usePostCard` returns.

**6. Corrupt post data?**
`PostCard` is wrapped in `ErrorBoundary`. If `post.author` is null and `PostCardView` throws during render, the error boundary catches it and shows `<BrokenCardPlaceholder />` for that one card. The virtual list continues rendering. Other cards are unaffected. Without the boundary: one bad post unmounts the entire `VirtualFeed`.

**7. Why lazy-load the story viewer?**
The story viewer likely includes a video player, gesture handling, progress animation, and preloading logic — possibly 200KB+ of JavaScript. Most users never open stories in a given session. Lazy-loading delays that cost until it's needed. The chunk is also cached after first open, so subsequent opens are instant.

**8. Theme split context + feed cards?**
`PostCardView` subscribes to neither `AuthStateContext` nor `ThemeContext` — it only uses props. `usePostCard` subscribes to `AuthStateContext` (for `currentUser.id`). Toggling theme changes `ThemeContext` — `ThemeProvider` rerenders, but `PostCard` and `PostCardView` are not subscribers. Only components that call `useTheme()` rerender.

**9. startTransition + story viewer?**
Without transition: setting `activeStory` immediately causes Suspense to suspend, hiding the stories bar while the chunk downloads. With `startTransition`: the stories bar stays visible (with `isPending` state), the new story viewer renders in the background. When the chunk and first render complete, the viewer appears atomically. No layout disruption.

**10. Real-time like counts?**
A WebSocket `useLivePostUpdates(postId)` hook inside each `PostCard`, subscribed to events for that specific post. The like count updates only inside that card's local state — no global store needed. State locality: the live count lives in the card, not the feed. If you needed aggregated counts (e.g., a "trending" sidebar), a shared store would be appropriate for that specific feature.

---

## Senior-Level Thinking

**The 30-day mental model applied.**

Every performance decision in this app has a 1-line rationale from the bootcamp:
- `React.memo` on `FeedRow`: a row shouldn't rerender because loading state changed
- State locality for likes: liking post #42 is not post #1's concern
- Split contexts: theme change is not the feed's concern
- Virtualization: 500 DOM nodes is not acceptable when 15 do the same job
- Lazy story viewer: don't download what you don't need yet
- Error boundary per card: one bad post is not 99 posts' concern

Each decision is the same principle: **scope the work to what changed**.

**The architecture checklist.**

For any new React feature, ask in order:
1. Where does this state live? (locality)
2. Who needs to know when it changes? (blast radius)
3. How expensive is the change to render? (complexity)
4. Is the code reachable at startup or only on interaction? (lazy loading)
5. What fails gracefully vs crashes everything? (error boundaries)
6. Have I profiled it? (Profiler + WDYR)

This checklist is the distillation of 30 days of React optimization thinking.

---

## Course Complete

**30 days. Four weeks. One architecture.**

**Week 1 — Rendering Core:** Parent-child rerenders, React.memo, useCallback, useMemo, keys, controlled inputs  
**Week 2 — State & Effects:** setState batching, React 18 batching, infinite loops, stale closures, useRef, cleanup  
**Week 3 — Performance:** Expensive filtering, useDeferredValue, useTransition, virtualization, debounce, throttle  
**Week 4 — Advanced React:** Context rerenders, lazy loading, Suspense UX, state locality, smart/dumb, error boundaries, Profiler, WDYR

The three-layer optimization hierarchy:
1. **Architecture first** — state locality, context split, composition (prevents the problem)
2. **Performance second** — deferred values, virtualization, debounce (handles the scale)
3. **Memoization last** — React.memo, useCallback, useMemo (patches what slips through)

Every component in this Instagram clone uses the right tool for the right reason. That's the standard.
