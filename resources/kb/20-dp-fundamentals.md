---
topic: Dynamic Programming Fundamentals
tags: [dp, implementation, binary search, strings, combinatorics, greedy]
---
# Dynamic Programming Fundamentals

## Recognize it
Signals that a Codeforces problem wants a basic DP (dynamic programming) solution:
- The question is "maximum / minimum / number of ways / is it possible" over a sequence, grid, string or list of items, and a quick greedy has a counterexample you can find by hand.
- A decision at position i only depends on a **small summary of the past**: last element taken, current sum, how many items used, a parity bit, whether an operation was already started.
- Constraint shape tells the state size: n ≤ 5000 → O(n²) DP (dp[i][j]); n ≤ 2·10^5 → O(n) or O(n log n) DP, possibly with one tiny extra dimension (2–3 flags, ≤ 26 letters, ≤ 20 values).
- A **second small number** in the input (capacity W ≤ 10^5, k ≤ 100, sum ≤ 10^5, alphabet 26) is almost always the second DP dimension.
- "Print the answer modulo 998244353 / 10^9+7" together with counting → counting DP (or combinatorics).
- Two strings with n, m ≤ 5000 and subsequence/alignment wording → 2D DP over prefixes (LCS / edit distance family).
- Grid where you move only right/down → DP over cells in row-major order.
- Brute force recursion is exponential but the same (position, summary) pair is reached through many different paths → memoize that pair.

Counter-signal: if the state would need the full set of chosen items and n > 20, DP over subsets is impossible; look for sorting + exchange argument, or a smarter summary.

## Core idea
Every DP solution is four decisions; write them down before coding.
1. **State**: a precise sentence, e.g. "dp[i][j] = maximum total value using only the first i items with total weight exactly j". Ambiguity here causes most wrong answers.
2. **Transition**: think about the *last decision* that produced the state (take item i or not; what the last element was; where the last segment starts). dp[i][j] is computed from states with smaller i.
3. **Base cases**: the empty prefix (dp[0][0] = 0 or 1 way), and unreachable states set to -INF (for max), +INF (for min) or 0 (for counts). Never use 0 as "unreachable" for max/min DPs where 0 is a valid value.
4. **Answer and order**: where the answer lives (dp[n][*] max, dp[n][W], sum over last states) and an evaluation order in which every dependency is computed first.

Complexity = (number of states) × (cost of one transition). If that is too slow, either shrink the state (drop a dimension that can be derived), or speed the transition (prefix sums, monotonic deque, data structure, see advanced DP).

Proof habit: the DP is correct if every valid solution maps to exactly one path through states (for counting) or at least one path (for optimization), and every path corresponds to a valid solution.

## Pull vs push, memoization vs tabulation
Two independent choices when implementing a DP:

**Pull (backward)**: dp[i] = combine over predecessors j of f(dp[j]). Natural when you know "where could I have come from". **Push (forward)**: from a finished dp[i], update dp[next] for every successor. Natural when transitions are described as moves ("from state s you can go to ..."), in probability/expected-value forward DPs, and when the set of successors is easier to enumerate than predecessors. Both give the same answer; push requires that dp[i] is final before you push from it (process in topological order).

