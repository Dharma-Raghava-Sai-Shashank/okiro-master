---
topic: Advanced Dynamic Programming
tags: [dp, bitmasks, trees, dfs and similar, data structures, divide and conquer, binary search, combinatorics]
---
# Advanced Dynamic Programming

## Recognize it
Signals for the advanced DP families (bitmask, digit, interval, tree, SOS, optimized transitions):
- **n ≤ 20** (or ≤ 18, 16) with "visit all", "assign each", "choose an order" → bitmask DP over subsets, O(2^n·n) or O(2^n·n²). n ≤ 40 → meet in the middle instead.
- **Count numbers in [L, R] with a digit property**, R up to 10^18 → digit DP.
- **Merge / delete / split a segment and cost depends on the segment's ends**, n ≤ 500 → interval DP O(n³); n ≤ 5000 → O(n²) interval DP.
- **Tree with "for every vertex as root" or "choose a connected subgraph / subtree"** → subtree DP, then rerooting for all roots in O(n).
- **Values < 2^20 and a condition with AND/OR/submask** ("a_i & a_j = 0", "count pairs whose OR is a submask") → SOS (sum over subsets) DP.
- **dp[i] = best over a sliding window of previous j** → monotonic deque, O(n).
- **dp[i] = min_j (dp[j] + b_j · a_i)** (products of a j-term and an i-term) → convex hull trick / Li Chao tree; usually 2000+ rated.
- **dp[k][i] = min_j dp[k−1][j] + cost(j, i)** with k groups and cost "convex-ish" → divide and conquer optimization; 2200+.
- **Minimize the maximum / maximize the minimum** and checking a fixed value is a DP → binary search on answer + DP check.
- **Weights huge but values or answer tiny** → swap state and value (dp[value] = min weight).

## Bitmask DP (TSP-like paths, assignment)
Bitmask DP stores a subset of n ≤ 20 items as an integer mask; bit i set means item i is used. Typical states:
- dp[mask][v]: best cost of a path that visits exactly the vertices in mask and ends at v (Hamiltonian path / TSP). O(2^n·n²).
- dp[mask]: best cost when the first popcount(mask) workers have been assigned the jobs in mask (assignment). O(2^n·n).
- dp[mask] over submasks: partition the set into groups, O(3^n) total by enumerating submasks.

```cpp
// Minimum-cost Hamiltonian path over all n vertices (any start, any end). n <= 20.
long long hamiltonianPath(const vector<vector<long long>>& d) {
    int n = d.size(), full = (1 << n) - 1;
    const long long INF = LLONG_MAX / 4;
    vector<vector<long long>> dp(1 << n, vector<long long>(n, INF));
    for (int v = 0; v < n; v++) dp[1 << v][v] = 0;
    for (int mask = 1; mask <= full; mask++)
        for (int v = 0; v < n; v++) {
            if (!(mask >> v & 1) || dp[mask][v] >= INF) continue;
            for (int u = 0; u < n; u++)
                if (!(mask >> u & 1))
                    dp[mask | 1 << u][u] = min(dp[mask | 1 << u][u], dp[mask][v] + d[v][u]);
        }
    return *min_element(dp[full].begin(), dp[full].end());
}

// Assignment: worker i = popcount(mask) gets job j. cost[i][j]. O(2^n * n).
long long assignment(const vector<vector<long long>>& cost) {
    int n = cost.size();
    vector<long long> dp(1 << n, LLONG_MAX / 4);
    dp[0] = 0;
    for (int mask = 0; mask < (1 << n); mask++) {
        int i = __builtin_popcount(mask);
        if (i >= n) continue;
        for (int j = 0; j < n; j++)
            if (!(mask >> j & 1))
                dp[mask | 1 << j] = min(dp[mask | 1 << j], dp[mask] + cost[i][j]);
    }
    return dp[(1 << n) - 1];
}

// Enumerate all non-empty submasks of mask (O(3^n) over all masks):
// for (int s = mask; s > 0; s = (s - 1) & mask) { ... }
```
Bitmask DP notes: masks are processed in increasing numeric order, which is a valid topological order because adding a bit increases the number. For a cycle (TSP), fix the start at vertex 0 and close the cycle at the end. Memory: 2^20·20 long longs = 160 MB, too much; use int, n ≤ 18, or drop the "end vertex" dimension when possible. "Choose items in some order with pairwise bonuses" (580D Kefa and Dishes) is the Hamiltonian-path DP restricted to masks with popcount ≤ m. Popcount: `__builtin_popcount` (int), `__builtin_popcountll` (long long).

