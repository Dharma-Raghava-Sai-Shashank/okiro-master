---
topic: Greedy Algorithms and the Exchange Argument
tags: [greedy, sortings, data structures, constructive algorithms, implementation]
---
# Greedy Algorithms and the Exchange Argument

## Recognize it (greedy)
Signals that a Codeforces problem has a greedy solution:
- n up to 2·10^5 and the problem asks for a maximum/minimum, but DP state would be too large; an O(n log n) sort-based answer is expected.
- "Choose items/intervals/tasks to maximize count or profit" with deadlines, capacities, or a budget.
- The order of processing is free (you may reorder), suggesting sort by some key.
- Locally, there is an obviously "safe" move: take the smallest, the earliest-ending, the largest, the cheapest per unit.
- Small examples by brute force always agree with a simple rule.
- Lexicographically smallest/largest answer: build position by position, choosing the best character that still allows completion.
- Problems tagged greedy at 1200–1800 are very often "sort + one pass" or "sort + priority queue".
Danger signals (greedy likely wrong, consider DP): choices have long-range interactions, small counterexamples break every simple rule, n ≤ 5000 (suggests O(n^2) DP).

## Core idea (greedy and exchange argument)
A greedy algorithm makes the locally best choice and never revisits it. It is correct only if you can prove that some optimal solution agrees with each greedy choice.
Proof tools:
- Exchange argument: take any optimal solution O. Find the first place where O differs from the greedy solution G. Modify O by swapping elements so that it agrees with G at that place, and show the objective does not get worse. By induction, G is optimal.
- Adjacent swap for orderings: if the answer is an ordering, compare two adjacent items i, j. Compute the cost difference between "i before j" and "j before i"; this yields the comparator. Example: minimizing sum of weighted completion times sum(w_i · C_i) — i before j is better iff t_i · w_j < t_j · w_i, so sort by t/w (compare by cross multiplication to avoid floating point).
- Greedy stays ahead: show by induction that after k steps, the greedy's measure (e.g. end time of the last chosen interval) is at least as good as any solution's after k steps.
- Regret (undo) greedy: take every option tentatively and keep them in a heap; when a constraint breaks, drop the worst taken item. Correct when dropping the worst item always restores feasibility at minimum loss.
- Matroid-like structure: if feasible sets are "independent sets" (e.g. tasks schedulable by deadline), processing by decreasing value and keeping if still feasible is optimal.
Always test the greedy against a brute force on random small inputs before submitting; greedy WA is the most common failure mode at 1400–1800.

## C++ template: interval scheduling and exchange-sorted ordering (greedy)
```cpp
#include <bits/stdc++.h>
using namespace std;

// Max number of pairwise non-overlapping intervals [l, r] (closed).
// Greedy: sort by right end, take an interval if it starts after the last taken end.
int maxDisjoint(vector<pair<long long,long long>> seg) {
    sort(seg.begin(), seg.end(), [](auto& a, auto& b) { return a.second < b.second; });
    int cnt = 0; long long lastEnd = LLONG_MIN;
    for (auto& [l, r] : seg) if (l > lastEnd) { cnt++; lastEnd = r; }
    return cnt;
}

// Exchange-argument comparator: minimize sum of w_i * C_i (C_i = completion time).
// i before j iff t_i * w_j < t_j * w_i. Use __int128 if t, w can reach 1e9+.
struct Job { long long t, w; };
long long minWeightedCompletion(vector<Job> jobs) {
    sort(jobs.begin(), jobs.end(), [](const Job& a, const Job& b) {
        return (__int128)a.t * b.w < (__int128)b.t * a.w;
    });
    long long time = 0, cost = 0;
    for (auto& j : jobs) { time += j.t; cost += j.w * time; }
    return cost;
}
```

