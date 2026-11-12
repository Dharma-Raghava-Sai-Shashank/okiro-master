---
topic: Grandmaster Thinking Protocol for Codeforces Problems
tags: [greedy, math, brute force, constructive algorithms, binary search, implementation, sortings, games, dp]
---
# Grandmaster Thinking Protocol for Codeforces Problems

## Step 1 of the GM protocol: read constraints before the story
A grandmaster reads a Codeforces problem in this order: output format, constraints, then the statement, then the samples.
- Constraints decide the algorithm family before any idea exists. n ≤ 20 means exponential subsets; n ≤ 5000 means O(n^2); n ≤ 2·10^5 means O(n log n); values up to 10^18 mean math or binary search on value, not iteration.
- Look for unusual constraints: "k ≤ 20" in a big-n problem means bitmask over k; "a_i ≤ 10^6" means sieve or counting array; "sum of n over all test cases ≤ 2·10^5" means per-test cost must be linear in that test's n (never allocate or clear a 2·10^5 array per test).
- Look for guarantees: "the answer exists", "all a_i distinct", "the graph is a tree", "n is even". Every guarantee was added because the intended solution uses it. Ask: "why did the setter add this?"
- Re-state the problem in one sentence of pure math, stripped of the story ("choose a subsequence maximizing alternating sum"). If you cannot, you have not understood it.
- Walk through every sample by hand and confirm your reading. Misreading is the number one cause of WA at every rating.
- Note the output form: a number mod 998244353 suggests counting/combinatorics; "YES/NO" suggests a characterization (find the condition); "print any" suggests constructive; "minimize the maximum" suggests binary search on the answer.

## Complexity budget in the GM protocol
Before thinking about ideas, a grandmaster computes the budget: roughly 10^8 to 3·10^8 simple operations per second in C++ on Codeforces.
- Budget = time limit × ~2·10^8. Divide by n to get how much work per element is allowed.
- n = 2·10^5 and 2 s: about 4·10^8 ops total, so n log n (≈ 3.6·10^6) is trivially fine, n·√n (≈ 9·10^7) is fine, n^2 (4·10^10) is impossible.
- If the obvious solution is O(n^2) and n = 2·10^5, the problem is asking you to remove one factor of n: sorting, two pointers, prefix sums, a data structure, a monotone pointer, or a mathematical formula.
- If the obvious solution is exponential and n ≤ 40, consider meet-in-the-middle; n ≤ 20, bitmask DP.
- If values are huge (10^9 to 10^18) but n is small, the solution likely iterates over divisors, over bits (60 iterations), or uses O(√v) enumeration.
- Use the budget as a hint generator: "the intended complexity is O(n log n), which suggests sorting or binary search; which one fits?"

## Solve small cases by hand and brute force (GM protocol)
Patterns are found, not guessed. A grandmaster writes down n = 1, 2, 3, 4, 5 and computes answers by hand or with a 10-line brute force.
- Write the brute force early for any problem where the answer is a function of small parameters (games, constructive, counting). Print a table of answers for all small inputs and stare at it: look for parity dependence, powers of two, Fibonacci, "answer = n − (number of distinct values)", periodicity mod k.
- For YES/NO characterization problems, print all small inputs that give YES; the condition usually jumps out (e.g. "YES iff sum is even and max ≤ sum − max").
- For constructive problems, let the brute force find any valid answer for n = 1..8 and look for a structure you can generalize.
- Use OEIS-style reasoning on sequences of answers: differences, ratios, comparing to n(n+1)/2, 2^n, n!.
- Hand-simulate the process on the sample with pen and paper; notice what never changes and what always decreases.
- A brute force is also the oracle you will later stress-test against, so it is never wasted time.

## Invariants and monotonicity (GM protocol)
When a problem describes operations ("you may repeatedly do X"), immediately ask two questions.
1. What is invariant under the operation? Sum, sum mod 2, xor of all elements, gcd, multiset of values mod k, number of inversions mod 2, sorted order of some subset. An invariant gives a necessary condition for "is target reachable?"; often it is also sufficient.
2. What changes monotonically? A potential function that strictly decreases (sum, number of distinct values, max) proves termination and bounds the number of operations.
- Monotonicity in parameters: if the answer is feasible for x, is it feasible for x+1? That makes binary search on x valid.
- Monotonicity in windows: if a window [l, r] is good, is every sub-window good? That makes two pointers valid.
- Monotonicity of a pointer: as i increases, does the optimal j never move left? That enables O(n) amortized sweeps.
- Typical invariant facts: an adjacent swap changes inversion parity; replacing (a, b) by (a−b, b) preserves gcd; operations that add the same value to two elements preserve differences of the others.
- Proving "the invariant is also sufficient" is usually done constructively: show any state satisfying it can be reduced to a canonical state.