## C++ template: digit DP
Digit DP counts integers x in [0, N] with a property decided digit by digit. Answer for [L, R] = f(R) − f(L−1). State: (position, property summary, tight flag, optionally started flag for leading zeros). The tight flag means "prefix equals N's prefix so far", which limits the next digit to N's digit.
```cpp
// Count x in [0, N] with at most K non-zero digits (e.g. 1036C Classy Numbers).
struct DigitDP {
    string s; int K;
    long long memo[20][20];
    bool vis[20][20];
    long long go(int pos, int cnt, bool tight) {
        if (cnt > K) return 0;
        if (pos == (int)s.size()) return 1;
        if (!tight && vis[pos][cnt]) return memo[pos][cnt];
        int lim = tight ? s[pos] - '0' : 9;
        long long r = 0;
        for (int d = 0; d <= lim; d++) r += go(pos + 1, cnt + (d != 0), tight && d == lim);
        if (!tight) { vis[pos][cnt] = true; memo[pos][cnt] = r; }
        return r;
    }
    long long count(long long N) {           // requires N >= 0; count(-1) handled by caller
        s = to_string(N);
        memset(vis, 0, sizeof vis);
        return go(0, 0, true);
    }
};
// usage: DigitDP d; d.K = 3; long long ans = d.count(R) - (L > 0 ? d.count(L - 1) : 0);
```
Digit DP rules:
- Only memoize non-tight states (tight states are visited once per position anyway); memo is keyed on position, which encodes the remaining length because the memo is reset for each N.
- Add a **started** flag when leading zeros matter (properties like "no two adjacent equal digits", "number of digits", "first digit"). Leading zeros are not digits of the number.
- Remainder properties: carry `rem = (rem·10 + d) % m` in the state (628D Magic Numbers: divisible by m with digit d exactly at even positions; strings of length up to 2000, so state (pos, rem, tight) with the bound given as a string).
- When L and R are given as huge strings, subtract one from the string L, or compute f(R) − f(L) + [L itself satisfies].
- Sum of digits up to 9·18 = 162 and remainders up to ~100 keep the state small; the tight flag at most doubles it.

## C++ template: interval DP
Interval DP: dp[l][r] = best answer for the segment a[l..r]. Transitions split the segment at some m, or decide what happens to the left end. Evaluate by increasing length, or by l from right to left and r from l to the right, so that every subinterval is ready.
```cpp
// Minimum operations to delete the whole string, one operation deletes a contiguous
// block of equal characters (1132F Clear the String). O(n^3).
int clearString(const string& s) {
    int n = s.size();
    vector<vector<int>> dp(n + 1, vector<int>(n + 1, 0)); // dp[l][r], r inclusive; empty = 0
    auto get = [&](int l, int r) { return l > r ? 0 : dp[l][r]; };
    for (int l = n - 1; l >= 0; l--)
        for (int r = l; r < n; r++) {
            dp[l][r] = 1 + get(l + 1, r);                  // delete s[l] on its own
            for (int m = l + 1; m <= r; m++)
                if (s[m] == s[l])                           // s[l] is deleted together with s[m]
                    dp[l][r] = min(dp[l][r], get(l + 1, m - 1) + get(m, r));
        }
    return dp[0][n - 1];
}
```
Interval DP patterns:
- **Fate of the left end**: either a[l] is handled alone, or it is paired/merged with some a[m] of the same kind; the middle part a[l+1..m−1] is solved independently first (Clear the String, 607B Zuma for palindromes).
- **Split point**: dp[l][r] = min over m of dp[l][m] + dp[m+1][r] + cost(l, r) (matrix chain, merging stones). O(n³); Knuth optimization makes it O(n²) when opt[l][r−1] ≤ opt[l][r] ≤ opt[l+1][r] holds.
- **Compress equal adjacent elements first** (1114D Flood Fill): then dp[l][r] on the compressed array with transitions from both ends.
- Game on a segment where players take from either end: dp[l][r] = best score difference for the player to move.
- n ≤ 500 for O(n³); n ≤ 5000 means only O(1) transitions per interval.

