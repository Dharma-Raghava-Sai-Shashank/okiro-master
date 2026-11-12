---
topic: STL and C++ Tricks for Competitive Programming
tags: [implementation, data structures, sortings, hashing, bitmasks, greedy]
---
# STL and C++ Tricks for Competitive Programming

## Recognize it
When the STL/C++ details decide AC versus TLE/WA on Codeforces:
- Input of 10^6 numbers or more, or 2·10^5 lines of queries → fast IO is mandatory; `endl` on every line can cost seconds.
- "Maintain a dynamic collection: insert, delete one copy, get min/max, find the smallest element ≥ x" → `multiset` / `set` with member `lower_bound`, O(log n) each.
- "Repeatedly take the two largest/smallest", "process events by time", greedy with "undo the worst choice so far" → `priority_queue` (max-heap by default, min-heap with `greater<>`).
- Counting frequencies of values up to 10^9 or 10^18 → `map` (safe) or `unordered_map` with a randomized custom hash (fast, hack-resistant).
- "Number of elements smaller than x in a dynamic set", "k-th smallest with insertions and deletions" → `__gnu_pbds` ordered_set (GCC only) or Fenwick + coordinate compression (portable).
- Subset-sum / reachability / set intersection with n around 10^4–10^5 where O(n²) is too slow by a factor of ~50 → `bitset` gives O(n²/64).
- Answers beyond 9.2·10^18 (products of two long longs) → `__int128` with a custom print.
- Randomized algorithms, shuffling against anti-quicksort or anti-hash tests → `mt19937` seeded by time, never `rand()`.

## Core idea
Know the cost model of each container. `vector`: contiguous, O(1) index, amortized O(1) push_back, fastest by far. `set/multiset/map`: red-black tree, O(log n) with a large constant (pointer chasing, ~10x slower than a sorted vector). `unordered_map`: O(1) average, but default hashing of integers is the identity modulo a prime bucket count, so adversarial inputs (hacks on Codeforces) put everything in one bucket → O(n) per operation. `priority_queue`: binary heap on a vector, O(log n), cheap. `deque`: O(1) both ends, slower than vector. `bitset<N>`: N must be a compile-time constant; word-parallel operations process 64 bits at once.

Prefer offline sorting + vector + binary search over a `set` when all data is known upfront; prefer arrays indexed by compressed values over `map` when the key space is small. Reach for trees (`set`, `map`) only when the collection truly changes online.

On Codeforces the compiler is GCC (G++17/G++20/G++23, MinGW on Windows), so `bits/stdc++.h`, `__int128`, `__builtin_popcountll`, `__lg` and `__gnu_pbds` are available. `RAND_MAX` there is 32767, another reason to avoid `rand()`. Locally on macOS, `g++` is usually Apple clang with libc++: `bits/stdc++.h` and `__gnu_pbds` are missing (install real GCC via Homebrew, e.g. `g++-14`, or create a local `bits/stdc++.h` that includes the standard headers).

## C++ template: contest skeleton, fast IO, random, int128 printing
```cpp
#include <bits/stdc++.h>
using namespace std;
using ll = long long;

mt19937_64 rng(chrono::steady_clock::now().time_since_epoch().count());
ll rnd(ll l, ll r) { return uniform_int_distribution<ll>(l, r)(rng); }   // inclusive

void print128(__int128 x) {                 // cout has no operator<< for __int128
    if (x == 0) { cout << 0; return; }
    if (x < 0) { cout << '-'; x = -x; }
    string s;
    while (x > 0) { s += char('0' + x % 10); x /= 10; }
    reverse(s.begin(), s.end());
    cout << s;
}

void solve() {
    int n; cin >> n;
    vector<ll> a(n);
    for (auto& x : a) cin >> x;
    cout << accumulate(a.begin(), a.end(), 0LL) << '\n';    // 0LL, not 0
}

int main() {
    ios::sync_with_stdio(false);
    cin.tie(nullptr);
    int t = 1;
    cin >> t;
    while (t--) solve();
}
```
Fast IO rules: `sync_with_stdio(false)` decouples iostream from stdio, so never mix `scanf/printf` with `cin/cout` afterwards. `cin.tie(nullptr)` stops flushing cout before every read. Print `'\n'`, not `endl` (endl flushes). Exception: **interactive problems** must flush after every query (`cout << ... << endl;` or `cout.flush()`). Reading `__int128`: read as a string and convert. Shuffling input before sorting or hashing: `shuffle(a.begin(), a.end(), rng);`.

