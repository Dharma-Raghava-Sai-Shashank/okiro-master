---
topic: Segment Tree and Fenwick Tree (BIT)
tags: [data structures, binary search, divide and conquer, sortings, trees]
---
# Segment Tree and Fenwick Tree (BIT)

## Recognize it
Signals that a Codeforces problem needs a Fenwick tree (BIT) or a segment tree:
- Array of n ≤ 2·10^5 (sometimes 10^6) with **q ≤ 2·10^5 mixed operations**: update an element or a range, then ask sum/min/max/gcd/xor over a range. Prefix sums die on updates; O(n) per query is 4·10^10 → need O(log n) per operation.
- "Count pairs i < j with a_i > a_j" (inversions), "count j < i with a_j < a_i", "for each element, how many earlier elements are smaller" → Fenwick over values (after coordinate compression), sweep left to right.
- "Remove the k-th smallest", "find the first position where the prefix sum reaches k", "first index ≥ l with a_i ≥ x" → descend the tree (Fenwick binary lifting or segment tree walk) in O(log n) instead of binary search + query in O(log² n).
- Range add **and** range sum/min → lazy propagation (or two Fenwicks for add + sum).
- Queries "number of distinct values in [l, r]", "xor of distinct values in [l, r]" with no updates → offline, sort queries by right endpoint, keep only the last occurrence of each value in a Fenwick.
- Merge of two halves needs more than one number (bracket matching, max subarray sum, longest run) → segment tree with a custom node struct and merge function.
- Rule of thumb: Fenwick when the operation is invertible (sum, xor, count) and you need point update + prefix query; segment tree for min/max/gcd, non-invertible merges, lazy updates, or descending searches with arbitrary predicates.

## Core idea
**Fenwick tree (BIT):** index i (1-based) stores the sum of the block (i − lowbit(i), i], where lowbit(i) = i & −i. A prefix query walks i → i − lowbit(i) (O(log n) blocks); a point update walks i → i + lowbit(i) (every block covering i). Only works for invertible operations when you need arbitrary ranges: sum(l, r) = pref(r) − pref(l − 1). Prefix-max BIT works only if values only increase.

**Segment tree:** node covers a segment; children cover halves; root covers [0, n). Any range query decomposes into O(log n) disjoint nodes; a point update changes O(log n) ancestors. Requirement: the merge must be **associative** (not necessarily commutative). The identity element (0 for sum, +∞ for min, −∞ for max, 0 for gcd/xor) fills empty parts.

**Lazy propagation:** a range update fully covering a node is applied to that node's aggregate and stored as a pending tag; the tag is pushed to children only when a later operation needs to go below that node. Requirements: you can update the aggregate from the tag alone (sum += v·len, min += v), and tags compose (add after add = add of sum).

**Complexities:** Fenwick: build O(n) or O(n log n), op O(log n), memory n+1. Iterative segment tree: memory 2n, op O(log n), very fast. Recursive segment tree: memory 4n, op O(log n) with a larger constant; needed for lazy and for descending with predicates. n = 10^6 with q = 10^6 → prefer Fenwick or iterative tree.

## C++ template: Fenwick (point add, prefix sum, k-th by descent, range add + range sum)
```cpp
struct Fenwick {                                    // 0-indexed interface
    int n; vector<long long> t;
    explicit Fenwick(int n) : n(n), t(n + 1, 0) {}
    void add(int i, long long v) { for (i++; i <= n; i += i & -i) t[i] += v; }   // i == n is a no-op
    long long pref(int i) {                         // sum of [0..i]; pref(-1) = 0
        long long s = 0;
        for (i++; i > 0; i -= i & -i) s += t[i];
        return s;
    }
    long long sum(int l, int r) { return l > r ? 0 : pref(r) - pref(l - 1); }
    // Smallest index p with pref(p) >= k; requires all values >= 0. Returns n if total < k.
    int lowerBound(long long k) {
        int pos = 0;
        for (int pw = 1 << __lg(max(n, 1)); pw; pw >>= 1)
            if (pos + pw <= n && t[pos + pw] < k) { pos += pw; k -= t[pos]; }
        return pos;                                 // 1-based pos+1 == 0-based pos
    }
};

// Range add on [l, r], range sum on [l, r], via two Fenwicks over the difference array d:
// prefix(i) = (i + 1) * sum(d[0..i]) - sum(d[p] * p, p <= i).
struct RangeFenwick {
    Fenwick b1, b2;
    explicit RangeFenwick(int n) : b1(n), b2(n) {}
    void rangeAdd(int l, int r, long long v) {
        b1.add(l, v);  b1.add(r + 1, -v);
        b2.add(l, v * l);  b2.add(r + 1, -v * (r + 1));
    }
    long long prefix(int i) { return i < 0 ? 0 : (i + 1) * b1.pref(i) - b2.pref(i); }
    long long rangeSum(int l, int r) { return prefix(r) - prefix(l - 1); }
};
```
Fenwick as a multiset of values in [0, n): `add(x, 1)` inserts, `add(x, -1)` erases one copy, `pref(x - 1)` = count of values < x, `lowerBound(k)` = k-th smallest (1-based k). This is exactly 1354D Multiset (n up to 10^6, tight memory, so a BIT of ints beats any tree of pointers). Range add + point query needs just one Fenwick on the difference array: `add(l, v); add(r + 1, -v);` and the value at i is `pref(i)`.

