---
topic: Sparse Table, Monotonic Stack and Monotonic Queue
tags: [data structures, binary search, two pointers, divide and conquer, dp, greedy]
---
# Sparse Table, Monotonic Stack and Monotonic Queue

## Recognize it
Signals for a sparse table, a monotonic stack, or a monotonic deque on Codeforces:
- **Static array** (no updates) and many range min/max/gcd queries → sparse table: O(n log n) build, O(1) query. With updates → segment tree instead.
- "Longest subarray whose gcd > 1 / whose max − min ≤ k" → two pointers + sparse table (gcd, min, max are idempotent) or two pointers + monotonic deques.
- "For each i, the nearest element to the left/right that is greater/smaller" → monotonic stack, O(n) total.
- "Sum over all subarrays of max (or min, or max − min)", "for each value, in how many subarrays is it the maximum", "is every subarray's max ≥ its sum" → contribution technique: each a[i] is the max on a span found by monotonic stacks.
- "Largest rectangle in a histogram", "largest all-ones rectangle in a binary matrix" (histogram per row), "for each group size x, the maximum of the minimum" → monotonic stack giving the span where a[i] is the minimum.
- "Sliding window of fixed size k: min/max of each window", "dp[i] = min(dp[j]) + c over j in [i − k, i − 1]" → monotonic deque, O(n) total.
- Heights that must be non-decreasing then non-increasing (unimodal), with per-position caps → prefix/suffix best computed with a monotonic stack.
- n up to 10^6 → you need the O(n) stack/deque rather than O(n log n) structures; n ≤ 2·10^5 with 10^6 range queries → sparse table O(1) query.

## Core idea
**Sparse table:** sp[k][i] = f(a[i], ..., a[i + 2^k − 1]); sp[k][i] = f(sp[k−1][i], sp[k−1][i + 2^(k−1)]). For an **idempotent** f (f(x, x) = x: min, max, gcd, AND, OR) a range [l, r] is covered by two overlapping blocks of length 2^⌊log2(len)⌋, so the query is O(1). For sum/xor (not idempotent), overlap double-counts; use prefix sums instead, or decompose into O(log n) disjoint blocks.

**Monotonic stack:** scan left to right keeping indices whose values are strictly decreasing (for "next greater"). When a[i] arrives, every stack element smaller than a[i] has found its next greater element = i and is popped. Each index is pushed and popped once → O(n). After popping, the element under the new top is the **previous greater** element of i. The stack is the "staircase" of candidates that can still be an answer for future elements.

**Monotonic deque (queue):** for sliding windows, keep indices with increasing values (for min). New element pops worse elements from the back (they are older and not smaller, so they can never be the window min again); expired indices are popped from the front. The front is always the window min. O(n) total.

**Contribution technique:** Σ over subarrays of max = Σ_i a[i] · (number of subarrays where a[i] is the max). With L[i] = previous index with value ≥ a[i] and R[i] = next index with value > a[i], that number is (i − L[i]) · (R[i] − i). The asymmetric tie-break (≥ on one side, > on the other) assigns each subarray to exactly one max.

## C++ template: sparse table (O(1) range min/max/gcd)
```cpp
template <class T, class F>
struct SparseTable {
    vector<vector<T>> sp; F f;
    SparseTable(const vector<T>& a, F f) : f(f) {
        int n = a.size(), K = __lg(max(n, 1)) + 1;
        sp.assign(K, vector<T>(n));
        sp[0] = a;
        for (int k = 1; k < K; k++)
            for (int i = 0; i + (1 << k) <= n; i++)
                sp[k][i] = f(sp[k - 1][i], sp[k - 1][i + (1 << (k - 1))]);
    }
    T query(int l, int r) {                    // inclusive [l, r], requires l <= r, f idempotent
        int k = __lg(r - l + 1);
        return f(sp[k][l], sp[k][r - (1 << k) + 1]);
    }
};
// SparseTable mn(a, [](int x, int y) { return min(x, y); });
// SparseTable g(d, [](long long x, long long y) { return gcd(x, y); });
```
Memory: n · log n values; n = 2·10^5 → 18 · 2·10^5 = 3.6·10^6 ints, fine. n = 10^6 → 20 · 10^6 ints = 80 MB, often too much; use a deque/stack approach. For argmin, store indices and compare by a[idx].