## C++ template: set, multiset, map, priority_queue idioms
```cpp
multiset<int> ms = {5, 1, 5, 3};
ms.erase(ms.find(5));                       // erases ONE copy; ms.erase(5) erases ALL copies
// Guard: auto it = ms.find(x); if (it != ms.end()) ms.erase(it);
int mn = *ms.begin(), mx = *ms.rbegin();    // check !ms.empty() first

set<int> s = {1, 4, 9};
auto it = s.lower_bound(5);                 // member function: O(log n) -> 9
// std::lower_bound(s.begin(), s.end(), 5) is O(n): set iterators are not random access.
auto le = s.upper_bound(5);                 // largest element <= 5:
if (le != s.begin()) { --le; /* *le == 4 */ }

map<ll, int> cnt;
cnt[7]++;                                   // operator[] inserts a default 0 if missing
if (cnt.count(8)) { /* ... */ }             // query without inserting (cnt[8] would insert)
for (auto& [key, c] : cnt) { /* sorted by key */ }

priority_queue<int> maxHeap;                                         // top() is the largest
priority_queue<int, vector<int>, greater<int>> minHeap;              // top() is the smallest
priority_queue<pair<ll, int>, vector<pair<ll, int>>, greater<>> pq;  // Dijkstra style (dist, v)
auto cmp = [](const pair<int, int>& a, const pair<int, int>& b) { return a.second > b.second; };
priority_queue<pair<int, int>, vector<pair<int, int>>, decltype(cmp)> byKey(cmp);  // min by .second
```
Heap comparator semantics: comparator(a, b) == true means a has **lower** priority (a goes below b), so `greater` gives a min-heap. Lazy deletion: priority_queue cannot erase arbitrary elements; keep a second heap (or a counter map) of "deleted" values and pop them when they reach the top. Greedy "keep the best k so far, drop the worst when infeasible": push each chosen item into a min-heap and pop the smallest when the constraint breaks (1526C2 Potions: take every potion, and while health < 0 drop the most negative taken). "Repeatedly pair the two largest" (1579D Productive Meeting): max-heap of (value, id), pop two, decrement, push back if positive. Multiset greedy simulation: "take the max, its partner must be x − max, remove both" (1474C Array Destruction) with `find` + erase one copy.

## C++ template: hack-resistant unordered_map (splitmix64)
```cpp
struct SplitMixHash {
    static unsigned long long mix(unsigned long long x) {
        x += 0x9e3779b97f4a7c15ULL;
        x = (x ^ (x >> 30)) * 0xbf58476d1ce4e5b9ULL;
        x = (x ^ (x >> 27)) * 0x94d049bb133111ebULL;
        return x ^ (x >> 31);
    }
    size_t operator()(unsigned long long x) const {
        static const unsigned long long SEED = chrono::steady_clock::now().time_since_epoch().count();
        return mix(x + SEED);
    }
};
unordered_map<ll, int, SplitMixHash> freq;   // keys convert to unsigned long long
// freq.reserve(1 << 20); freq.max_load_factor(0.25);   // fewer rehashes, fewer collisions
// Pairs as keys: hash p.first * some_odd_constant ^ p.second, or encode as one 64-bit number.
```
map vs unordered_map: `map` is O(log n) worst case, ordered, iterable in sorted order, never hacked; often fast enough for 2·10^5 operations. `unordered_map` with default hash is a standard hacking target in open-hack rounds and Educational rounds (TLE after the contest). With the randomized splitmix64 hash it is safe and roughly 2–5x faster than `map`. Fastest option when values are small or can be compressed: a plain array or `vector<int>` indexed by the compressed value. Same hash works for `unordered_set` and `gp_hash_table` (pbds hash table, usually even faster).