## C++ template: DP on trees (subtree DP)
Tree DP roots the tree, computes dp[v] from dp of children, processing vertices in reverse BFS/DFS order (children before parents). Iterative order avoids recursion depth issues on path-shaped trees with n = 2·10^5.
```cpp
// Maximum-weight independent set on a tree. dp[v][0] = v not taken, dp[v][1] = v taken.
long long treeMaxIndependentSet(int n, const vector<vector<int>>& g, const vector<long long>& w) {
    vector<int> par(n, -1), order;
    order.reserve(n);
    order.push_back(0);
    for (int i = 0; i < (int)order.size(); i++) {      // BFS order: parents before children
        int v = order[i];
        for (int u : g[v]) if (u != par[v]) { par[u] = v; order.push_back(u); }
    }
    vector<array<long long, 2>> dp(n);
    for (int i = n - 1; i >= 0; i--) {                  // reverse: children first
        int v = order[i];
        dp[v] = {0, w[v]};
        for (int u : g[v]) if (u != par[v]) {
            dp[v][0] += max(dp[u][0], dp[u][1]);
            dp[v][1] += dp[u][0];
        }
    }
    return max(dp[0][0], dp[0][1]);
}
```
Subtree DP patterns: subtree sizes; "best connected subgraph containing v inside its subtree" = value(v) + Σ max(0, dp[child]) (1324F Maximum White Subtree); knapsack on trees dp[v][k] merged child by child, which is O(n²) total if each merge loops only up to the current subtree sizes (the "sizes product" argument); matching/independent set with taken/not-taken flags; counting colorings with dp[v][color].

## C++ template: rerooting (answer for every root)
Rerooting computes a subtree DP for every possible root in O(n). Pass 1 (down): dp computed with root 0. Pass 2 (up): up[c] = value of "the rest of the tree seen from c through its parent v", built from up[v] and the contributions of v's other children. For non-invertible merges (max), use prefix/suffix or top-2; for sums, subtract the child's contribution.
```cpp
// Eccentricity of every vertex (max distance to any vertex) in an unweighted tree.
vector<int> allEccentricities(int n, const vector<vector<int>>& g) {
    vector<int> par(n, -1), order;
    order.reserve(n);
    order.push_back(0);
    for (int i = 0; i < (int)order.size(); i++) {
        int v = order[i];
        for (int u : g[v]) if (u != par[v]) { par[u] = v; order.push_back(u); }
    }
    vector<int> down(n, 0), up(n, 0), ans(n);
    for (int i = n - 1; i >= 0; i--) {                       // down[v] = height of subtree
        int v = order[i];
        for (int u : g[v]) if (u != par[v]) down[v] = max(down[v], down[u] + 1);
    }
    for (int v : order) {                                    // parents before children
        int b1 = -1, b2 = -1, c1 = -1;                       // top-2 of down[child]+1
        for (int u : g[v]) if (u != par[v]) {
            int val = down[u] + 1;
            if (val > b1) { b2 = b1; b1 = val; c1 = u; }
            else if (val > b2) b2 = val;
        }
        for (int u : g[v]) if (u != par[v]) {
            int other = (u == c1) ? b2 : b1;                 // best branch at v avoiding u
            up[u] = 1 + max({up[v], other, 0});
        }
        ans[v] = max(down[v], up[v]);
    }
    return ans;
}
// Sum-type rerooting, e.g. S[v] = sum over all u of dist(v,u) * a[u] (1092F):
// S[child] = S[v] + totalA - 2 * subA[child]   (subA = sum of a in child's subtree)
```
Rerooting checklist: (1) define dp for a rooted subtree; (2) define how a child contributes to its parent (often dp[c] + edge); (3) up[c] must exclude c's own contribution; (4) ans[v] = merge of all children contributions and up[v]. Classic uses: sum of distances, farthest vertex, number of vertices you can reach under a rule, 1324F (answer for every vertex: up contribution = max(0, ans[parent] − max(0, dp[child]))), 1187E Tree Painting.

