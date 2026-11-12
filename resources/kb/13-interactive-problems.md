---
topic: Interactive Problems
tags: [interactive, binary search, constructive algorithms, math, brute force]
---
# Interactive Problems

## Recognize it (interactive problems)
- The statement has an "Interaction" section: you print queries ("? i j") and read the judge's responses; you print the final answer ("! x").
- A strict query limit: about log2(n) queries (e.g. 20 for n = 10^6, 30 for 10^9, 60 for 10^18) → binary search; 2n or n + c queries → one or two queries per element; a fixed small number (4, 3) for small hidden objects → brute force over all candidate objects consistent with answers.
- Tags "interactive" and "binary search" appear together very often (1300–2000).
- The judge may be adaptive (the hidden object can change as long as it stays consistent with previous answers) — your strategy must work in the worst case, not on average.
- Multiple test cases in one interaction: you read the next test's input after printing "!" for the previous one.

## Core idea (interactive problems)
1. IO protocol: after every query and after the final answer, flush the output. In C++: `cout << "? " << i << endl;` (endl flushes) or `cout << ... << '\n' << flush;` or `cout.flush()`; with printf use `fflush(stdout)`. Forgetting to flush gives "Idleness limit exceeded".
2. Error handling: when you exceed the limit or ask an invalid query, the judge typically answers −1. Exit immediately on −1 (return from main) to get "Wrong answer" instead of an undefined verdict.
3. Information budget: each query gives some number of bits of information. With limit ≈ log2(n), each query must halve the candidate set → binary search on a monotone property, or ask about a prefix/half.
4. Design the strategy offline: write down what each response means for the candidate set, check the worst-case number of queries exactly (log2 rounding, extra queries for initialization), and count them against the limit with an explicit counter.
5. Use the structure of responses: comparisons (which is larger), sums over ranges (count of something in a prefix), positions (index of the second maximum), modulo values (p_i mod p_j reveals the smaller of the two).
6. Small hidden objects: enumerate all candidates (permutations of 6 values, all pairs) and keep only those consistent with every response; choose queries that split the candidate set evenly.
7. Do not use fast IO tricks that break flushing (cin.tie(nullptr) is fine as long as you flush manually; never rely on automatic flushing).

## C++ template (interactive)
```cpp
#include <bits/stdc++.h>
using namespace std;

int queriesUsed = 0;

// Ask a range query and read the judge's integer reply; exit on -1.
long long ask(int l, int r) {
    queriesUsed++;
    cout << "? " << l << " " << r << endl;       // endl flushes
    long long res;
    if (!(cin >> res) || res == -1) exit(0);      // limit exceeded / invalid query
    return res;
}

void answer(long long x) {
    cout << "! " << x << endl;
}

// Example: hidden binary array of length n; ask(l, r) returns the sum on [l, r].
// Find the position of the k-th zero with ~log2(n) queries.
int kthZero(int n, int k) {
    int lo = 1, hi = n;                           // answer in [lo, hi]
    while (lo < hi) {
        int mid = (lo + hi) / 2;
        long long zeros = mid - ask(1, mid);      // zeros in [1, mid]
        if (zeros >= k) hi = mid; else lo = mid + 1;
    }
    return lo;
}

int mainInteractive() {      // rename to main() in the real solution
    int t; cin >> t;
    while (t--) {
        int n, k; cin >> n >> k;
        answer(kthZero(n, k));
    }
    return 0;
}
```

## Testing interactive solutions locally (interactive problems)
- Manual testing: run the program and type the judge's responses by hand for a small hidden object; good for checking the protocol format.
- Write a local interactor: a program that knows the hidden object, reads queries from the solution, answers them, counts queries, and checks the final answer. Connect both programs with two pipes.
- Simplest way without pipes tooling: put the interactor logic inside the solution behind `#ifdef LOCAL` — replace `ask()` with a function that computes the answer from a randomly generated hidden object and asserts the query count. This lets you stress-test thousands of hidden objects in one run, including adversarial ones (all zeros, the answer at position 1 or n).
- With pipes (Linux/macOS): `mkfifo f; ./interactor < f | ./sol > f` — the interactor's stdout goes to the solution's stdin and vice versa. Make both programs flush.
- Python helper alternative: many contestants keep a small script that spawns both processes and relays lines.
- Always test the maximum-n case for query count (e.g. n = 10^6 needs ⌈log2 n⌉ = 20 queries; if the limit is 20 and you use one extra initialization query, you fail).
- Test that you read all judge output for each test case before moving to the next (multi-test interaction desynchronizes otherwise).

## Common patterns (interactive problems)
- Binary search over a prefix: "sum on [1, mid]" or "does [1, mid] contain the special item?" → halve the range per query (k-th zero, heavy stone among piles via prefix-sum comparisons).
- Binary search guided by one anchor answer: first find a reference (e.g. position s of the second maximum of the whole array), then ask [1, s] or [s, n] to learn on which side the maximum lies, then binary search on that side using queries that include s.
- Pairwise queries in both directions: p_i mod p_j vs p_j mod p_i — the larger reply equals the smaller of the two values; resolve one value per two queries, leaving the maximum n at the end.
- Odd/even counting: if exactly one element is special and the others pair up, count elements in [l, mid] that "belong" to [l, mid]; odd count means the special one is there.
- Brute force consistency: for a hidden permutation of a known small set, ask a few product/sum queries and test all permutations for consistency.
- Comparisons tournament: find max with n−1 comparisons; max and min with 3n/2; second max with n + log n.
- Adaptive judges: the answer must be forced by the responses; never guess between two consistent candidates.
- Ternary-like splits: when a query returns one of three outcomes, split into thirds (log3).
- Query reuse: cache answers in a map to avoid repeated queries.
- Guess-the-number style with "too high/too low" → standard binary search with careful bounds (1..n inclusive).

## Pitfalls (interactive problems)
- Missing flush → Idleness limit exceeded.
- Printing debug output to stdout (corrupts the protocol); use stderr.
- Not exiting on −1, leading to reading garbage and hanging.
- Off-by-one in the query count: count queries exactly for the worst case (⌈log2 n⌉, not ⌊⌋) plus any setup queries.
- Asking invalid queries (l > r, l = r when the problem requires l < r, indices out of range) when the binary search interval shrinks to size 1 — handle small ranges explicitly.
- Forgetting the "!" prefix or the exact output format of the answer.
- Reading the next test case's input before printing the answer for the current one.
- Assuming a fixed hidden object when the judge is adaptive.
- Using scanf/printf mixed with cin/cout after `ios::sync_with_stdio(false)`.

## Classic Codeforces problems (interactive)
- 1807E Interview (1300) — binary search over piles: ask the total weight of a prefix of piles and compare with the prefix's stone count to locate the pile holding the heavier stone.
- 1167B Lost Numbers (1400) — ask four products of adjacent positions, then try all 720 permutations of {4, 8, 15, 16, 23, 42} for consistency.
- 1520F1 Guess the K-th Zero (Easy version) (1600) — binary search on prefixes: zeros in [1, mid] = mid − sum; ≤ 20 queries.
- 1407C Chocolate Bunny (1600) — query (i, j) and (j, i); the larger remainder is the smaller value and is fixed; n−1 values in 2(n−1) queries, the last unknown is n.
- 1698D Fixed Point Guessing (1600) — elements are swapped in disjoint pairs except one fixed point; in [l, mid] count values that lie in [l, mid]; an odd count means the fixed point is in the left half.
- 1486C2 Guessing the Greatest (hard version) (1900) — find the second maximum position s of the whole array, decide the side of the maximum with one query, then binary search on that side with queries that always include s.
