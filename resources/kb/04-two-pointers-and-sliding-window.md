---
topic: Two Pointers and Sliding Window
tags: [two pointers, sortings, binary search, data structures, greedy, implementation]
---
# Two Pointers and Sliding Window

## Recognize it (two pointers / sliding window)
- "Longest/shortest subarray (contiguous segment) such that ..." where the condition is monotone: if [l, r] is good then every sub-segment is good (or every super-segment is good).
- "Count subarrays with sum ≤ S / at most k distinct values / max − min ≤ d" with non-negative values or a monotone measure.
- Pairs in a sorted array: "count pairs with a_i + a_j ≤ X", "closest pair sum", "pairs with difference ≥ d".
- Merging two sorted sequences, or matching elements of two sorted arrays (smallest with smallest).
- n up to 2·10^5 and a naive O(n^2) over all (l, r) pairs; the intended O(n) or O(n log n) comes from moving l and r only forward.
- Fixed-length window statistics: sum, count of a character, min/max over every window of length k.
- Circular arrays: double the array (concatenate it with itself) and use a window of length ≤ n.
Key test: as r increases, does the best (or smallest valid) l never decrease? If yes, two pointers apply.

## Core idea (two pointers)
Two pointers exploit monotonicity to replace a nested loop with two indices that each move at most n times, giving O(n) amortized.
- Sliding window with a monotone condition: for every right end r, maintain the smallest l such that [l, r] is valid. When r advances, the window only becomes "worse" (more elements), so l only moves right. The number of valid windows ending at r is r − l + 1 (when validity is closed under taking sub-segments).
- Opposite-ends pointers on a sorted array: i from the left, j from the right; if a[i] + a[j] > X then a[j] is too big for every i' ≥ i, so decrement j; otherwise every j' ≤ j works with i, so count j − i pairs and increment i.
- Same-direction pointers on two sorted arrays (merge, matching, intersection).
- The window needs an add(x) and remove(x) in O(1) or O(log n): running sum, frequency array with a distinct counter, multiset for min/max, or a monotonic deque for min/max.
- Equivalent to binary search per r (because of monotonicity), but without the log factor. If you cannot see the pointer logic, binary search on prefix sums is a valid fallback.
- "Exactly k" counts: count(at most k) − count(at most k − 1).
Proof obligation: show validity is monotone (sub-segment of valid is valid, or super-segment of valid is valid). Negative numbers break "sum ≤ S" monotonicity — then use prefix sums + sorted structure instead.

## C++ template (two pointers and sliding window)
```cpp
#include <bits/stdc++.h>
using namespace std;

// Longest subarray with sum <= S, all a[i] >= 0.
int longestSumAtMost(const vector<long long>& a, long long S) {
    int n = a.size(), best = 0, l = 0; long long sum = 0;
    for (int r = 0; r < n; r++) {
        sum += a[r];
        while (l <= r && sum > S) sum -= a[l++];
        best = max(best, r - l + 1);          // window may be empty if a[r] > S
    }
    return best;
}

// Number of subarrays with at most k distinct values (values in [0, V)).
long long countAtMostKDistinct(const vector<int>& a, int k, int V) {
    vector<int> freq(V, 0);
    long long res = 0; int distinct = 0, l = 0;
    for (int r = 0; r < (int)a.size(); r++) {
        if (freq[a[r]]++ == 0) distinct++;
        while (distinct > k) if (--freq[a[l++]] == 0) distinct--;
        res += r - l + 1;                      // all windows [l..r], [l+1..r], ..., [r..r]
    }
    return res;
}

// Count pairs i < j with a[i] + a[j] <= X in a sorted array.
long long countPairsSumAtMost(vector<long long> a, long long X) {
    sort(a.begin(), a.end());
    long long res = 0; int i = 0, j = (int)a.size() - 1;
    while (i < j) {
        if (a[i] + a[j] <= X) { res += j - i; i++; }
        else j--;
    }
    return res;
}

// Minimum of every window of length k (monotonic deque of indices).
vector<long long> slidingMin(const vector<long long>& a, int k) {
    deque<int> dq; vector<long long> out;
    for (int i = 0; i < (int)a.size(); i++) {
        while (!dq.empty() && a[dq.back()] >= a[i]) dq.pop_back();
        dq.push_back(i);
        if (dq.front() <= i - k) dq.pop_front();
        if (i >= k - 1) out.push_back(a[dq.front()]);
    }
    return out;
}
```

## Variations and tricks (two pointers)
- Shortest window containing all required items (e.g. all three characters '1','2','3'): for each r, advance l while the window stays valid; record r − l + 1.
- Window max − min ≤ d: maintain two monotonic deques (one for max, one for min), or a multiset.
- Counting with "exactly": exactly(k) = atMost(k) − atMost(k − 1).
- Sorted-array counting with l/r: number of pairs with sum in [L, R] = countAtMost(R) − countAtMost(L − 1).
- Close tuples: after sorting, for each left end i, find the farthest j with a[j] − a[i] ≤ k (pointer moves right), then choose the other m − 1 elements among (i, j]: C(j − i, m − 1).
- Two groups with different costs (e.g. cost 1 and cost 2 items): sort each group descending, prefix sums; iterate how many you take from group A, move a pointer on group B backwards as A grows.
- Circular windows: duplicate the array and restrict window length to ≤ n.
- Window with "at most k changes" (longest segment of equal characters after k replacements): window valid while (length − max frequency) ≤ k, or count of zeros ≤ k for binary arrays.
- Reverse-direction greedy matching: is s a subsequence of t — one pointer on each, advance in t always, advance in s on match.
- Prefix/suffix matching: for "remove a substring so t remains a subsequence", compute the earliest match positions for every prefix and the latest for every suffix, then combine (pointer pairs).
- Meet-in-the-middle sums: sort both halves' subset sums and use two pointers to count pairs.

## Pitfalls (two pointers)
- Applying the sum-window to arrays with negative numbers: monotonicity fails. Use prefix sums with a map (exact sum) or a sorted structure.
- Forgetting that l may exceed r (empty window) — guard with `l <= r` or allow empty windows explicitly.
- Counting pairs with i == j or counting each unordered pair twice.
- The deque storing values instead of indices, losing the ability to expire old elements.
- Recomputing the window statistic from scratch inside the loop (turns O(n) into O(n^2)).
- Resetting the frequency array per test with a global size (TLE in multitest); undo only what you added.
- Off-by-one in window length: length = r − l + 1 for inclusive bounds.
- Overflow in "number of subarrays" counts — up to n(n+1)/2 ≈ 2·10^10, use long long.
- Using two pointers when the condition is not monotone; prove it, or fall back to binary search per element.

## Classic Codeforces problems (two pointers)
- 1354B Ternary String (1200) — shortest window containing '1', '2' and '3': slide r, shrink l while all three counts stay positive.
- 279B Books (1400) — longest window with total reading time ≤ t, non-negative times, classic sum window.
- 1324D Pair of Topics (1400) — set c_i = a_i − b_i, sort, count pairs with c_i + c_j > 0 using opposite-end pointers (or binary search).
- 1462E2 Close Tuples (hard version) (1700) — sort; for each minimum position i, a pointer finds the last j with a_j − a_i ≤ k; add C(j − i, m − 1) mod 1e9+7.
- 1611F ATM and Students (1800) — longest segment where starting balance s plus every prefix sum stays ≥ 0; move l right while the window's minimum prefix fails (sparse table, deque, or segment tree for min).
- 1358D The Best Vacation (1900) — double the months; the optimal x-day window ends at the end of a month; slide a window over months, cutting the partial first month greedily.