## C++ template: iterative segment tree with generic merge
Bottom-up tree of size 2n (any n, no power of two needed). Leaves at t[n..2n). Works for any associative merge, including non-commutative ones, because left and right partial results are kept separately.
```cpp
template <class T, class F>
struct SegTree {
    int n; vector<T> t; T id; F f;
    SegTree(int n, T id, F f) : n(n), t(2 * n, id), id(id), f(f) {}
    void build(const vector<T>& a) {
        for (int i = 0; i < n; i++) t[n + i] = a[i];
        for (int i = n - 1; i > 0; i--) t[i] = f(t[2 * i], t[2 * i + 1]);
    }
    void set(int p, T v) {                          // a[p] = v
        for (t[p += n] = v; p >>= 1;) t[p] = f(t[2 * p], t[2 * p + 1]);
    }
    T query(int l, int r) {                         // merge of a[l..r), half-open
        T L = id, R = id;
        for (l += n, r += n; l < r; l >>= 1, r >>= 1) {
            if (l & 1) L = f(L, t[l++]);
            if (r & 1) R = f(t[--r], R);
        }
        return f(L, R);
    }
};
// Usage (C++17 deduces T and F):
// SegTree mn(n, LLONG_MAX, [](long long a, long long b) { return min(a, b); });
// SegTree sm(n, 0LL, [](long long a, long long b) { return a + b; });
// SegTree g(n, 0, [](int a, int b) { return gcd(a, b); });
```
Custom node merge (380C Sereja and Brackets): node = {matched, unmatchedOpen, unmatchedClose}; merge(A, B): t = min(A.open, B.close); return {A.m + B.m + t, A.open + B.open − t, A.close + B.close − t}. Answer for [l, r] is 2·matched. Same pattern for max subarray sum (node = {sum, bestPrefix, bestSuffix, best}). Use a struct with an identity value whose merge leaves the other side unchanged.

Alternating operations by level (339D Xenia and Bit Operations): store the level parity with each node; recursive tree where depth decides OR vs XOR.

## C++ template: lazy segment tree (range add, range sum)
```cpp
struct LazySeg {
    int n; vector<long long> sum, lz;
    explicit LazySeg(int n) : n(n), sum(4 * n, 0), lz(4 * n, 0) {}
    void build(int x, int l, int r, const vector<long long>& a) {
        if (l == r) { sum[x] = a[l]; return; }
        int m = (l + r) / 2;
        build(2 * x, l, m, a); build(2 * x + 1, m + 1, r, a);
        sum[x] = sum[2 * x] + sum[2 * x + 1];
    }
    void apply(int x, int l, int r, long long v) { sum[x] += v * (r - l + 1); lz[x] += v; }
    void push(int x, int l, int r) {
        if (!lz[x]) return;
        int m = (l + r) / 2;
        apply(2 * x, l, m, lz[x]); apply(2 * x + 1, m + 1, r, lz[x]);
        lz[x] = 0;
    }
    void update(int x, int l, int r, int ql, int qr, long long v) {
        if (qr < l || r < ql) return;
        if (ql <= l && r <= qr) { apply(x, l, r, v); return; }
        push(x, l, r);
        int m = (l + r) / 2;
        update(2 * x, l, m, ql, qr, v); update(2 * x + 1, m + 1, r, ql, qr, v);
        sum[x] = sum[2 * x] + sum[2 * x + 1];
    }
    long long query(int x, int l, int r, int ql, int qr) {
        if (qr < l || r < ql) return 0;
        if (ql <= l && r <= qr) return sum[x];
        push(x, l, r);
        int m = (l + r) / 2;
        return query(2 * x, l, m, ql, qr) + query(2 * x + 1, m + 1, r, ql, qr);
    }
    void build(const vector<long long>& a) { build(1, 0, n - 1, a); }
    void add(int l, int r, long long v) { update(1, 0, n - 1, l, r, v); }      // inclusive
    long long get(int l, int r) { return query(1, 0, n - 1, l, r); }           // inclusive
};
```
Adapting the lazy segment tree: range add + range min → `apply` does `mn[x] += v` (no length factor), query identity is LLONG_MAX, merge is min. Range assign → tag "assigned value or none" (use a separate flag; 0 can be a valid assignment), `apply` sets sum = v·len and overwrites any pending add. Assign + add together → tag (mul, add) pairs composed as affine maps, order matters. Circular ranges (52C Circular RMQ): split [l, r] with l > r into [l, n−1] and [0, r].

