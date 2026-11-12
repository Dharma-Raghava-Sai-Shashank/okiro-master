---
topic: Prefix Sums and Difference Arrays
tags: [implementation, data structures, math, dp, brute force, two pointers, greedy]
---
# Prefix Sums and Difference Arrays

## Recognize it (prefix sums)
- Many queries "sum (or count, or xor) of a[l..r]" with no updates — O(1) per query after O(n) precompute.
- "Count subarrays whose sum equals k / is divisible by m / has equal number of 0s and 1s" — prefix sums plus a frequency map.
- Many range updates "add v to a[l..r]" followed by reading the final array — difference array.
- Grid queries "sum of a sub-rectangle" — 2D prefix sums; many rectangle increments — 2D difference array.
- Bracket sequences, balance of characters, "#A − #B" over a substring — prefix balance of a ±1 array.
- "Remove/ignore a segment [l, r]" queries — combine prefix information (up to l−1) with suffix information (from r+1).
- Subarray conditions rewritten as p[r] − p[l−1] relation, then "fix r and count l".
- Per-letter counts over substrings for strings: 26 prefix arrays.
- Counting how many intervals cover each point (sweep with +1 at start, −1 after end).

## Core idea (prefix sums and difference arrays)
Prefix sum p[i] = a[1] + ... + a[i], p[0] = 0. Then sum(l..r) = p[r] − p[l−1]. Any associative-and-invertible operation works the same way: xor (prefix xor, x(l..r) = px[r] ^ px[l−1]), addition mod m, counts. Non-invertible operations (min, max, gcd) only give prefix/suffix answers, not arbitrary ranges (use sparse tables for those).
Subarray counting: a subarray (l, r] corresponds to a pair of prefix indices l < r. A condition on its sum becomes a condition on the pair (p[l], p[r]): sum = k ⇔ p[l] = p[r] − k. Scan r, keep a map of counts of earlier p[l], add cnt[p[r] − k]. Variants: sum ≡ 0 mod m ⇔ p[l] ≡ p[r] (mod m); "sum equals length" ⇔ (p[r] − r) = (p[l] − l) after subtracting 1 from each element.
Difference array: d[i] = a[i] − a[i−1]. Adding v to a[l..r] becomes d[l] += v, d[r+1] −= v. After all updates, a = prefix sum of d. O(1) per update, O(n) to rebuild. Two-level difference (difference of difference) handles adding arithmetic progressions.
2D: P[i][j] = sum of a[1..i][1..j]; rectangle sum = P[x2][y2] − P[x1−1][y2] − P[x2][y1−1] + P[x1−1][y1−1]. 2D difference: add at (x1,y1), subtract at (x1,y2+1) and (x2+1,y1), add at (x2+1,y2+1), then 2D prefix sum.
Prefix min/max: best subarray sum ending at r = p[r] − min(p[0..r−1]). Maximum subarray sum (Kadane) is this.

## C++ template (prefix sums, difference arrays, 2D)
```cpp
#include <bits/stdc++.h>
using namespace std;

// 1D prefix sums, 1-indexed queries: sum(l..r) = p[r] - p[l-1].
vector<long long> prefix(const vector<long long>& a) {         // a is 0-indexed
    vector<long long> p(a.size() + 1, 0);
    for (size_t i = 0; i < a.size(); i++) p[i + 1] = p[i] + a[i];
    return p;
}

// Range add via difference array: ops are (l, r, v) with 0-indexed inclusive bounds.
vector<long long> applyRangeAdds(int n, const vector<array<long long,3>>& ops) {
    vector<long long> d(n + 1, 0);
    for (auto& [l, r, v] : ops) { d[l] += v; d[r + 1] -= v; }
    vector<long long> a(n);
    long long run = 0;
    for (int i = 0; i < n; i++) { run += d[i]; a[i] = run; }
    return a;
}

// Number of subarrays with sum exactly k (works with negative values).
long long countSumK(const vector<long long>& a, long long k) {
    map<long long, long long> cnt;  // or sorted vector / hashed map with custom hash
    cnt[0] = 1;
    long long p = 0, res = 0;
    for (long long x : a) {
        p += x;
        auto it = cnt.find(p - k);
        if (it != cnt.end()) res += it->second;
        cnt[p]++;
    }
    return res;
}

// Maximum subarray sum using prefix minimum (non-empty subarray).
long long maxSubarray(const vector<long long>& a) {
    long long p = 0, minPref = 0, best = LLONG_MIN;
    for (long long x : a) {
        p += x;
        best = max(best, p - minPref);
        minPref = min(minPref, p);
    }
    return best;
}

// 2D prefix sums over an n x m grid (1-indexed P).
struct Prefix2D {
    vector<vector<long long>> P;
    Prefix2D(const vector<vector<long long>>& g) {
        int n = g.size(), m = n ? g[0].size() : 0;
        P.assign(n + 1, vector<long long>(m + 1, 0));
        for (int i = 1; i <= n; i++)
            for (int j = 1; j <= m; j++)
                P[i][j] = g[i-1][j-1] + P[i-1][j] + P[i][j-1] - P[i-1][j-1];
    }
    long long query(int x1, int y1, int x2, int y2) const {      // 1-indexed inclusive
        return P[x2][y2] - P[x1-1][y2] - P[x2][y1-1] + P[x1-1][y1-1];
    }
};
```