## C++ template: SOS DP (sum over subsets)
SOS DP computes, for every mask over B bits, an aggregate over all its submasks (or supermasks) in O(B·2^B) instead of O(3^B).
```cpp
// f[mask] := sum of f[sub] over all submasks sub of mask (in place).
void sosSubsets(vector<long long>& f, int B) {
    for (int b = 0; b < B; b++)
        for (int mask = 0; mask < (1 << B); mask++)
            if (mask >> b & 1) f[mask] += f[mask ^ (1 << b)];
}
// f[mask] := sum of f[sup] over all supermasks sup of mask (in place).
void sosSupersets(vector<long long>& f, int B) {
    for (int b = 0; b < B; b++)
        for (int mask = 0; mask < (1 << B); mask++)
            if (!(mask >> b & 1)) f[mask] += f[mask | (1 << b)];
}
// Inverse (Moebius) of sosSubsets: same loops with -= instead of +=.
```
SOS uses:
- **Find any partner with a & b = 0** (165E Compatible Numbers): b must be a submask of ~a. Store any element at f[a_i], propagate "any non-empty value" over submask closure (replace + with "if f[mask] empty take f[mask ^ bit]"), answer f[~a & full].
- **Count pairs with AND = 0, or number of elements that are submasks of x**: cnt[x] after sosSubsets.
- **Count subsets with AND exactly 0** (449D Jzzhu and Numbers): g[mask] = number of elements that are supermasks of mask (sosSupersets), subsets whose AND contains mask = 2^g − 1, then inclusion-exclusion over popcount parity.
- The aggregate can be sum, max, min, any, or top-2 (for "maximize a_i | (a_j & a_k)" style problems).
B = 20 gives 2·10^7 operations: fast. B must cover the maximum value (2^20 > 10^6).

## C++ template: monotonic queue optimization
When dp[i] = a[i] + max(dp[j]) over a window j ∈ [i−k, i−1], keep candidate indices in a deque with dp values decreasing from front to back; the front is the window maximum. Each index is pushed and popped once: O(n) per layer.
```cpp
// dp[i] = a[i] + max(dp[j]) for j in [i-k, i-1]; dp[0] = a[0]; returns dp. Unreachable = NEG.
vector<long long> windowMaxDP(const vector<long long>& a, int k) {
    int n = a.size();
    const long long NEG = LLONG_MIN / 4;
    vector<long long> dp(n, NEG);
    deque<int> dq;
    dp[0] = a[0];
    dq.push_back(0);
    for (int i = 1; i < n; i++) {
        while (!dq.empty() && dq.front() < i - k) dq.pop_front();      // leave window
        if (!dq.empty() && dp[dq.front()] > NEG) dp[i] = a[i] + dp[dq.front()];
        while (!dq.empty() && dp[dq.back()] <= dp[i]) dq.pop_back();   // dominated
        dq.push_back(i);
    }
    return dp;
}
```
Layered version (1077F2 Pictures with Kittens, hard): dp[t][i] = a[i] + max dp[t−1][j] over j ∈ [i−k, i−1]; run the deque over the previous layer for each t, O(x·n) total. The same structure applies to min (flip comparisons) and to windows whose left end moves monotonically (two-pointer windows defined by a value constraint). If the window is not monotone, use a segment tree or a multiset instead (O(log n) per step).

## Convex hull trick and divide and conquer optimization (2000+)
These appear around rating 2000–2400; recognize the shape, then use the template.

**Convex hull trick (CHT)**: dp[i] = min_j (dp[j] + m_j · x_i) + c_i. Each j is a line y = m_j·x + dp[j]; dp[i] queries the lowest line at x_i. If slopes are monotone and queries monotone, a deque hull gives O(n); otherwise a Li Chao tree gives O(n log n) with no monotonicity requirement (319C Kalila and Dimna).

**Divide and conquer optimization**: dp[t][i] = min_{j<i} dp[t−1][j] + C(j, i) where the optimal j is non-decreasing in i (holds when C satisfies the quadrangle inequality, e.g. cost of a segment = (sum)² or number of equal pairs inside). Complexity O(k·n log n).
```cpp
// Li Chao tree for minimum of lines over a fixed sorted set of query x-coordinates.
struct LiChao {
    struct Line { long long k, m; long long operator()(long long x) const { return k * x + m; } };
    vector<long long> xs; vector<Line> t;
    explicit LiChao(const vector<long long>& sortedXs)
        : xs(sortedXs), t(4 * sortedXs.size(), Line{0, LLONG_MAX}) {}
    void add(Line nw, int v, int l, int r) {
        int m = (l + r) / 2;
        bool lef = nw(xs[l]) < t[v](xs[l]), mid = nw(xs[m]) < t[v](xs[m]);
        if (mid) swap(t[v], nw);
        if (l == r) return;
        if (lef != mid) add(nw, 2 * v, l, m); else add(nw, 2 * v + 1, m + 1, r);
    }
    long long query(int i, int v, int l, int r) const {   // i = index into xs
        long long res = t[v](xs[i]);
        if (l == r) return res;
        int m = (l + r) / 2;
        return min(res, i <= m ? query(i, 2 * v, l, m) : query(i, 2 * v + 1, m + 1, r));
    }
    void add(long long k, long long b) { add(Line{k, b}, 1, 0, (int)xs.size() - 1); }
    long long query(int i) const { return query(i, 1, 0, (int)xs.size() - 1); }
};

// D&C optimization: cur[i] = min over j in [optl, min(i-1, optr)] of prv[j] + C(j, i).
template <class F>
void dncOpt(int l, int r, int optl, int optr, const vector<long long>& prv,
            vector<long long>& cur, F& C) {
    if (l > r) return;
    const long long INF = LLONG_MAX / 4;
    int mid = (l + r) / 2, best = optl;
    long long bv = INF;
    for (int j = optl; j <= min(mid - 1, optr); j++) {
        if (prv[j] >= INF) continue;
        long long v = prv[j] + C(j, mid);
        if (v < bv) { bv = v; best = j; }
    }
    cur[mid] = bv;
    dncOpt(l, mid - 1, optl, best, prv, cur, C);
    dncOpt(mid + 1, r, best, optr, prv, cur, C);
}
```
Pitfalls: products k·x can overflow long long (use __int128 when |k|,|x| ~ 10^9 and values ~10^18); D&C needs a provable monotone opt, otherwise it silently gives wrong answers. Check with a brute force on random tests.

