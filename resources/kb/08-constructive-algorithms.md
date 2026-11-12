---
topic: Constructive Algorithms
tags: [constructive algorithms, greedy, math, implementation, brute force, bitmasks, sortings]
---
# Constructive Algorithms

## Recognize it (constructive algorithms)
- "Construct / output any array, permutation, string, matrix, or graph that satisfies ..." and "if there are multiple answers, print any".
- "Output −1 (or NO) if it is impossible" — you must find the exact condition for existence and a construction for every case where it holds.
- "Perform at most n (or 2n, or 3n) operations to transform a into b" — the bound hints at the construction (one operation per element, or two per element).
- Very common in Div2 A–C (800–1700); at 1800–2000 the construction usually needs a clever invariant or a recursive/inductive idea.
- Small n samples with strange-looking outputs: the sample answer is often just one of many; do not try to match it.
- Constraints like n up to 10^5 but the answer structure is regular (alternating, sorted, reversed, blocks).

## Core idea (constructive algorithms)
A constructive solution has two halves: a necessary condition (why −1 in the impossible cases) and a construction proving the condition is sufficient.
Workflow:
1. Find obvious necessary conditions: parity, sum, counts, n too small, distinct value counts, invariants of allowed operations.
2. Solve small n by hand or by brute force (search all permutations/arrays for n ≤ 8) and print any valid answers. Look for a structure that extends: alternating, sorted then reversed, odd numbers then even numbers, blocks of size k repeated.
3. Start from the structure of the answer: decide what the final object looks like (e.g. "all equal", "sorted", "periodic with period k") and then show you can reach/produce it.
4. Induction/recursion: solve n from n−1 or n−2 (append two elements that keep the property), or reduce n to n/2.
5. Degrees of freedom: fill most of the answer with neutral values (1s, zeros, the same character) and fix the remainder with a few carefully chosen elements.
6. Verify with a checker: write a function that validates your output, run it on all small n (and random inputs) — constructive WA is usually a missed small case (n = 1, 2, 3).
Common building blocks: powers of two (sum of distinct powers, binary representation), alternation (a, b, a, b), the identity and reversed permutations, cyclic shifts, "big-small-big-small" interleaving, splitting into pairs, using the maximum element as a separator, and greedy filling.

## C++ template: brute-force pattern finder for small n (constructive)
```cpp
#include <bits/stdc++.h>
using namespace std;

// Print one valid permutation (or "-1") for each small n to reveal the pattern.
// Replace `valid` with the problem's condition.
bool valid(const vector<int>& p) {
    for (size_t i = 0; i + 1 < p.size(); i++) {
        int d = abs(p[i] - p[i + 1]);
        if (d < 2 || d > 4) return false;           // example: 2 <= |p_i - p_{i+1}| <= 4
    }
    return true;
}

void findPatterns(int maxN) {
    for (int n = 1; n <= maxN; n++) {
        vector<int> p(n);
        iota(p.begin(), p.end(), 1);
        bool found = false;
        do {
            if (valid(p)) { found = true; break; }
        } while (next_permutation(p.begin(), p.end()));
        printf("n=%d: ", n);
        if (!found) printf("-1");
        else for (int x : p) printf("%d ", x);
        printf("\n");
    }
}

// The generalized construction for the example condition (CF 1352G):
// odd numbers descending, then 4, 2, then remaining even numbers ascending.
vector<int> buildSpecial(int n) {
    if (n < 4) return {};                          // impossible
    vector<int> p;
    for (int x = (n % 2 ? n : n - 1); x >= 1; x -= 2) p.push_back(x);
    p.push_back(4); p.push_back(2);
    for (int x = 6; x <= n; x += 2) p.push_back(x);
    return p;
}
```