Counting pairs with a map: "pairs i < j with a_j − j == a_i − i" (1520D Same Differences): before inserting key k_j, add cnt[k_j] to the answer, then increment.

## C++ template: ordered_set (pbds) and the portable Fenwick workaround
```cpp
// GCC / libstdc++ only (works on Codeforces). NOT available with Apple clang / libc++.
#include <ext/pb_ds/assoc_container.hpp>
#include <ext/pb_ds/tree_policy.hpp>
using namespace __gnu_pbds;
template <class T>
using ordered_set = tree<T, null_type, less<T>, rb_tree_tag, tree_order_statistics_node_update>;

// ordered_set<int> os; os.insert(x); os.erase(x);
// os.order_of_key(x)    -> number of elements strictly less than x
// *os.find_by_order(k)  -> k-th smallest, 0-indexed (os.end() if k >= size)
// Multiset version: store pair<value, uniqueId> and query order_of_key({x, -1}).
```
Portable replacement (works everywhere, faster): compress all values that will ever be inserted or queried, then a Fenwick tree of counts.
```cpp
// vals = sorted unique list of all values; idx(x) = lower_bound(vals, x) - vals.begin().
struct OrderStat {
    int n; vector<int> t; int total = 0;
    explicit OrderStat(int n) : n(n), t(n + 1, 0) {}
    void add(int i, int d) { total += d; for (i++; i <= n; i += i & -i) t[i] += d; }  // insert/erase index i
    int countLess(int i) { int s = 0; for (; i > 0; i -= i & -i) s += t[i]; return s; }  // # of indices < i
    int kth(int k) {                                   // 0-indexed k-th smallest index, k < total
        int pos = 0;
        for (int pw = 1 << __lg(max(n, 1)); pw; pw >>= 1)
            if (pos + pw <= n && t[pos + pw] <= k) { pos += pw; k -= t[pos]; }
        return pos;
    }
};
```
`countLess(i)` sums 1-based positions 1..i, which are 0-based indices 0..i−1, i.e. elements strictly less than index i; `kth` returns the 0-based index whose value is `vals[pos]`. This needs offline knowledge of all values (read all queries first). Typical use: count pairs i < j with a_i ≥ a_j in a stream (1676H2 Maximum Crossings: for each j add the number of earlier wire ends ≥ a_j).

## Lambdas, recursive lambdas, numeric algorithms, comparators
```cpp
vector<vector<int>> g(n);
vector<int> sz(n, 1);
// Recursive lambda (C++14+): pass itself as the first argument.
auto dfs = [&](auto&& self, int v, int p) -> void {
    for (int u : g[v]) if (u != p) { self(self, u, v); sz[v] += sz[u]; }
};
dfs(dfs, 0, -1);
// function<void(int, int)> also works but is slower (type-erased call, no inlining).
// C++23 (GCC 14 on Codeforces): auto dfs = [&](this auto&& self, int v, int p) -> void {...}; dfs(0, -1);

vector<int> id(n);
iota(id.begin(), id.end(), 0);                                   // 0, 1, ..., n-1
vector<ll> pre(n);
partial_sum(a.begin(), a.end(), pre.begin());                    // inclusive prefix sums
ll total = accumulate(a.begin(), a.end(), 0LL);
sort(id.begin(), id.end(), [&](int i, int j) {                   // sort indices by a, ties by index
    if (a[i] != a[j]) return a[i] < a[j];
    return i < j;
});
sort(v.begin(), v.end(), [](const auto& x, const auto& y) {      // multi-key with tie
    return tie(x.first, y.second) < tie(y.first, x.second);      // first asc, second desc
});
v.erase(unique(v.begin(), v.end()), v.end());                    // dedupe after sort
```
Comparators must be a **strict weak ordering**: irreflexive (`cmp(x, x)` is false), transitive, and with transitive "equivalence". Using `<=` breaks irreflexivity: `std::sort` may read out of bounds and crash (RE) or return garbage. In `set`/`map` with a custom comparator, two elements with `!cmp(a, b) && !cmp(b, a)` are considered **the same key**: a `set` ordered by string length silently keeps only one string per length. Add a tie-breaker to keep distinct elements. Floating comparisons of fractions → compare a·d < c·b with integers (signs of denominators positive).