## Descending the segment tree: first index with a property
Binary search over a segment tree should be a single O(log n) walk, not O(log² n) of repeated queries. The pattern: at each node, check the aggregate of the left child; go left if the answer can be there, otherwise go right (adjusting the target).
```cpp
// Recursive max segment tree with "first index >= ql whose value >= k".
struct MaxSeg {
    int n; vector<long long> mx;
    explicit MaxSeg(int n) : n(n), mx(4 * n, LLONG_MIN) {}
    void set(int x, int l, int r, int p, long long v) {
        if (l == r) { mx[x] = v; return; }
        int m = (l + r) / 2;
        if (p <= m) set(2 * x, l, m, p, v); else set(2 * x + 1, m + 1, r, p, v);
        mx[x] = max(mx[2 * x], mx[2 * x + 1]);
    }
    int firstAtLeast(int x, int l, int r, int ql, long long k) {
        if (r < ql || mx[x] < k) return -1;           // nothing useful in this node
        if (l == r) return l;
        int m = (l + r) / 2;
        int res = firstAtLeast(2 * x, l, m, ql, k);
        if (res == -1) res = firstAtLeast(2 * x + 1, m + 1, r, ql, k);
        return res;
    }
    void set(int p, long long v) { set(1, 0, n - 1, p, v); }
    int firstAtLeast(int ql, long long k) { return firstAtLeast(1, 0, n - 1, ql, k); }
};
```
Why O(log n): nodes partially overlapping ql lie on one root-to-leaf path; inside a fully covered node with mx ≥ k the walk always succeeds and goes down one path. Same idea for a count tree: k-th one = "if cnt[left] ≥ k go left, else k −= cnt[left] and go right". For prefix sums reaching k, carry the accumulated sum while descending. With lazy tags, call `push` before going into children. Typical uses: "first element ≥ x to the right of l" (assigning items to the first bin with enough capacity), k-th remaining element after deletions (Josephus-style removal), first position where prefix balance drops below zero.

## Counting inversions and offline queries by right endpoint
**Inversions with a Fenwick:** compress values, sweep left to right; before inserting a_i, the number of earlier elements strictly greater than a_i is i − (count of earlier values ≤ a_i).
```cpp
long long countInversions(const vector<int>& a) {
    vector<int> v(a);
    sort(v.begin(), v.end());
    v.erase(unique(v.begin(), v.end()), v.end());
    Fenwick bit(v.size());
    long long inv = 0;
    for (int i = 0; i < (int)a.size(); i++) {
        int c = lower_bound(v.begin(), v.end(), a[i]) - v.begin();
        inv += i - bit.pref(c);                    // earlier elements with value > a[i]
        bit.add(c, 1);
    }
    return inv;
}
```
Variants: pairs with a_i ≥ a_j (use `pref(c - 1)`); nested segments (1915F Greetings: sort by start, count earlier segments whose end is larger); triples i < j < k with a_i > a_j > a_k (61E Enemy is weak: for each j multiply "greater on the left" by "smaller on the right", two Fenwick sweeps); min adjacent swaps to turn one string into another = inversions of the target index sequence (1430E String Reversal). Merge sort also counts inversions in O(n log n) without compression.