Sparse table + binary search: with a sparse table, "farthest r such that gcd(a[l..r]) > 1" is a binary search on r (each check O(1)), or two pointers. Since gcd only decreases as the window grows and takes at most log(max a) distinct values from a fixed l, the binary search is safe. Classic: 1548B Integers Have Friends converts "all elements congruent modulo some m ≥ 2" into "gcd of adjacent differences > 1" and finds the longest such window. 359D Pair of Numbers: a window is good if its gcd equals its min; binary search on the length with O(1) min and gcd queries.

## C++ template: monotonic stack (next greater, spans, sum of subarray maxima)
```cpp
// nge[i] = smallest j > i with a[j] > a[i], or n if none.
vector<int> nextGreater(const vector<long long>& a) {
    int n = a.size();
    vector<int> nge(n, n), st;
    for (int i = 0; i < n; i++) {
        while (!st.empty() && a[st.back()] < a[i]) { nge[st.back()] = i; st.pop_back(); }
        st.push_back(i);
    }
    return nge;
}

// Sum over all subarrays of max(subarray). L = previous index with a >= a[i], R = next with a > a[i].
long long sumOfSubarrayMax(const vector<long long>& a) {
    int n = a.size();
    vector<int> L(n), R(n), st;
    for (int i = 0; i < n; i++) {
        while (!st.empty() && a[st.back()] < a[i]) st.pop_back();
        L[i] = st.empty() ? -1 : st.back();
        st.push_back(i);
    }
    st.clear();
    for (int i = n - 1; i >= 0; i--) {
        while (!st.empty() && a[st.back()] <= a[i]) st.pop_back();
        R[i] = st.empty() ? n : st.back();
        st.push_back(i);
    }
    long long s = 0;
    for (int i = 0; i < n; i++) s += a[i] * (long long)(i - L[i]) * (R[i] - i);
    return s;
}
```
Choosing the comparison: pop while `a[top] < a[i]` → after popping, top is the previous **greater-or-equal**; pop while `a[top] <= a[i]` → top is the previous **strictly greater**. For "smaller" versions flip the comparisons. Sum of subarray minima: negate the array or flip comparisons. Σ(max − min) over all subarrays = sumMax − sumMin (817D Imbalanced Array). The span (L[i], R[i]) is the maximal window where a[i] is the maximum; many problems need a check on this window only (1691D Max GEQ Sum: for the span of each i, compare a[i] with max prefix-sum on the right minus min prefix-sum on the left, using sparse tables on prefix sums).

## C++ template: largest rectangle in a histogram
```cpp
// Heights h[i] >= 0. Each bar, when popped, extends from (new top + 1) to (i - 1).
long long largestRectangle(const vector<long long>& h) {
    int n = h.size();
    vector<int> st;
    long long best = 0;
    for (int i = 0; i <= n; i++) {
        long long cur = (i == n) ? 0 : h[i];          // sentinel 0 flushes the stack at the end
        while (!st.empty() && h[st.back()] >= cur) {
            long long height = h[st.back()];
            st.pop_back();
            int left = st.empty() ? -1 : st.back();
            best = max(best, height * (i - left - 1));
        }
        st.push_back(i);
    }
    return best;
}
```
Equal heights: the earlier equal bar gets a too-short width when popped, but the last bar of the equal run gets the full width, so the maximum is still correct. Maximal all-ones rectangle in an n × m binary matrix: h[j] = consecutive ones ending at the current row in column j, run the histogram per row, O(nm). "For each size x, max over windows of size x of the window min" (547B Mike and Feet): span length len_i where a[i] is the min gives ans[len_i] = max(ans[len_i], a[i]); then ans[x] = max(ans[x], ans[x + 1]) from right to left, because a window min for a longer window is achievable for every shorter one.

Unimodal with caps (1313C2 Skyscrapers hard): left[i] = best sum of a non-decreasing sequence ending at i with h[i] = m[i]; using the previous smaller element j of m, left[i] = left[j] + m[i] · (i − j). Same from the right; the peak maximizes left[i] + right[i] − m[i].