Other handy calls: `max_element`, `min_element`, `count`, `find`, `reverse`, `rotate`, `next_permutation` (iterate all permutations of a sorted vector), `nth_element` (O(n) k-th), `__builtin_popcountll`, `__builtin_ctzll`, `__lg(x)` (floor log2), `gcd`/`lcm` (C++17), `clamp`.

## C++ template: bitset for O(n²/64)
```cpp
const int MAXS = 100001;                       // bitset size must be a compile-time constant
// Subset sum: which totals in [0, MAXS) are reachable using each item at most once.
bitset<MAXS> reachableSums(const vector<int>& w) {
    bitset<MAXS> dp;
    dp[0] = 1;
    for (int x : w) dp |= dp << x;             // O(MAXS / 64) per item
    return dp;
}
// Common neighbours / triangles: adj[i] as bitset<N>; (adj[u] & adj[v]).count() in O(N / 64).
// Transitive closure of a DAG: process vertices in reverse topological order, reach[v] |= reach[u].
```
n = 2·10^4 items with sums up to 10^5 → 2·10^9 / 64 ≈ 3·10^7 word ops, fast. For a runtime size, pick the template size from a few constants (or use `vector<unsigned long long>` manually). Iteration over set bits: `_Find_first()` and `_Find_next(i)` are libstdc++ extensions (fine on Codeforces). Bounded multiplicity knapsack: split counts into powers of two first. `dp.count()`, `dp.any()`, `dp.test(i)` are standard.

## Pitfalls
- `ms.erase(value)` on a multiset removes every copy; erase via an iterator from `find`.
- `std::lower_bound` on `set/map` is O(n); call the member `s.lower_bound(x)`.
- `*s.begin()` / `*s.rbegin()` / `pq.top()` on an empty container is undefined behaviour (often silent garbage).
- Erasing from a set while iterating: use `it = s.erase(it)`.
- `map[key]` in a read-only check inserts keys and can blow memory/time; use `count` or `find`.
- `accumulate(..., 0)` sums in int; `0LL` for long long. Same for `1 << 40` (needs `1LL << 40`).
- `a.size() - 1` is unsigned: `for (int i = 0; i < a.size() - 1; i++)` on an empty vector loops ~2^64 times; cast to int.
- `priority_queue` default is max-heap; Dijkstra with the default heap without negating distances pops the farthest vertex.
- Comparator with `<=` or inconsistent ties → crash in `sort`; set with a comparator on one field merges distinct elements.
- `unordered_map` with default hash in a hackable round → TLE after hacks; default hash for pair does not exist (compile error).
- `bitset` size must be constant; huge bitsets as local variables overflow the stack, make them global or static.
- `__gnu_pbds` and `bits/stdc++.h` fail to compile with Apple clang locally; `less_equal` in ordered_set to emulate a multiset breaks `erase` and `find`.
- `endl` in a 10^6-line output; mixing `printf` with unsynced `cout` (output order scrambled).
- `rand()` returns at most 32767 on Codeforces (Windows); `random_shuffle` is removed in C++17.

## Classic Codeforces problems
- 4C Registration System (1300) — `map<string, int>` counter; print the name or name + count.
- 1520D Same Differences (1200) — key a_i − i; count equal keys with a map while scanning.
- 1579D Productive Meeting (1400) — max-heap of remaining sociability; always pair the two largest.
- 1526C2 Potions (Hard Version) (1600) — min-heap of taken potions; drop the most negative when health goes below zero.
- 1474C Array Destruction (1700) — try each partner for the maximum, then simulate with a multiset erasing one copy at a time.
- 1676H2 Maximum Crossings (Hard Version) (1500) — count earlier ends ≥ current end with ordered_set or Fenwick.