## DP + binary search, and "the answer value is small"
**Binary search on the answer + DP check**: when the objective is "minimize the maximum" or "maximize the minimum", fix a candidate answer X and ask a yes/no question that a simpler DP answers ("can we split into ≤ k parts each with sum ≤ X", "is there a path where every cell ≥ X"). Monotonicity of feasibility in X must hold. Cost = log(range) × DP.

**Binary search inside a DP transition**: dp over sorted intervals/jobs: dp[i] = max(dp[i−1], w_i + dp[p(i)]) where p(i) = last job ending before job i starts, found with upper_bound on sorted end times (weighted interval scheduling). Also LIS's tails array is a DP where binary search finds the transition.

**Swap state and value when the answer is small**: if a natural DP has a huge dimension but its value is small, exchange them.
- Knapsack with W = 10^9 but Σvalue ≤ 10^5: dp[value] = min weight.
- dp[i][len] = min last element instead of dp[i][last] = max len (that is the O(n log n) LIS).
- Answer ≤ log₂(10^9) ≈ 30 operations or ≤ ~√n segments: make the answer count a dimension, e.g. dp[k][i] = farthest/min-cost position after k steps, iterate k until success.
- "Number of distinct values is small" (≤ 100) though values are large: compress and use the value index as state.

Recognition sentence for a coach: "Which quantity in the state is huge, and which quantity in the value is tiny? If the value is tiny, swap them."

## Pitfalls
- Bitmask DP memory: 2^20 × 20 × 8 bytes = 160 MB; use int or reduce n. Also `1 << n` with n = 31+ overflows int; use 1LL.
- Operator precedence: `mask >> v & 1` is fine (shift binds tighter than &), but `mask & 1 << v == 0` is wrong (== binds tighter than &); always parenthesize comparisons with bit operations.
- Digit DP: forgetting that count(L−1) with L = 0 is "count(−1) = 0"; leading zeros counted as digits; memoizing tight states with a memo shared across different N lengths.
- Interval DP with wrong iteration order (r loop outside l loop reading dp[l+1][r] that is not ready yet).
- Tree DP with recursion on a 2·10^5 path: may overflow the stack locally; use BFS order.
- Rerooting: up[c] must not include c's own subtree; for max-merges with ties, track the child index, not just the value.
- SOS loop order: the bit loop must be the outer loop.
- Monotonic deque: popping with `<` vs `<=` matters only for ties, but pushing the index before checking the window does not.
- CHT/Li Chao overflow in k·x; D&C optimization applied without monotone opt.

## Classic Codeforces problems
- 580D Kefa and Dishes (1800) — dp[mask][last] with pairwise bonuses; answer over masks with popcount m.
- 1324F Maximum White Subtree (1800) — subtree DP sum of max(0, child) plus rerooting to answer every vertex.
- 1036C Classy Numbers (1900) — digit DP with state (position, nonzero count ≤ 3, tight).
- 1132F Clear the String (2000) — interval DP deciding which later equal character s[l] is deleted with.
- 1077F2 Pictures with Kittens (hard version) (2100) — layered DP with a sliding-window max via monotonic deque.
- 165E Compatible Numbers (2200) — SOS over submasks of the complement to find any element with AND 0.