## C++ template: regret greedy with a priority queue
```cpp
#include <bits/stdc++.h>
using namespace std;

// Unit-time jobs, job i has deadline d_i (>=1) and profit p_i; one job per time slot.
// Maximize total profit: sort by deadline, push profit into a min-heap;
// if the heap holds more jobs than the current deadline allows, drop the cheapest.
long long maxProfitDeadlines(vector<pair<long long,long long>> jobs) { // {deadline, profit}
    sort(jobs.begin(), jobs.end());
    priority_queue<long long, vector<long long>, greater<long long>> taken;
    long long sum = 0;
    for (auto& [d, p] : jobs) {
        taken.push(p); sum += p;
        if ((long long)taken.size() > d) { sum -= taken.top(); taken.pop(); }
    }
    return sum;
}

// Same pattern, prefix-feasibility version (CF 1526C2 Potions): drink everything,
// and whenever health goes negative, undo the most negative drink taken so far.
int maxDrinks(const vector<long long>& a) {
    priority_queue<long long, vector<long long>, greater<long long>> neg;
    long long health = 0; int cnt = 0;
    for (long long x : a) {
        health += x; cnt++;
        if (x < 0) neg.push(x);
        if (health < 0) { health -= neg.top(); neg.pop(); cnt--; }
    }
    return cnt;
}
```

## Variations and tricks (greedy)
- Sort + two choices per element: process elements in sorted order and give each the best still-available option (e.g. try value−1, value, value+1 in that order).
- Fix one parameter, greedy on the rest: fix the minimum beauty (iterate in decreasing beauty order) and keep the k largest lengths in a min-heap (Playlist pattern).
- Pair smallest with largest: to minimize the maximum pair sum, sort and pair a[i] with a[n−1−i].
- Lexicographic greedy: for each position choose the smallest character such that the remaining suffix can still be completed (requires a fast feasibility check, often counts).
- Merge greedy: when only elements of different classes may swap, each class keeps its internal order; merge the class sequences taking the smaller head (like merge sort).
- Greedy from the end: process from right to left when the decision for the last element is forced.
- Greedy by largest first: placing big items first leaves flexibility (bin-like problems, "fill to at least half capacity").
- Count-based greedy: when values are tiny (≤ 100), keep a frequency array and greedily remove the largest values first.
- Threshold trick: "make all values ≥ x" — count the deficit; greedy by cheapest cost per unit.
- Heap simulation: repeatedly pick the max (or min) and update — O(n log n).
- Prove with a potential function: show each greedy step increases the potential by the maximum possible.

## Pitfalls (greedy)
- Submitting an unproven greedy. Before coding, try 3–5 element counterexamples: equal values, one huge value, alternating patterns.
- Sorting by the wrong key or with ties broken badly; ties often matter (sort by end, then by start).
- Comparators with floating point ratios (precision) — use cross multiplication with long long or __int128.
- Comparators that are not strict weak orderings (`<=`), causing RE or wrong order.
- Assuming "take the best now" when a later item needs the resource more — typical fix: regret greedy with a heap, or DP.
- Greedy for knapsack-like problems with arbitrary weights is wrong; it works only with special structure (unit weights, divisible sizes, fractional items).
- Forgetting that the greedy must also handle the "impossible" output.
- Overflow in accumulated costs (sum of w·C up to 10^18+).
- In "minimize operations" greedy, double-counting operations that fix two positions at once.

## Classic Codeforces problems (greedy)
- 1343C Alternating Subsequence (1200) — split the array into maximal same-sign blocks; take the maximum of each block, which maximizes both length and sum.
- 1446A Knapsack (1300) — if an item fits in [⌈W/2⌉, W] take it alone; otherwise all usable items are < W/2, so add them one by one until the sum reaches ⌈W/2⌉, never overshooting W.
- 1369C RationalLee (1400) — sort; each friend gets one of the k largest as their max (friends with w = 1 get it counted twice); friends with larger w take the smallest values as their min, assigned from the front in decreasing w.
- 1203E Boxers (1500) — sort ascending and assign each boxer the smallest unused weight among a−1, a, a+1 (positive); greedy keeps future options open.
- 1251C Minimize The Integer (1600) — digits of different parity can swap, so odd and even digits keep their relative order; merge the two sequences taking the smaller head.
- 1526C2 Potions (Hard Version) (1600) — drink everything left to right; when health goes negative, undo the most negative drink taken so far using a min-heap (regret greedy).
- 1140C Playlist (1600) — iterate songs by decreasing beauty (fixing the minimum), keep the k largest lengths in a min-heap, maximize sum × current beauty.
