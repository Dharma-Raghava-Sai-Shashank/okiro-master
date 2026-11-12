---
topic: Codeforces Problem Patterns by Rating and Training to Master
tags: [implementation, greedy, math, constructive algorithms, brute force, sortings, binary search, dp, number theory, data structures, dsu, graphs, two pointers, bitmasks, strings, combinatorics, games, interactive, trees, dfs and similar]
---
# Codeforces Problem Patterns by Rating and Training to Master

## Recognize it: using rating bands to coach (Codeforces patterns)
Ratings of problems (800–3500) estimate the contestant rating at which a problem is solved during a contest with ~50% probability. A coach uses them to:
- Diagnose a student's level: the highest band where they solve most problems within ~30–45 minutes without hints.
- Choose practice: problems at current rating +100 to +300 give the fastest improvement; far above that, too much time goes to editorials.
- Predict what a contest slot tests: Div2 B is usually 1000–1300, Div2 C 1300–1700, Div2 D 1700–2100.
- Explain the gap: each band adds a typical requirement (reading carefully → simple observations → standard techniques → combining techniques with proofs).
Position-to-rating rough map (varies by round):
- Div4: A 800, B 800–1000, C 1000–1200, D 1200–1400, E 1300–1600, F 1500–1800, G 1700–2100.
- Div3: A 800, B 800–1100, C 1100–1400, D 1300–1700, E 1500–1900, F 1800–2200, G 2000+.
- Div2: A 800–1000, B 1000–1400, C 1300–1800, D 1700–2200, E 2000–2600, F 2400+.
- Educational (Div2-rated, ICPC rules with hacks phase): A 800–1000, B 1000–1300, C 1300–1700, D 1600–2000, E 1900–2300, F 2200+.
- Div1+Div2 combined rounds: shift Div2 letters by roughly one (C behaves like Div2 B–C, D like Div2 C–D).

## Rating 800 and 1000 (Codeforces patterns)
800 (Div2/Div3/Div4 A, Div4 B):
- Pure implementation and careful reading: simulate the statement, count characters, check simple conditions.
- One-line observations: parity of sum, "answer is max − min", "sort and print", "if n is even then ...".
- Typical tags: implementation, math, greedy, brute force, strings, sortings.
- Failure modes: misreading, forgetting multitest, YES/NO format, int overflow on simple products.
1000 (Div2 A hard / B easy, Div3 B, Div4 C):
- A single observation plus implementation: greedy on sorted array, counting with frequency arrays, simple constructive patterns (alternate values, cyclic shift), checking adjacent pairs.
- Brute force over a small dimension (try each of 26 letters, each of k positions).
- Typical tags: greedy, implementation, math, constructive algorithms, brute force, sortings, strings.
- What a student needs: fluency in loops/arrays/strings, sorting with custom keys, frequency counting, small case analysis, reading constraints.

## Rating 1200 and 1400 (Codeforces patterns)
1200 (Div2 B, Div3 C, Div4 D):
- One clean observation and O(n) or O(n log n) implementation: prefix sums, rewriting a condition into a key (a_i − i), greedy with a proof sketch, simple binary search, two pointers on sorted arrays.
- Constructive tasks with an easy pattern; parity arguments; small math (gcd, divisibility).
- Typical tags: greedy, math, constructive algorithms, implementation, sortings, binary search, two pointers, strings, number theory.
1400 (Div2 B–C, Div3 C–D, Div4 E):
- Standard techniques applied directly: binary search on the answer, prefix sums with maps, two pointers windows, basic DFS/BFS on grids and trees, simple DP (1D/2D), sieve and divisors.
- More careful edge cases and multi-step reasoning (two observations instead of one).
- Typical tags: greedy, math, implementation, constructive algorithms, binary search, dp, sortings, brute force, number theory, two pointers, dfs and similar, graphs.
- What a student needs: comfort with STL (map, set, priority_queue, lower_bound), complexity estimation, writing a brute force to test ideas, recognizing "minimize the maximum".