## C++ template: monotonic deque (sliding window min/max)
```cpp
// Minimum of every window of length k: res[i - k + 1] = min(a[i-k+1..i]).
vector<long long> slidingMin(const vector<long long>& a, int k) {
    deque<int> dq;                                     // indices, values increasing front -> back
    vector<long long> res;
    for (int i = 0; i < (int)a.size(); i++) {
        while (!dq.empty() && a[dq.back()] >= a[i]) dq.pop_back();
        dq.push_back(i);
        if (dq.front() <= i - k) dq.pop_front();       // at most one index expires per step
        if (i >= k - 1) res.push_back(a[dq.front()]);
    }
    return res;
}

// Longest window with max - min <= K (K >= 0): two pointers + two deques.
int longestWindow(const vector<long long>& a, long long K) {
    deque<int> mx, mn;
    int best = 0, l = 0;
    for (int r = 0; r < (int)a.size(); r++) {
        while (!mx.empty() && a[mx.back()] <= a[r]) mx.pop_back();
        mx.push_back(r);
        while (!mn.empty() && a[mn.back()] >= a[r]) mn.pop_back();
        mn.push_back(r);
        while (a[mx.front()] - a[mn.front()] > K) {
            l++;
            if (mx.front() < l) mx.pop_front();
            if (mn.front() < l) mn.pop_front();
        }
        best = max(best, r - l + 1);
    }
    return best;
}
```
Deques never empty inside the inner loop: index r is in both, and at l = r the difference is 0 ≤ K. Several attributes at once (514D R2D2 and Droid Army: m ≤ 5 detail types, window cost = Σ over types of the window max ≤ k): keep one max-deque per type, shrink l while the sum of fronts exceeds k.

DP optimization: dp[i] = c_i + min(dp[j] for i − k ≤ j < i) → push dp[i] into the min-deque after computing it, pop expired indices before reading the front. Turns O(nk) into O(n). Works for any window that only moves right on both ends.

## Variations and tricks
- **Previous smaller + next smaller** give each element its "dominance interval"; combined with prefix sums they answer "max over subarrays of min · sum" (min-product) in O(n).
- **Stack for brackets:** longest regular bracket substring (5C Longest Regular Bracket Sequence): start the stack with the barrier −1; on '(' push i; on ')' pop, then if the stack is empty push i as the new barrier, otherwise the current regular substring has length i − top (count how often the maximum occurs as well).
- **Stack of jumps (DP on next greater/smaller):** 1407D Discrete Centrifugal Jumps uses both a decreasing and an increasing stack; every pop gives a valid jump j → i.
- **Cartesian tree** (min at the root) from a monotonic stack in O(n): the parent of i is whichever of its previous-smaller and next-smaller elements has the **larger** value. Divide and conquer on the max position (max splits the array) is the recursive view of the same spans.
- **2D sparse table** for static rectangle max in an n, m ≤ 500 grid: O(nm log n log m) memory; usually binary search on answer + 2D prefix sums is simpler.
- **Disjoint sparse table** gives O(1) queries for non-idempotent associative ops (sum mod p, matrix product); rarely needed below 2200.
- Sliding window with a **multiset** is O(n log n) and simpler to write when the window condition is complicated; switch to a deque only for n ≥ 10^6 or tight limits.
- Monotonic stack over **values with positions** for "nearest bigger to the left" in a stream; same idea for stock-span style problems.

## Pitfalls
- Using a sparse table for sum: overlapping blocks double count. Only idempotent operations.
- `__lg(0)` is undefined; never query an empty range.
- Wrong tie-breaking in contribution counting: using ≥ on both sides double-counts subarrays with equal maxima; using > on both sides misses them.
- Sum of subarray maxima overflow: up to n²/2 · max a; n = 2·10^5 and a ≤ 10^9 gives 2·10^19 > LLONG_MAX → need __int128 or the modulus from the statement.
- Storing values instead of indices in the stack/deque: you lose positions needed for widths and expiration.
- Sliding window: expiring with `dq.front() < i − k` (off by one) or emitting results before the first full window.
- Histogram without the final sentinel: bars left on the stack are never evaluated.
- max − min in int with values up to ±10^9 overflows; use long long.
- Sparse table of size log n × n with n = 10^6 → memory limit; also building vector<vector<>> per test in multi-test inputs is slow; reuse buffers.

## Classic Codeforces problems
- 547B Mike and Feet (1900) — span where a[i] is the minimum gives the best value for that window length; suffix max over lengths.
- 817D Imbalanced Array (1900) — Σ max − Σ min over all subarrays via monotonic stacks and contribution counting.
- 1313C2 Skyscrapers (hard version) (1900) — prefix and suffix best sums with previous-smaller links; choose the best peak.
- 1691D Max GEQ Sum (1800) — for each element's max-span, compare with the max subarray sum through it via sparse tables on prefix sums.
- 1548B Integers Have Friends (1800) — gcd of adjacent differences > 1; longest window via sparse table gcd + two pointers.
- 514D R2D2 and Droid Army (2000) — two pointers with one monotonic max-deque per detail type.