## Variations and tricks (prefix sums)
- Prefix XOR: x(l..r) = px[r] ^ px[l−1]. Count subarrays with xor k: map of prefix xors, add cnt[px ^ k]. Subarray xor is zero ⇔ two equal prefix xors.
- Shift trick for "sum equals length": subtract 1 from each element, then count zero-sum subarrays (pairs of equal prefix sums).
- Pairs of equal prefix sums are "bad" (zero-sum subarray). To make no subarray sum to zero with minimum insertions, scan with a set of seen prefix sums; when the current prefix repeats, insert a separator before this element and restart the set with {0, current element}.
- Difference array over the answer space: for each constraint, mark a range of x values where the cost is c using d[lo] += c, d[hi+1] −= c; then scan x to find the best. Used when the cost as a function of a global parameter is piecewise constant.
- Counting coverage: number of intervals covering each point = prefix sum of +1 at l, −1 at r+1.
- Prefix and suffix min/max for "ignore segment [l, r]" queries: answer combines pre[l−1] and suf[r+1] (shifted by the net effect of the prefix).
- Per-character prefix counts: cnt[c][i] for 26 letters, O(26n) memory — use int and consider memory.
- Prefix sums of prefix sums: sum over all subarrays, or adding linear functions via two-level difference arrays.
- Modular prefix: subarray sum divisible by m ⇔ p[l] ≡ p[r] (mod m); count pairs per residue (normalize negatives).
- Prefix sums on sorted arrays: cost to raise all elements in a range to value x = x · len − sum(range), O(1) per query; combined with binary search.
- 2D prefix on value-space: when coordinates are small (≤ 1000), accumulate counts/weights at (h, w) and answer rectangle queries in O(1).
- Prefix sums over a tree path: value from root to node; path sum u–v = s[u] + s[v] − 2·s[lca] + a[lca].

## Pitfalls (prefix sums)
- Off-by-one between 0- and 1-indexed: use p of size n+1 and p[0] = 0 consistently.
- Overflow: prefix sums of 2·10^5 values up to 10^9 need long long.
- Forgetting cnt[0] = 1 (the empty prefix) when counting subarrays.
- Difference array of size n instead of n+1 (writing d[r+1] at r = n−1 goes out of bounds).
- Using unordered_map for prefix counts on Codeforces without a custom hash (anti-hash tests); prefer map or coordinate compression.
- 2D prefix memory: a 5000×5000 long long table is 200 MB.
- Negative modulo when grouping prefix sums by residue: use ((p % m) + m) % m.
- Assuming min/max/gcd are invertible like sums (they are not; use sparse tables or segment trees for arbitrary ranges).
- In multitest, resetting a global difference array over its full capacity every test.

## Classic Codeforces problems (prefix sums)
- 295A Greg and Array (1400) — two levels of difference arrays: first count how many times each operation is applied (from the queries), then apply operations with a difference array on a.
- 1426D Non-zero Segments (1500) — a zero-sum subarray exists iff two prefix sums repeat; greedily insert a separator whenever the current prefix sum was already seen and reset the set.
- 1398C Good Subarrays (1600) — subtract 1 from each digit; good subarrays are pairs of equal prefix sums; count with a map.
- 1722E Counting Rectangles (1600) — h, w ≤ 1000: accumulate areas into a 1000×1000 grid and answer each query with a 2D prefix sum over the strict interior (h_s, h_b) × (w_s, w_b).
- 1343D Constant Palindrome Sum (1700) — for each mirrored pair, the number of replacements as a function of target x is 0, 1, or 2 on ranges; accumulate with a difference array and take the minimum over x.
- 1473D Program (1700) — distinct values = max − min + 1; combine prefix min/max of the walk up to l−1 with suffix min/max after r, shifted to start from the prefix value at l−1.
