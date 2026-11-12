---
topic: Sorting, Sweep Line, Events and Coordinate Compression
tags: [sortings, greedy, data structures, implementation, two pointers, binary search]
---
# Sorting, Sweep Line, Events and Coordinate Compression

## Recognize it (sorting and sweep line)
- Input is a set of intervals/segments [l_i, r_i]: overlap, union length, maximum number of simultaneously active intervals, points covered exactly k times, nesting.
- Time-based scheduling: tasks with start/end or deadlines; "minimum number of rooms/machines".
- Coordinates up to 10^9 but only n ≤ 2·10^5 distinct points matter — coordinate compression.
- The answer does not depend on the input order (a multiset) — sort first; then neighbors in sorted order are the only interesting pairs (minimum difference, grouping into chains with gap ≤ x).
- "For each element, how many others are smaller/before it" — sort + BIT, or sort by one key and sweep the other.
- Pairs of items where one dominates the other in two coordinates — sort by one coordinate, process the other with a data structure.
- "Remove one segment to maximize the intersection of the rest" — prefix/suffix aggregates after sorting or multisets.
- Counting k-subsets of intervals that share a common point — events with combinatorics.

## Core idea (sweep line with events)
Convert each interval into two events: (l, +1) "opens" and (r, −1) "closes". Sort events by coordinate and sweep left to right, maintaining the current state (number of open intervals, a multiset of active values, a sum). The answer is collected at events or between consecutive event coordinates.
Tie-breaking decides closed vs open endpoints: for closed intervals [l, r] where touching counts as overlap, process openings before closings at the same coordinate (or use the event at r+1 for integer coordinates). For half-open [l, r), process closings first.
Coordinate compression: collect all relevant coordinates, sort, unique, and replace each coordinate by its index (lower_bound). This lets you use arrays/BIT indexed by rank instead of values up to 10^9.
Sorting as the first step: sorting turns "choose any pair" into "adjacent pairs", "choose a subset" into "choose a prefix/contiguous block", and "assign items to slots" into "match in order". Sort by the key that the exchange argument suggests (end time for scheduling, start time for merging, value for grouping).
Interval merging: sort by start; extend the current block while the next start ≤ current end; otherwise close the block.
Intersection of segments: max of left ends and min of right ends; non-empty if maxL ≤ minR. Removing one segment: use multisets or prefix/suffix max/min over the segments.

## C++ template (sweep line, compression, merging, rooms)
```cpp
#include <bits/stdc++.h>
using namespace std;

// Coordinate compression.
struct Compressor {
    vector<long long> xs;
    void add(long long x) { xs.push_back(x); }
    void build() { sort(xs.begin(), xs.end()); xs.erase(unique(xs.begin(), xs.end()), xs.end()); }
    int id(long long x) const { return lower_bound(xs.begin(), xs.end(), x) - xs.begin(); }
    int size() const { return xs.size(); }
};

// Max number of closed intervals [l, r] covering a common point.
int maxOverlap(const vector<pair<long long,long long>>& seg) {
    vector<pair<long long,int>> ev;
    for (auto& [l, r] : seg) { ev.push_back({l, -1}); ev.push_back({r, +1}); }
    sort(ev.begin(), ev.end());        // at equal x, -1 (open) sorts before +1 (close)
    int cur = 0, best = 0;
    for (auto& [x, t] : ev) { cur -= t; best = max(best, cur); }
    return best;
}

// For k = 1..n: number of integer points covered by exactly k closed segments.
vector<long long> coveredExactly(const vector<pair<long long,long long>>& seg) {
    int n = seg.size();
    vector<pair<long long,int>> ev;
    for (auto& [l, r] : seg) { ev.push_back({l, +1}); ev.push_back({r + 1, -1}); }
    sort(ev.begin(), ev.end());
    vector<long long> cnt(n + 1, 0);
    int cur = 0;
    for (size_t i = 0; i < ev.size(); i++) {
        if (i > 0) cnt[cur] += ev[i].first - ev[i - 1].first;  // points in [prev, this)
        cur += ev[i].second;
    }
    return cnt;                           // cnt[k] for k >= 1
}

// Merge overlapping closed intervals.
vector<pair<long long,long long>> mergeIntervals(vector<pair<long long,long long>> s) {
    sort(s.begin(), s.end());
    vector<pair<long long,long long>> out;
    for (auto& [l, r] : s) {
        if (!out.empty() && l <= out.back().second) out.back().second = max(out.back().second, r);
        else out.push_back({l, r});
    }
    return out;
}

// Minimum number of rooms for half-open meetings [s, e): heap of end times.
int minRooms(vector<pair<long long,long long>> m) {
    sort(m.begin(), m.end());
    priority_queue<long long, vector<long long>, greater<long long>> ends;
    for (auto& [s, e] : m) {
        if (!ends.empty() && ends.top() <= s) ends.pop();   // reuse a room
        ends.push(e);
    }
    return ends.size();
}
```