## Rating 1600 and 1800 (Codeforces patterns)
1600 (Div2 C, Div3 D–E, Educational C):
- Combining two standard ideas: sorting + greedy with a heap, binary search + greedy check, prefix sums + counting map, DFS + DP on trees, BFS with states, combinatorics with factorials mod p.
- Proof becomes important: many tempting greedy solutions fail; students must verify with stress tests.
- Typical tags: greedy, math, dp, constructive algorithms, binary search, data structures, implementation, sortings, number theory, combinatorics, graphs, dfs and similar, dsu, bitmasks.
1800 (Div2 C–D, Div3 E–F, Educational D):
- Non-obvious observations + standard technique: contribution counting, bitwise greedy from the high bit, DSU on offline queries, segment tree or BIT for prefix queries with updates, DP with an extra dimension or a clever state, shortest paths with modifications (0-1 BFS, multi-source), games solved by pattern.
- Typical tags: dp, greedy, math, constructive algorithms, data structures, binary search, graphs, number theory, combinatorics, bitmasks, trees, shortest paths, dsu, two pointers.
- What a student needs: fast and bug-free implementation of BFS/DFS/DSU/BIT/segment tree, modular combinatorics, DP formulation habit ("what do I need to remember about the prefix?"), and stress testing as a reflex.

## Rating 2000 (Codeforces patterns)
2000 (Div2 D, Educational D–E, Div3 F–G):
- Problems require a key insight that reshapes the problem (an invariant, a reformulation, a bound like "answer ≤ 2" or "only O(log) distinct values"), followed by a standard but non-trivial implementation.
- Typical techniques: DP on trees/subsets/intervals with optimization (prefix maxima, monotone transitions), segment tree with lazy propagation or custom merge, binary search inside DP or on the answer with a complex check, number theory with sieve + factorization, constructive with induction, graph modeling (building the right graph, then BFS/Dijkstra/topological sort/SCC), bitmask tricks, combinatorics with inclusion–exclusion, hashing for strings.
- Typical tags: dp, greedy, math, constructive algorithms, data structures, graphs, binary search, trees, number theory, combinatorics, bitmasks, dfs and similar, strings, shortest paths, dsu, two pointers, divide and conquer.
- What a student needs: confidence to model problems as graphs or DP states, proofs instead of guesses, handling 2–3 interacting observations, and speed on Div2 A–C so that 60+ minutes remain for D.

## Most common tags by band (Codeforces patterns)
- 800–1000: implementation, math, greedy, brute force, strings, sortings, constructive algorithms.
- 1100–1300: greedy, math, implementation, constructive algorithms, sortings, brute force, strings, binary search, number theory, two pointers.
- 1400–1600: greedy, math, implementation, constructive algorithms, binary search, dp, sortings, number theory, data structures, two pointers, dfs and similar, graphs, bitmasks, combinatorics.
- 1700–1900: dp, greedy, math, constructive algorithms, data structures, binary search, graphs, number theory, combinatorics, bitmasks, trees, dfs and similar, shortest paths, dsu.
- 2000–2200: dp, data structures, math, greedy, constructive algorithms, graphs, trees, binary search, combinatorics, number theory, dfs and similar, bitmasks, divide and conquer, strings, hashing, probabilities.
Observations for coaching:
- "greedy", "math" and "constructive algorithms" remain the most frequent tags at every rating up to 2000 — observation skill matters more than exotic algorithms.
- "dp" grows steadily from 1400 and dominates from 1800.
- "data structures" (BIT, segment tree, sets with lower_bound) becomes common from 1600.
- Graph tags (dfs and similar, graphs, trees, shortest paths, dsu) are needed regularly from 1500.
- Tags are hints about the solution, not the problem; during practice, hide tags and guess them afterwards.