## Typical construction patterns at 800–2000 (constructive algorithms)
- Permutation with no fixed points: cyclic shift (2, 3, ..., n, 1) or swap adjacent pairs.
- Permutation with all adjacent sums/differences constrained: separate odd and even numbers (parity blocks) and connect the blocks with a small gadget (e.g. 3 1 4 2).
- Alternating patterns: "+ − + −", "abab...", "big small big small" (sort, then interleave the halves) to make every element a local max/min.
- Periodic arrays: if every window of length k must have the same sum, the array must be periodic with period k; pick k values (distinct ones padded with filler) and repeat.
- Sum splitting: write n as k numbers of the same parity: try k−1 ones plus a remainder, or k−1 twos plus a remainder; check positivity and parity.
- LCM/GCD constructions: use 1, x, x (lcm = x) or n/2, n/4, n/4 (lcm = n/2) patterns; pad with 1s which do not change lcm and add little to the sum.
- Powers of two: any number is a sum of distinct powers of two; 2^k − 1 has all bits set; using x and x ^ mask to control xor.
- Matrix/grid: checkerboard coloring by (i + j) parity; fill row by row or along diagonals; change exactly one cell per row/column/block (a permutation of positions).
- Make every subarray sum non-zero / distinct: use powers of two or carefully separated values.
- Operations "at most n": fix positions one by one from left to right (or from the end), each costing one operation; for "at most 2n", each element may need a two-step fix.
- Sorted then reversed: to maximize (or minimize) a quantity like sum of |p_i − i|, pair largest with smallest.
- Output the extreme answer (all equal, the sorted array) after proving it is always optimal or always valid.

## Proving impossibility and the "−1" case (constructive algorithms)
- Parity: sum parity, count of odd elements, permutation parity (each swap flips it), grid color counts.
- Counting: not enough distinct values, more distinct values than positions in a period, a value that must appear more than n/2 times.
- Small n: many constructions fail only for n ≤ 3 (e.g. n = 2 or 3 for adjacency constraints); brute force those explicitly.
- Bounds: the minimum achievable sum exceeds the target, or the maximum is below it (then the target is unreachable; all values between are often reachable by adjusting one element).
- Invariants of operations: gcd preserved, xor of all elements preserved, sortedness of some subsequence preserved.
- After stating the condition, test it with the brute force over all small inputs: "condition true ⇔ brute force finds an answer" must hold for every small input.
- Always print −1 for impossible cases inside multitest and continue reading the remaining input of that test (do not break out of the input loop early).

## Pitfalls (constructive algorithms)
- Trying to reproduce the sample output exactly instead of any valid output.
- Missing small cases (n = 1, 2, 3) or the case where all elements are equal.
- Constructions that exceed value limits (e.g. values must be ≤ 10^9 or ≤ n, or distinct) — check bounds of the produced numbers.
- Exceeding the allowed number of operations by one in edge cases.
- Not verifying the output: always write a quick checker during practice and stress-test with brute force for small n.
- Overcomplicating: at 800–1400 the construction is usually 2–5 lines; if your case analysis has 10 branches, look for a uniform pattern.
- Forgetting output format: print the length or the number of operations before the operations, 1-indexed positions.

## Classic Codeforces problems (constructive algorithms)
- 1352B Same Parity Summands (1200) — try k−1 ones plus n−(k−1) (must be odd and positive), else k−1 twos plus n−2(k−1) (must be even and positive), else NO.
- 1335D Anti-Sudoku (1300) — change every 2 into a 1 (or any fixed digit into another): exactly one change per row, column and block, creating a duplicate in each.
- 1348B Phoenix and Beauty (1400) — the array must be k-periodic; if the number of distinct values exceeds k print −1, else pad the distinct values to length k and repeat the block n times.
- 1517C Fillomino 2 (1400) — process diagonal cells top to bottom; each region grows to the left when the cell is free, otherwise downward; never gets stuck.
- 1352G Special Permutation (1600) — n < 4 impossible; odd numbers descending, then 4 2, then even numbers ascending keeps every adjacent difference in [2, 4].
- 1364C Ehab and Prefix MEXs (1600) — when a_i increases, b_i must be a_{i−1}; fill all other positions with the smallest numbers that never appear in a.
- 1497C2 k-LCM (hard version) (1600) — output k−3 ones and solve 3 numbers summing to m = n−k+3: odd m → 1, (m−1)/2, (m−1)/2; m ≡ 0 mod 4 → m/2, m/4, m/4; else 2, (m−2)/2, (m−2)/2.