## Variations and tricks (sweep line and sorting)
- Count k-subsets of segments with a common point: sweep events; when a segment opens and c segments are already open, it is the latest-starting segment of C(c, k−1) such subsets (count each subset at its last opening). Sort openings before closings at equal coordinates for closed segments.
- Nested segments: sort by left ascending and right descending; then segment i contains segment i+1 iff r_i ≥ r_{i+1}; keep the running max right end to find any nested pair.
- Intersection after removing one segment: precompute prefix and suffix max of l and min of r; for each i combine prefix (i−1) and suffix (i+1).
- Grouping sorted values into chains with gap ≤ x and k free insertions: sort the gaps that exceed x by the number of insertions needed (ceil(gap / x) − 1), close the cheapest first.
- Sweep over x with a multiset of active y-values for 2D problems (rectangles union length, closest pair).
- Sort queries offline together with data (offline processing): answer queries sorted by threshold while adding elements in sorted order (e.g. with DSU or BIT).
- Sort + prefix sums for "can element i win if it absorbs all smaller elements": sorted prefix sum ≥ next element; the set of winners is a suffix.
- Sort by one coordinate, BIT over the compressed other coordinate to count dominated pairs or inversions.
- Two-key sorts via tuples or comparator lambdas; use stable_sort when the original order among equal keys matters.
- Angular sweep: sort points by angle (atan2 or cross product) around a center.
- Events with types at the same time: define a precise order (e.g. arrivals before departures, queries between).

## Pitfalls (sorting and sweep line)
- Wrong tie-breaking at equal coordinates: closed vs half-open intervals change whether touching segments overlap.
- Using r instead of r+1 for the closing event of an integer closed interval when counting points.
- Comparator with `<=`, or inconsistent comparator (not a strict weak ordering) → RE or wrong order.
- Forgetting to sort queries with their original index to output answers in input order.
- Compression with duplicates not removed (unique + erase), or forgetting to include query coordinates in the compressed set.
- Overflow in lengths/union sizes (coordinates up to 10^9, sums up to 2·10^14).
- Sorting large structs by value repeatedly (cost); sort indices or pairs instead.
- Assuming merged intervals with integer coordinates: [1,2] and [3,4] are adjacent but not overlapping; decide whether they should merge (l ≤ end + 1 for integer points).

## Classic Codeforces problems (sorting and sweep line)
- 1539C Stable Groups (1200) — sort; gaps larger than x split groups; each gap needs ⌈gap/x⌉ − 1 extra students; close the cheapest gaps first with the k extras.
- 1490E Accidental Victory (1400) — sort tokens; a player can win iff from his position every prefix sum is ≥ the next value; winners form a suffix of the sorted order.
- 976C Nested Segments (1500) — sort by left ascending, right descending; a segment is nested in an earlier one when its right end ≤ the max right end seen.
- 1029C Maximal Intersection (1600) — remove each segment in turn; intersection = min of other rights − max of other lefts using prefix/suffix aggregates (or multisets).
- 1000C Covered Points Count (1700) — events at l (+1) and r+1 (−1); accumulate the lengths between consecutive event coordinates per current coverage count.
- 1420D Rescue Nibel! (1800) — sweep events with openings before closings; when a lamp turns on with c lamps already on, add C(c, k−1).