## The jump from 1600 to 2000 (Codeforces patterns)
Students stuck at 1500–1700 usually solve Div2 A–B quickly but C only sometimes and D rarely. The jump requires:
1. DP comfort: define states without help, handle 2D states (index × small parameter), DP on trees (subtree DP with children merging), bitmask DP for ≤ 20 elements, DP with prefix-max/min optimization, recognizing when greedy fails and DP is needed. Practice 30–50 DP problems in 1500–1900.
2. Binary search on the answer: instantly recognize "minimize the max / maximize the min / minimum time" and write the greedy check with overflow safety.
3. DSU: connectivity under unions, offline processing of queries sorted by threshold, DSU with size/extra data (component sums, parity/bipartiteness).
4. Segment tree / BIT basics: point update + range query, range add + range sum (lazy), counting inversions, "first index with value ≥ x" by descending the tree. Write them from memory in under 5 minutes.
5. Constructive thinking: small-case brute force to discover patterns, inductive constructions, impossibility proofs via invariants.
6. Proofs of greedy: exchange argument, stays-ahead, and stress testing every greedy before submitting.
7. Contribution counting and combinatorics mod p (factorials, inverses, nCr).
8. Graph modeling: shortest paths (BFS, 0-1 BFS, Dijkstra), topological sort, cycle detection, trees (LCA via binary lifting at ~2000).
9. Speed and accuracy: Div2 A+B in ≤ 20 minutes, C in ≤ 40 minutes, with few penalties — rating is driven by speed on the problems you can solve.

## Training plan to reach 2100 Master (Codeforces patterns)
- Volume and level: solve problems at rating R+100 to R+300 (R = current rating). Aim for 300–600 problems in the 1600–2200 range overall. Spend 30–60 minutes per problem before reading a hint; after reading the editorial, write the solution from scratch without looking.
- Upsolve every contest: after each rated round, solve the first problem you could not solve in contest (and the next one if within +300). This is the highest-value practice.
- Virtual contests: 2–3 per week of past Div2/Educational rounds under real time; analyze time spent per problem and penalties.
- Topic gaps: track which tags you fail; do focused blocks of 15–20 problems on weak tags (DP, data structures, constructive, combinatorics).
- Keep a mistake log: for every WA/TLE, write the root cause (overflow, reset, off-by-one, wrong proof). Review weekly; most rating loss comes from repeated mistakes.
- Templates: have tested snippets for BIT, segment tree (lazy), DSU, modint + factorials, sieve, Dijkstra, LCA, string hashing, KMP/Z — but understand them well enough to modify.
- Proof habit: before coding, state why the solution is correct in two sentences; if impossible, stress test before submitting.
- Contest strategy: read A–D quickly at the start; solve in order but skip a problem after ~25–30 minutes stuck if the next one has more solves; do not submit without testing samples and edge cases (penalties hurt in Educational rounds and break ties in Div2).
- Rating psychology without fluff: treat each contest as practice data; evaluate progress over 10+ contests, not one.
- At 1900–2100, typical blockers are Div2 D speed and Div2 E reading/attempting. Add problems at 2100–2400 occasionally to stretch.

## Representative Codeforces problems by band
- 800: 1360B Honest Coach (800) — sort and take the minimum adjacent difference.
- 800: 1367B Even Array (800) — count positions with wrong parity of each type; answer is that count if both counts match, else −1.
- 1000: 1520C Not Adjacent Matrix (1000) — fill odd numbers then even numbers so adjacent cells never differ by 1 (n = 2 impossible).
- 1100: 1335C Two Teams Composing (1100) — with d distinct skills and maximum frequency m, the answer is max(min(d − 1, m), min(d, m − 1)) (the most frequent skill either joins the uniform team or the distinct team).
- 1200: 1472D Even-Odd Game (1200) — sort descending; each player takes the largest remaining element on their turn, scoring only when its parity matches.
- 1400: 1167C News Distribution (1400) — DSU over groups; the answer for each user is its component size.
- 1500: 1263D Secret Passwords (1500) — DSU over 26 letters plus words; answer is the number of components containing a used letter.
- 1600: 1475E Advertising Agency (1600) — sort descending; count how many copies of the k-th value exist in total and inside the top k; answer is C(total, inside).
- 1700: 339D Xenia and Bit Operations (1700) — segment tree with alternating OR/XOR per level and point updates.
- 1700: 1324E Sleeping Schedule (1700) — DP over (sleep index, current hour) with choice a_i or a_i − 1.
- 1900: 1593D2 Half of Same (1900) — if half the elements are already equal print −1; otherwise fix the element that will be the minimum of the equal group, collect positive differences to the others, enumerate their divisors and count how many differences each divisor divides.
- 2000: 1385E Directing Edges (2000) — topologically sort the directed part (fail on a cycle) and orient every undirected edge from earlier to later in that order.
