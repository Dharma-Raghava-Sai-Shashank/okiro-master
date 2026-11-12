---
topic: Binary Search (on the Answer, on Arrays, Real-Valued)
tags: [binary search, greedy, sortings, math, two pointers]
---
# Binary Search (on the Answer, on Arrays, Real-Valued)

## Recognize it (binary search)
- "Minimize the maximum ..." or "maximize the minimum ..." — classic binary search on the answer.
- "Find the minimum time / number of operations / value x such that ..." where a larger x is always at least as good (feasibility is monotone).
- The answer is huge (up to 10^9 or 10^18) and cannot be iterated, but checking a candidate is easy (greedy in O(n)).
- "k-th smallest" of an implicit set (k-th number not divisible by n, k-th smallest pair sum): binary search x and count elements ≤ x.
- Queries "how many items can I buy with budget B" on sorted prices: prefix sums + upper_bound.
- Sorted arrays and "count values in [L, R]": lower_bound/upper_bound.
- Real-valued answer with precision 1e-6 and a monotone predicate (time until meeting, maximum radius).
- Interactive problems with ~log2(n) queries (see interactive file).
Key question: "If x works, does x+1 (or x−1) also work?" If yes, the answer is the boundary of a monotone predicate.

## Core idea (binary search on a monotone predicate)
Binary search finds the boundary between false and true of a monotone predicate P over an ordered domain (F F F ... F T T ... T). Each step halves the interval: O(log(range)) predicate evaluations.
Binary search on the answer:
1. Define P(x) = "answer ≤ x is achievable" (for minimization) — must be monotone: if P(x) then P(x+1).
2. Write check(x) usually as a greedy: given the limit x, is it possible? (E.g. "split into ≤ k segments with each sum ≤ x": scan and cut whenever the sum would exceed x.)
3. Find the smallest x with P(x) true.
4. Total cost O(check · log V), typically O(n log V) with V ≤ 2·10^18 → about 60 iterations.
Choosing bounds: lo must be a value where P is surely false (or the minimum possible answer) and hi where P is surely true. Choose hi generously (e.g. 2·10^18 if no overflow in check, otherwise a tight bound) and make check overflow-safe (cap sums, use __int128, or early exit).
Proof of monotonicity is often one sentence: "with more time you can do everything you could with less time"; "a larger maximum allowed segment sum never needs more segments".
Two equivalent templates exist: the half-open [lo, hi) style with lo < hi, and the invariant style with l always bad and r always good (while r − l > 1). Pick one and use it everywhere to avoid off-by-one errors.

## C++ template: first true / last true without off-by-one
```cpp
#include <bits/stdc++.h>
using namespace std;

// Smallest x in [lo, hi] with pred(x) == true. Requires pred monotone F..FT..T
// and pred(hi) == true (choose hi so this holds).
template <class F>
long long firstTrue(long long lo, long long hi, F pred) {
    while (lo < hi) {
        long long mid = lo + (hi - lo) / 2;      // rounds down
        if (pred(mid)) hi = mid; else lo = mid + 1;
    }
    return lo;
}

// Largest x in [lo, hi] with pred(x) == true. Requires pred T..TF..F and pred(lo) == true.
template <class F>
long long lastTrue(long long lo, long long hi, F pred) {
    while (lo < hi) {
        long long mid = lo + (hi - lo + 1) / 2;  // rounds UP, otherwise infinite loop
        if (pred(mid)) lo = mid; else hi = mid - 1;
    }
    return lo;
}

// Invariant style: l is always "bad", r is always "good"; returns the first good.
template <class F>
long long boundary(long long l, long long r, F good) {   // good(l) false, good(r) true
    while (r - l > 1) {
        long long m = l + (r - l) / 2;
        (good(m) ? r : l) = m;
    }
    return r;
}

// Minimize the maximum: split a (a[i] >= 0) into at most k contiguous parts,
// minimizing the largest part sum.
long long minMaxSplit(const vector<long long>& a, int k) {
    long long lo = *max_element(a.begin(), a.end());
    long long hi = accumulate(a.begin(), a.end(), 0LL);
    auto ok = [&](long long cap) {
        int parts = 1; long long cur = 0;
        for (long long x : a) {
            if (cur + x > cap) { parts++; cur = 0; }
            cur += x;
        }
        return parts <= k;
    };
    return firstTrue(lo, hi, ok);
}
```