## Fix one variable / iterate over something (GM protocol)
Most O(n^2) → O(n log n) reductions come from fixing one quantity and optimizing the rest quickly.
- Fix the right endpoint r of a subarray and ask what the best/number of valid l is, using prefix sums, a map, or a monotone pointer.
- Fix the minimum (or maximum) element of a chosen set: after sorting, everything to its left/right is determined; this turns "choose a subset" into "choose a pivot + a prefix".
- Fix the value of the answer (binary search) and check feasibility greedily.
- Fix the number of operations of one type, then the rest is greedy.
- Fix the gcd / a divisor d and count elements divisible by d (harmonic sum n/1 + n/2 + ... = O(n log n)).
- Fix the highest bit where two numbers differ (bitwise problems).
- Fix the middle element of a triple (i < j < k): count valid i on the left and k on the right, multiply.
- If there are two parameters and one is small (k ≤ 20, alphabet 26, value ≤ 100), iterate over the small one outright.
Ask the student: "What if you knew X? Could you solve the rest quickly?" Pick the X that makes the rest easy.

## Contribution technique (GM protocol)
Instead of iterating over structures (subarrays, pairs, subsets) and summing their values, iterate over elements and count how many structures each element contributes to.
- Sum over all subarrays of sum: element a_i appears in i·(n−i+1) subarrays (1-indexed).
- Sum over all subarrays of max: a_i is the max of subarrays where it is the leftmost maximum; count them via previous-greater-or-equal and next-greater (monotonic stack): (i − L)·(R − i).
- Sum over pairs of |a_i − a_j|: sort ascending; with 0-indexed position i, a_i contributes +a_i·i (as the larger of i pairs) and −a_i·(n−1−i) (as the smaller of n−1−i pairs).
- Sum over all subsets of something: an element is in 2^(n−1) subsets; bit b of a xor is set in exactly half of subsets if any element has it.
- Bitwise sums (sum of xor over pairs): handle each bit separately; contribution = cnt0·cnt1·2^b.
- Expected values: linearity of expectation is contribution technique for probability: E[sum] = sum of P(event_i).
- Edge contribution in trees: a tree edge splitting the tree into sizes s and n−s lies on s·(n−s) paths.
Signal: "sum over all subarrays/pairs/subsets" with n up to 2·10^5 almost always means contribution.

## Think backwards / reverse the process (GM protocol)
Many process problems are easy in reverse.
- Operations that delete or merge are often easier as insertions/splits in reverse (offline DSU: process deletions backwards as unions).
- "Final state after operations, find the initial state" — undo operations from the end.
- Painting/overwriting problems: the last operation on a cell is the only one that matters, so process operations from last to first and skip cells already fixed.
- Games: compute positions from terminal states backwards (retrograde analysis).
- "Reach target from start" with operations like ×2 and −1: going from target to start with ÷2 and +1 is often greedy and unique.
- Answer reconstruction in DP is a backward walk.
- Queries "after the i-th removal" can be answered by adding elements in reverse order and recording answers.
Ask: "Which direction has fewer choices?" The direction with forced moves is the one to simulate.

## Reduce to a known problem (GM protocol)
After stripping the story, try to map the problem onto a standard one.
- Shortest path, MST, bipartite check, topological order, connected components (graph after building edges between related items).
- Longest increasing subsequence, knapsack, interval scheduling, edit distance, LCS.
- Counting inversions, nearest greater element (monotonic stack), sliding window minimum (deque).
- "Make array non-decreasing with minimum operations" → LIS-style or prefix max reasoning.
- "Pair up elements" → sort and match greedily, or matching/flow at high ratings.
- "Choose segments covering points" → interval greedy by right endpoint.
- Transform the condition: a_j − a_i = j − i ⇔ (a_j − j) = (a_i − i), so count equal values of b_i = a_i − i. Rewriting equations so each side depends on one index is the most common reduction in Div2 B/C.
- Changing representation: treat permutations as cycles, strings as prefix balance arrays, brackets as ±1 prefix sums, grids as bipartite (i+j parity).