**Memoization (top-down recursion + cache)**: write the recurrence directly, compute only reachable states. Good for digit DP, interval DP with sparse reachability, game DPs, and quick prototyping. Costs: recursion overhead, stack depth (depth 10^6 can overflow even with Codeforces' large stack if frames are big), harder to space-optimize. Use a separate "visited" array or a sentinel like -1 that can never be a real value.

**Tabulation (bottom-up loops)**: explicit order, fastest constant factor, enables rolling arrays and prefix-sum speedups. Default choice for sequences, knapsacks and grids when n·m ≥ 10^6.

Rule of thumb for contests: tabulate when the order is obvious (index increasing, interval length increasing); memoize when the order is awkward or many states are unreachable. If recursion depth exceeds ~10^5 locally, switch to tabulation or iterate in a precomputed topological order.

## C++ template: knapsack (0/1, unbounded, counting)
```cpp
// 0/1 knapsack: each item at most once. dp[c] = best value with total weight <= c.
long long knap01(const vector<int>& w, const vector<long long>& v, int W) {
    vector<long long> dp(W + 1, 0);
    for (size_t i = 0; i < w.size(); i++)
        for (int c = W; c >= w[i]; c--)              // DESCENDING: item i used once
            dp[c] = max(dp[c], dp[c - w[i]] + v[i]);
    return dp[W];
}

// Unbounded knapsack: each item any number of times -> ASCENDING capacity loop.
long long knapUnbounded(const vector<int>& w, const vector<long long>& v, int W) {
    vector<long long> dp(W + 1, 0);
    for (size_t i = 0; i < w.size(); i++)
        for (int c = w[i]; c <= W; c++)
            dp[c] = max(dp[c], dp[c - w[i]] + v[i]);
    return dp[W];
}

// Exact-weight variant: unreachable = -INF, only dp[0] = 0.
long long knapExact(const vector<int>& w, const vector<long long>& v, int W) {
    const long long NEG = LLONG_MIN / 4;
    vector<long long> dp(W + 1, NEG);
    dp[0] = 0;
    for (size_t i = 0; i < w.size(); i++)
        for (int c = W; c >= w[i]; c--)
            if (dp[c - w[i]] != NEG) dp[c] = max(dp[c], dp[c - w[i]] + v[i]);
    return dp[W];                                    // NEG means impossible
}

// Number of subsets with sum exactly S, modulo MOD.
long long countSubsets(const vector<int>& a, int S, long long MOD) {
    vector<long long> ways(S + 1, 0);
    ways[0] = 1;
    for (int x : a)
        for (int c = S; c >= x; c--) ways[c] = (ways[c] + ways[c - x]) % MOD;
    return ways[S];
}
```
Knapsack facts: complexity O(n·W). If W is huge (10^9) but total value is small, swap roles: dp[value] = minimum weight achieving that value, answer = max value with dp[value] ≤ W. Coin change "number of ways where order does not matter" = items outer, capacity inner (ascending); "ordered sequences" (compositions) = capacity outer, items inner. Boolean subset-sum with n·S up to ~10^9/64 fits a `bitset<S+1>`: `b |= b << x`.

## C++ template: LIS in O(n log n)
```cpp
// Longest increasing subsequence length. tails[k] = minimum possible last value
// of an increasing subsequence of length k+1 (tails is sorted).
int lisLength(const vector<long long>& a, bool strict = true) {
    vector<long long> tails;
    for (long long x : a) {
        auto it = strict ? lower_bound(tails.begin(), tails.end(), x)   // strictly increasing
                         : upper_bound(tails.begin(), tails.end(), x);  // non-decreasing
        if (it == tails.end()) tails.push_back(x);
        else *it = x;
    }
    return (int)tails.size();
}

// Indices of one longest strictly increasing subsequence.
vector<int> lisIndices(const vector<long long>& a) {
    int n = a.size();
    vector<long long> tails;
    vector<int> tailIdx, par(n, -1);
    for (int i = 0; i < n; i++) {
        int k = lower_bound(tails.begin(), tails.end(), a[i]) - tails.begin();
        if (k == (int)tails.size()) { tails.push_back(a[i]); tailIdx.push_back(i); }
        else { tails[k] = a[i]; tailIdx[k] = i; }
        par[i] = k ? tailIdx[k - 1] : -1;   // predecessor = current end of length-k chain
    }
    vector<int> res;
    for (int i = tailIdx.empty() ? -1 : tailIdx.back(); i != -1; i = par[i]) res.push_back(i);
    reverse(res.begin(), res.end());
    return res;
}
```
LIS notes: `tails` is not itself a valid subsequence; only its length is meaningful. Strict vs non-strict changes lower_bound to upper_bound. Longest decreasing = LIS on negated values. 2D chains (envelopes, 4D Mysterious Present): sort by first coordinate ascending and, for equal first coordinate, second coordinate **descending**, then strict LIS on the second coordinate, so two items with equal first coordinate never chain. Minimum number of non-increasing subsequences that cover the array equals the length of the longest strictly increasing subsequence (Dilworth), a common disguise. Remove-minimum-elements-to-make-sorted = n − LIS (non-decreasing version).

## C++ template: LCS and edit distance
```cpp
// Longest common subsequence length + one reconstruction. O(n*m) time and memory.
string lcs(const string& s, const string& t) {
    int n = s.size(), m = t.size();
    vector<vector<int>> dp(n + 1, vector<int>(m + 1, 0));
    for (int i = 1; i <= n; i++)
        for (int j = 1; j <= m; j++)
            dp[i][j] = s[i - 1] == t[j - 1] ? dp[i - 1][j - 1] + 1
                                            : max(dp[i - 1][j], dp[i][j - 1]);
    string res;
    for (int i = n, j = m; i > 0 && j > 0;) {
        if (s[i - 1] == t[j - 1]) { res += s[i - 1]; i--; j--; }
        else if (dp[i - 1][j] >= dp[i][j - 1]) i--;
        else j--;
    }
    reverse(res.begin(), res.end());
    return res;
}

// Levenshtein edit distance (insert, delete, replace cost 1) with two rows: O(m) memory.
int editDistance(const string& s, const string& t) {
    int n = s.size(), m = t.size();
    vector<int> prev(m + 1), cur(m + 1);
    iota(prev.begin(), prev.end(), 0);               // dp[0][j] = j insertions
    for (int i = 1; i <= n; i++) {
        cur[0] = i;                                  // dp[i][0] = i deletions
        for (int j = 1; j <= m; j++)
            cur[j] = min({prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (s[i - 1] != t[j - 1])});
        swap(prev, cur);
    }
    return prev[m];
}
```
Two-string DP facts: state = (prefix length of s, prefix length of t); transitions look at the last characters. Memory for 5000×5000 ints is 100 MB, usually over the limit: roll rows when only the value is needed. Variants: weighted costs; "substring" instead of "subsequence" (dp[i][j] = length of common suffix ending at i, j, reset to 0 on mismatch); score = 4·LCS − |a| − |b| over substrings (1446B Catching Cheaters) becomes dp[i][j] = max(0, ...), a Kadane-style reset inside the 2D DP.

## Grid paths and counting DP modulo p
Grid DP: cell (i, j) reachable from (i−1, j) and (i, j−1) when moves are right/down, so row-major order is a valid evaluation order.
```cpp
const long long MOD = 1'000'000'007LL;
// Number of right/down paths from (0,0) to (n-1,m-1) avoiding '#'.
long long gridPaths(const vector<string>& g) {
    int n = g.size(), m = g[0].size();
    vector<vector<long long>> dp(n, vector<long long>(m, 0));
    for (int i = 0; i < n; i++)
        for (int j = 0; j < m; j++) {
            if (g[i][j] == '#') { dp[i][j] = 0; continue; }
            if (i == 0 && j == 0) { dp[i][j] = 1; continue; }
            long long up = i ? dp[i - 1][j] : 0, left = j ? dp[i][j - 1] : 0;
            dp[i][j] = (up + left) % MOD;
        }
    return dp[n - 1][m - 1];
}
// Number of ways to write n as an ordered sum of parts from `parts` (compositions).
long long compositions(int n, const vector<int>& parts) {
    vector<long long> f(n + 1, 0);
    f[0] = 1;
    for (int s = 1; s <= n; s++)
        for (int p : parts) if (p <= s) f[s] = (f[s] + f[s - p]) % MOD;
    return f[n];
}
```
Counting DP rules:
- Reduce after every addition; for subtraction use `(a - b % MOD + MOD) % MOD`. Products of two values < MOD fit in long long only if MOD < ~3·10^9.
- Never compare or take max of values already reduced modulo p; a counting DP and an optimization DP must be separate arrays.
- Count each object **exactly once**: define a canonical way to build it (e.g. decide by the last element, or by the first position where something happens). Double counting usually comes from two different decompositions of the same object.
- Range-sum transitions (dp[i] = Σ dp[j] for j in [i−k, i−1]) become O(1) with a running prefix sum, turning O(n·k) into O(n). Example: 474D Flowers, f[i] = f[i−1] + f[i−k], answer queries with prefix sums of f.
- Answers for many queries over the same parameter: precompute the DP once for the maximum n, then answer each query from the table.

## DP over prefixes with a "last element" state
A very common Codeforces DP: process items left to right and keep, as extra state, **what the last chosen item was** (its color, row, value, or direction). The constraint "adjacent chosen things must differ / be compatible" is checked only between the last state and the new item.

Examples of the "last" dimension:
- 1195C Basketball Exercise: dp[i][r] = best sum using players among the first i columns where the last chosen player is in row r (r ∈ {none, top, bottom}).
- No two adjacent equal colors: dp[i][c] = min cost to paint houses 0..i with house i colored c.
- 455A Boredom: compress to value counts; dp[v] = best using values ≤ v; taking v forbids v−1, so dp[v] = max(dp[v−1], dp[v−2] + v·cnt[v]).
- 977F Consecutive Subsequence: dp over values with a hash map, dp[x] = dp[x−1] + 1 (last element value is the state).
- Stage flags: 1155D Beautiful Array uses state ∈ {before, inside, after} the multiplied segment, plus Kadane-style "start fresh".

```cpp
// Paint n houses with K colors, cost[i][c]; adjacent houses must differ. O(n*K).
// Trick: keep best and second best of the previous row instead of an O(K) inner loop.
long long paintHouses(const vector<vector<long long>>& cost) {
    int n = cost.size(), K = cost[0].size();
    if (K == 1) return n == 1 ? cost[0][0] : LLONG_MAX;   // impossible for n > 1
    vector<long long> dp = cost[0];
    for (int i = 1; i < n; i++) {
        int b1 = -1, b2 = -1;                            // indices of two smallest
        for (int c = 0; c < K; c++) {
            if (b1 == -1 || dp[c] < dp[b1]) { b2 = b1; b1 = c; }
            else if (b2 == -1 || dp[c] < dp[b2]) b2 = c;
        }
        vector<long long> nd(K);
        for (int c = 0; c < K; c++) nd[c] = cost[i][c] + (c == b1 ? dp[b2] : dp[b1]);
        dp = nd;
    }
    return *min_element(dp.begin(), dp.end());
}
```
If the "last value" dimension is large (values up to 10^9), compress values, or store dp in a map, or move the max over compatible last values into a Fenwick/segment tree (dp[i] = 1 + max over dp[j] with a[j] < a[i]).

## Space optimization
DP memory tricks, needed when n·m states exceed ~5·10^7 ints or ~256 MB:
- **Rolling rows**: if dp[i][*] depends only on dp[i−1][*], keep two vectors `prev`, `cur` and swap. Memory O(m).
- **In-place 1D**: 0/1 knapsack iterates capacity downward so dp[c − w] still holds the previous row; unbounded knapsack iterates upward so it already holds the current row. Getting the direction wrong silently switches between the two problems.
- **Keep k+1 rows** when dp[i] depends on dp[i−1..i−k]; index rows by i % (k+1).
- **Bitset** for boolean DPs: subset sum `b |= b << x` gives n·S/64 operations.
- **Use int, not long long**, and plain arrays or a single flat vector (index i*m+j) instead of `vector<vector<>>` when memory is tight.
- **Reconstruction conflicts with rolling**: to print the optimal choice, either keep the full table of decisions as `vector<vector<char>>` or bits (8–64× smaller than values), or recompute (Hirschberg style divide and conquer for LCS, rarely needed on CF).
- **Recompute vs store**: for multi-test problems with sum of n bounded, allocate per test with size n, never a global max-size table reset each test (that is O(T·maxN) time and a common TLE).

## Variations and tricks
DP tricks that come up constantly at 1200–2000:
- **Sort first**: if the order of items is free, sort to make transitions one-directional (by weight, by deadline, by left endpoint). Then "chain" problems become LIS/knapsack.
- **dp over values instead of indices**: when values ≤ 10^6, use cnt[v] and dp[v] (455A Boredom).
- **"Exactly k" vs "at most k"**: at most = prefix max/sum over exactly; exactly = at most(k) − at most(k−1) for counts.
- **Prefix-sum transitions**: Σ dp[j] over a window in O(1); max over a sliding window via monotonic deque.
- **Divisor/multiple transitions**: dp over positions where the new element must be divisible by its index (1061C Multiplicity): for each a[i], iterate its divisors d in decreasing order and do dp[d] += dp[d−1]. Total work = Σ divisors.
- **Kadane as DP**: best subarray ending at i = max(a[i], best(i−1) + a[i]); extend with flags for "operation applied to a segment".
- **Add sentinels**: a virtual element at both ends (value −∞ or 0) removes edge cases in "last element" DPs.
- **Small answer**: if the answer is bounded (≤ 60 operations), make the answer a dimension: dp[i][ops] = feasible/min cost.
- **Tie DP to greedy**: often greedy fixes the order, DP decides the subset (sort by deadline, then knapsack over time).
- **Multi-test**: Σn bounded means per-test O(n·k) is fine; clear only what you used.

## Pitfalls
- Unreachable states initialized to 0 in a max-DP: the DP then "starts" from the middle. Use -INF and check before transitioning.
- -INF + negative value overflows: use LLONG_MIN/4 or skip unreachable states.
- Wrong loop direction in 1D knapsack (0/1 needs descending capacity).
- int overflow in sums of up to 2·10^5 values of 10^9: use long long for dp values.
- Modular counting: forgetting `% MOD` after a sum of three terms, or negative results after subtraction.
- Off-by-one between "first i items" (1-indexed dp, size n+1) and 0-indexed arrays: decide once and stick to it.
- Memoization with `memset(dp, -1)` when -1 is a legitimate value; or memoizing a state that depends on a "tight"/global flag not in the key.
- O(T · maxN) resets in multi-test problems.
- Memory: `long long dp[5001][5001]` = 200 MB. Roll rows or use int.
- Recursion depth: memoized recursion on n = 10^6 crashes; tabulate.
- Answer location: the best is often max over all dp[n][*] or over all i, not dp[n][0].
- Strict vs non-strict comparisons in LIS (lower_bound vs upper_bound).

## Classic Codeforces problems
- 189A Cut Ribbon (1300) — unbounded knapsack with exact sum; unreachable lengths must be -INF, not 0.
- 1195C Basketball Exercise (1400) — prefix DP with "row of the last chosen player" as state; allow skipping a column.
- 455A Boredom (1500) — DP over values with counts; take v forbids v−1, classic house-robber recurrence.
- 474D Flowers (1700) — counting DP f[i] = f[i−1] + f[i−k] mod p, then prefix sums answer range queries in O(1).
- 4D Mysterious Present (1700) — sort envelopes, then LIS-style chain DP with reconstruction of the chain.
- 1155D Beautiful Array (1900) — Kadane with three stages (before / inside / after the multiplied segment) as a state.