## C++ template: lower_bound, upper_bound, prefix sums, real-valued search
```cpp
#include <bits/stdc++.h>
using namespace std;

// lower_bound: first element >= x; upper_bound: first element > x (sorted vector).
// Count of values in [L, R]:
int countInRange(const vector<int>& v, int L, int R) {
    return upper_bound(v.begin(), v.end(), R) - lower_bound(v.begin(), v.end(), L);
}
// Last element <= x: prev(upper_bound) if it isn't begin().
// Last element < x : prev(lower_bound) if it isn't begin().

// Max number of cheapest items purchasable with budget B:
// sort prices, build prefix sums pre[0]=0, pre[i]=sum of i cheapest; answer is
// upper_bound(pre.begin(), pre.end(), B) - pre.begin() - 1.
int maxItems(vector<long long> price, long long B) {
    sort(price.begin(), price.end());
    vector<long long> pre(price.size() + 1, 0);
    for (size_t i = 0; i < price.size(); i++) pre[i + 1] = pre[i] + price[i];
    return int(upper_bound(pre.begin(), pre.end(), B) - pre.begin()) - 1;
}

// Real-valued binary search: fixed iteration count instead of an epsilon loop.
// 100 iterations shrink the interval by 2^100, enough for any double range.
template <class F>
double realFirstTrue(double lo, double hi, F pred) {
    for (int it = 0; it < 100; it++) {
        double mid = (lo + hi) / 2;
        if (pred(mid)) hi = mid; else lo = mid;
    }
    return hi;
}
```

## Variations and tricks (binary search)
- k-th smallest of an implicit set: binary search x, count(x) = number of elements ≤ x; answer is the first x with count(x) ≥ k. Example: numbers not divisible by n up to x number x − x/n.
- Binary search on the median: "median ≥ x" ⇔ in the array b_i = (a_i ≥ x ? +1 : −1), some required segment has positive (or non-negative) sum. Converts median problems to prefix-sum problems.
- Binary search on time with a cumulative effect: "minimum k such that total damage ≥ h" where damage(k) is a sum of min(k, gap_i).
- Binary search on the number of days with a periodic movement (wind cycle): position after t days is computed in O(1) using full periods + prefix; check Manhattan distance ≤ t.
- Binary search on the answer + greedy check that is itself O(n log n) (sorting inside check) — total O(n log n log V), still fine for 2·10^5.
- Binary search on a monotone property of prefixes (first prefix where something happens), e.g. with a prefix data structure or by rebuilding in O(n).
- Parallel to two pointers: if each l has a monotone best r, two pointers remove the log.
- Ternary search for unimodal functions; on integers use the binary-search-on-slope variant: compare f(m) and f(m+1).
- Binary search over a sorted list of candidate answers (only values from the input can be the answer).
- Bitwise binary search: build the answer bit by bit from the highest bit (greedy on bits), equivalent to binary search when the predicate is monotone.
- Real-valued: when the answer is a fraction, consider searching on a rational with integer arithmetic or comparing via cross multiplication to avoid precision problems.

## Pitfalls (binary search)
- Infinite loop: using `mid = (lo + hi) / 2` with `lo = mid` (must round up in last-true search).
- Overflow in `lo + hi` for large bounds; use `lo + (hi − lo) / 2`.
- Overflow inside check: sums of n values each up to 10^18, or products like mid · a_i. Cap with `min(sum, LIMIT)`, break early once the target is reached, or use __int128.
- Wrong initial bounds: hi not actually feasible (then the search returns hi even if no answer exists — check pred(hi) separately and print −1), or lo too large (missing the answer 0).
- Non-monotone predicate: binary search silently returns garbage. Test the predicate on a small range with brute force.
- Real binary search with `while (hi − lo > eps)` can loop forever due to floating point; use a fixed number of iterations (60–100).
- lower_bound on std::set via `std::lower_bound(s.begin(), s.end(), x)` is O(n); use `s.lower_bound(x)`.
- Dereferencing lower_bound's result when it equals end().
- The predicate direction mixed up (T..TF..F vs F..FT..T).

## Classic Codeforces problems (binary search)
- 1352C K-th Not Divisible by n (1200) — binary search x with count(x) = x − x/n ≥ k, or use the closed form.
- 1613C Poisoned Dagger (1200) — binary search the poison duration k; total damage = sum of min(k, a_{i+1} − a_i) + k is monotone in k.
- 1201C Maximum Median (1400) — binary search the final median m; cost = sum over the upper half of max(0, m − a_i) must be ≤ k.
- 1760F Quests (1500) — binary search the cooldown k (or detect "Infinity"/"Impossible"); for a given k, sum the best rewards in each cycle of k+1 days greedily.
- 1730B Meeting on the Line (1600) — real-valued binary search on time T: every person i needs |x_i − x0| ≤ T − t_i, intersect intervals; or compute directly as the midpoint of extremes.
- 1661C Water the Trees (1700) — binary search the number of days for target max and max+1; count available odd (+1) and even (+2) days and check the needed parity of increments.
- 1117C Magic Ship (1900) — binary search the number of days; wind displacement is periodic so the position after d days is O(1); feasible iff Manhattan distance to target ≤ d.
- 1288D Minimax Problem (2000) — binary search the answer x; each array becomes an m-bit mask of positions ≥ x (m ≤ 8); look for two masks whose OR is full.