**Offline by right endpoint:** sort queries by r, sweep r from left to right, and keep the Fenwick so that position p holds 1 only if p is the **last** occurrence of a[p] within [0, r]. Then the distinct count in [l, r] is the Fenwick sum over [l, r].
```cpp
vector<long long> distinctInRanges(const vector<int>& a, const vector<pair<int, int>>& qs) {
    int n = a.size(), q = qs.size();
    vector<int> ord(q);
    iota(ord.begin(), ord.end(), 0);
    sort(ord.begin(), ord.end(), [&](int x, int y) { return qs[x].second < qs[y].second; });
    Fenwick bit(n);
    map<int, int> last;                             // or a compressed array for speed
    vector<long long> ans(q);
    int r = -1;
    for (int id : ord) {
        auto [L, R] = qs[id];
        while (r < R) {
            r++;
            auto it = last.find(a[r]);
            if (it != last.end()) bit.add(it->second, -1);
            bit.add(r, 1);
            last[a[r]] = r;
        }
        ans[id] = bit.sum(L, R);
    }
    return ans;
}
```
Replace "+1 at last occurrence" with "xor a[r] at last occurrence" for the xor of distinct values (703D Mishka and Interesting sum: xor of values with even count = xor of whole range ⊕ xor of distinct values). The same sweep with a segment tree answers "min distance between equal elements in [l, r]" or "values that occur exactly k times".

## Variations and tricks
- **Coordinate compression** first whenever values are up to 10^9 but only n distinct values matter: `sort + unique + lower_bound`.
- **Fenwick over values while sweeping positions** (or vice versa) turns 2D dominance counting "pairs with i < j and a_i < a_j" into O(n log n). Sort by one coordinate, BIT over the other (1311F Moving Points: sort by x, BIT over compressed speeds stores count and sum of x).
- **Prefix sums inside a BIT:** for "count subarrays with sum < t" (1042D Petya and Array), insert prefix sums into a BIT over compressed prefix values and count earlier prefixes > P_i − t.
- **Segment tree on bitmasks:** 26 letters → node = OR of `1 << c`, answer = popcount (1234D Distinct Characters Queries).
- **Segment tree of gcd + count of the min:** gcd over range and how many elements equal it (474F Ant colony).
- **2D:** a Fenwick of Fenwicks for n ≤ 2000 grids; otherwise offline sweep + 1D BIT.
- **Persistent / merge-sort tree / segment tree beats** exist but are rarely needed below 2200.
- Iterative tree for speed when n, q ≈ 10^6; recursive tree when you need lazy or descent.
- Build in O(n) instead of n point updates when initial values are known.

## Pitfalls
- Fenwick is 1-based internally: forgetting `i++` loops forever at i = 0 (0 & −0 = 0).
- `pref(l - 1)` with l = 0 must return 0; guard it or use the `i++` convention above.
- Sum overflow: n · 10^9 needs long long; lazy `v * (r − l + 1)` must be computed in long long.
- Recursive segment tree array size: 4n, not 2n.
- Lazy: forgetting `push` before recursing in **both** update and query, or forgetting to recompute the parent after children change.
- Range-assign tags with value 0 confused with "no tag".
- Min tree identity: using INT_MAX with long long data, or 0 for min.
- Iterative tree queries are half-open [l, r); mixing with inclusive [l, r] silently drops the last element.
- Fenwick `lowerBound` requires non-negative values (counts); it breaks with negative entries.
- Coordinate compression on queries: compress query values together with array values, or use `upper_bound − 1` correctly.
- Multi-test: reallocate trees per test with that test's n; clearing a 4·10^6 array per test with many tests is TLE.

## Classic Codeforces problems
- 339D Xenia and Bit Operations (1700) — segment tree where the merge alternates OR and XOR by level; point updates.
- 1915F Greetings (1500) — sort by start; the answer is the number of nested pairs, counted with a Fenwick over compressed ends.
- 61E Enemy is weak (1900) — for each middle element, (greater on the left) × (smaller on the right) with two Fenwick sweeps.
- 1354D Multiset (1900) — Fenwick over values with binary-lifting descent to delete the k-th order statistic under tight memory.
- 380C Sereja and Brackets (2000) — segment tree node (matched, open, close), merge matches left opens with right closes.
- 703D Mishka and Interesting sum (2100) — offline by right endpoint; xor of distinct values via Fenwick on last occurrences.