## Extremes, sorting and canonical order (GM protocol)
- Consider the extreme elements: the maximum, minimum, first, last. Often the max element has a forced role (it must be paired, it must be removed last, it dictates the answer).
- Sort if order does not matter (the answer depends on a multiset). Sorting is free at O(n log n) and exposes monotone structure for two pointers and binary search.
- Choose a canonical form of solutions: "WLOG the chosen items are a prefix of the sorted order" or "WLOG operations are applied left to right". Proving the canonical form exists collapses the search space.
- Consider extreme answers: what is the answer when all elements are equal, when n = 1, when everything is maximal? Edge cases often reveal the formula.
- "Minimize the maximum" and "maximize the minimum" are the canonical binary-search-on-answer signals.
- Think about which element is "hardest" to satisfy; satisfy it first (greedy by deadline, by largest demand, by smallest capacity).

## Parity and pigeonhole (GM protocol)
Parity is the cheapest invariant and solves a large share of Div2 A–C problems.
- Sum parity: an operation that changes the sum by an even amount preserves the parity of the sum.
- Position parity: in grids (i + j) mod 2 colors; a move changing i+j by 1 alternates colors; knight moves change color.
- Permutation parity: each swap flips it; 3-cycles preserve it.
- Game parity: the winner is often determined by whether the total number of moves is odd or even.
Pigeonhole gives existence and bounds:
- Among n+1 prefix sums mod n, two are equal, so some subarray has sum divisible by n.
- If n > 26 (alphabet), some letter repeats; if n > 2^k, two masks coincide.
- If n is large relative to the value range (e.g. n > 60 with values < 2^30 for some xor/AND problems), the answer is trivially determined and only small n needs brute force. This "large n → trivial, small n → brute force" split is a classic GM trick.
- Distinct values bound: a gcd chain or a prefix-OR chain has at most log2(maxA) distinct values.

## Answer is small → try all; binary search the answer (GM protocol)
Bounded answer: if you can prove the answer is at most a small number (≤ 2, ≤ 3, ≤ log n, ≤ 60), check each candidate in increasing order.
- Many "minimum operations" problems have answer in {0, 1, 2}: check 0 (already good), check 1 (try every single operation), otherwise output 2 with a construction.
- When values are ≤ 100 or the answer must divide something, enumerate candidates.
Binary search on the answer: if a predicate "answer ≤ x is achievable" is monotone in x, search x and write a greedy check.
- Signals: "minimize the maximum", "maximize the minimum", "minimum time such that", "k-th smallest", answer up to 10^18.
- Check function must be O(n) or O(n log n); total O(n log V).
- Prove monotonicity in one sentence: "if it can be done in time T, it can be done in time T+1 by waiting".
- Also binary search over a sorted array of candidate answers (only O(n) distinct candidates) when the answer must be one of the input values.

## Greedy with an exchange argument (GM protocol)
A grandmaster does not submit a greedy without at least a sketch of proof.
- Exchange argument: take an optimal solution that differs from the greedy at the first position; swap the differing elements to agree with greedy; show the cost does not get worse. Repeat → greedy is optimal.
- Sorting by a comparator: for two adjacent items a, b compare cost(a then b) vs cost(b then a); the comparator is the result of that inequality (e.g. sort by deadline, by ratio, by a_i + b_i, by a·d vs b·c).
- "Stays ahead": show after each step the greedy's partial solution is at least as good as any other's partial solution.
- Before trusting a greedy, try to break it: construct 3–4 element counterexamples; check it against brute force on random small inputs.
- If a greedy fails on a counterexample, see if a heap-based "regret" greedy (take now, undo later via priority queue) or DP fixes it.
- Classic greedy shapes: earliest deadline, smallest end time (interval scheduling), process largest first, match smallest with largest, take while affordable with a heap.

## What if constraint X were smaller? (GM protocol)
Relaxation is the standard way to get unstuck.
- Solve the easy version first: n ≤ 1000 (O(n^2) DP or brute force), values ≤ 2, only one query, k = 1, the array is a permutation, the tree is a line.
- Then ask which part of the slow solution is wasteful: repeated recomputation (use prefix sums/DP), a scan that could be a binary search, a transition that only depends on a monotone quantity.
- If the problem has an easy version (e.g. C1/C2), the easy version's constraint tells you which dimension to optimize.
- Remove a condition: "what if the array were sorted?", "what if all values were distinct?", "what if there were no updates?" The solution to the relaxed problem often becomes a building block.
- Specialize: binary strings before general strings, values in {0,1} before arbitrary values (contribution by threshold: a_i ≥ x becomes 1, else 0 — the standard trick for medians).
- Generalize: sometimes a stronger statement is easier to prove by induction.

## Verify an idea before coding (GM protocol)
Coding a wrong idea costs 20+ minutes; verifying costs 3. Before typing:
1. Re-check the idea on every sample by hand, including the exact output.
2. Attack it: try n = 1, all equal values, strictly increasing, strictly decreasing, alternating, maximum values (overflow), negative numbers, zeros, duplicate values.
3. Try to build a counterexample to the key claim ("the greedy choice is always safe") with 3–5 elements. If it is a claim about all inputs, think of the adversary.
4. State the complexity and memory precisely, including per-test costs in multitest.
5. Decide data types: any product or sum that can exceed 2.1·10^9 needs long long.
6. If proof is shaky and time permits, write the brute force first and stress-test after coding.
A strong habit: write the solution outline as 3–6 bullet points before coding. If an outline step is vague ("handle the remaining cases"), the idea is not ready.

## When stuck checklist (GM protocol)
Go through these in order when no idea comes after 10–15 minutes.
1. Did I read the problem correctly? Re-read constraints and the samples' explanations.
2. Have I solved n = 1..5 by hand or brute force and looked at the outputs?
3. What does the complexity budget allow? Which techniques match that complexity?
4. Is there an invariant (parity, sum, gcd, xor) or a monotone quantity?
5. Can I fix one variable (right endpoint, minimum, answer value, a bit, a divisor)?
6. Can I count contribution per element instead of per structure?
7. Does reversing the process or the order help?
8. Does sorting help? Does the extreme element have a forced role?
9. Is the answer small (≤ 2 or ≤ log)? Is it binary-searchable?
10. Can I rewrite the condition so each side depends on one index?
11. Is it a known problem in disguise (graph, LIS, intervals, knapsack)?
12. Solve the relaxed version (smaller n, binary values, no updates) and optimize.
13. Could it be DP? Define the state as "what I need to remember about the prefix".
14. Read the tags only as a last resort during practice, and note which observation you missed.

## Socratic hint ladder for coaching (GM protocol)
When a student is stuck, give the smallest hint that unblocks them, climbing one rung at a time and asking a question at each rung.
1. Observation hint: point at the key property without naming the technique. "What happens to the sum mod 2 after each operation?" "Look at the answer for n = 1..6 — what do you notice?" "Does the order of elements matter?"
2. Technique hint: name the family. "Can you binary search on the answer?" "Try counting the contribution of each element." "Think about prefix sums of the +1/−1 array."
3. Complexity hint: tell them the target. "An O(n log n) solution exists; what would you sort by?" "The check function must be O(n)."
4. Steps hint: outline the algorithm in 3–5 steps without code. "Sort by end time; keep the last chosen end; take a segment if its start is after it."
5. Code-level hint only if asked: point to the specific bug or show a minimal template.
Rules: ask the student to state what they already tried; never reveal the full solution on the first request; after each rung, ask them to try again; when they solve it, ask them to explain why it works (proof), and name the reusable pattern so they recognize it next time.

## Practice problems for the GM protocol
- 1520D Same Differences (1200) — rewrite a_j − a_i = j − i as a_j − j = a_i − i and count equal keys (reduction by rewriting).
- 1201C Maximum Median (1400) — binary search the final median; check the cost greedily on the upper half.
- 1382B Sequential Nim (1100) — the first pile that is not 1 decides the winner; found quickly by brute-forcing small cases.
- 1334C Circle of Monsters (1600) — fix which monster you shoot first; every other monster's cost is reduced by its predecessor's explosion (fix one variable + contribution).
- 1366D Two Divisors (2000) — split n's smallest prime power off: d1 = p^k, d2 = n / p^k; coprime parts give gcd(d1 + d2, n) = 1 (invariant via gcd reasoning).
