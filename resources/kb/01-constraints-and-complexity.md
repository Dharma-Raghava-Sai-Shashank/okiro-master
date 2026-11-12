---
topic: Constraints and Complexity Budget on Codeforces
tags: [implementation, brute force, math, bitmasks, dp, binary search, two pointers]
---
# Constraints and Complexity Budget on Codeforces

## Recognize it: reading constraints to pick the algorithm
Every Codeforces problem's constraints encode the intended complexity. Read them first and translate:
- The largest n (or sum of n), the largest value a_i, the number of queries q, the time limit, and the memory limit.
- Secondary small parameters (k ≤ 20, alphabet size 26, a_i ≤ 100, m ≤ 10) are almost always meant to be iterated over or used as a bitmask dimension.
- A gap between constraints of an easy and hard version (C1: n ≤ 2000, C2: n ≤ 2·10^5) tells you exactly which factor to remove.
- Values up to 10^9 or 10^18 with small n mean you cannot iterate over values: use sorting, coordinate compression, binary search on the value, or math.
- Time limit larger than usual (3–5 s) hints at a heavier intended complexity such as n√n or n log^2 n; a 1 s limit with n = 10^6 means linear with a small constant.

## Table: n to feasible complexity (Codeforces, ~1–2 s)
Assume roughly 10^8–3·10^8 simple operations per second in optimized C++ (-O2).

| Max n | Feasible complexity | Typical techniques |
|---|---|---|
| n ≤ 10–11 | O(n!·n) | permutations via next_permutation, full search |
| n ≤ 18–20 | O(2^n·n) or O(2^n·n^2) at n ≤ 18 | bitmask DP, subset enumeration |
| n ≤ 40 | O(2^(n/2)·n) | meet in the middle |
| n ≤ 100 | O(n^4) | small DP with many dimensions |
| n ≤ 500 | O(n^3) | Floyd–Warshall, interval DP, cubic DP |
| n ≤ 5000 | O(n^2) | quadratic DP, all pairs, O(n^2) with tight loops |
| n ≤ 10^5 – 2·10^5 | O(n log n), O(n log^2 n), O(n√n) | sorting, binary search, segment tree/BIT, two pointers, sqrt decomposition |
| n ≤ 10^6 | O(n) or O(n log n) with small constant | linear scans, prefix sums, sieve, two pointers, avoid maps/sets |
| n ≤ 10^7 | O(n) very tight | linear sieve, plain arrays only |
| n ≥ 10^9 – 10^18 | O(√n), O(log n), O(1), O(number of divisors) | math formulas, fast power, binary search, digit DP, divisor enumeration, floor-division blocks |

Notes:
- O(n√n) with n = 2·10^5 is ~9·10^7, fine. O(n log^2 n) at 2·10^5 is ~6·10^7, fine.
- O(n^2) at n = 10^4 is 10^8 — borderline, OK with simple inner loops. At n = 3·10^4 it is too slow unless bitset (divide by 64).
- Bitset optimization divides an O(n^2) or O(n^3) inner loop by 64.

## Multitest: "sum of n over all test cases does not exceed 2·10^5"
Most modern Codeforces problems have t test cases with a guarantee on the sum of n.
- Meaning: the total input size is bounded, so an algorithm that is O(n log n) per test is O(N log N) overall where N = sum of n. You can treat the whole file as one big input.
- Trap 1: per-test work proportional to a global maximum. `memset(cnt, 0, sizeof cnt)` on an array of size 10^6 per test, with t = 10^4, costs 10^10. Clear only what you used (loop over the touched indices), or allocate vectors of size n+1 per test.
- Trap 2: precomputation inside the test loop (sieve, factorials). Do it once before reading t.
- Trap 3: O(n^2) per test is fine only if the sum of n^2 is bounded, which is usually not guaranteed. If only "sum of n ≤ 2·10^5" is given, a single test may have n = 2·10^5.
- Trap 4: if t can be 10^4 but there is no sum guarantee on some parameter (e.g. m per test ≤ 2·10^5 with no sum bound), recheck — the setter usually includes all needed bounds; missing ones mean that parameter must be handled in O(1) or O(log) per test.
- When the guarantee is "sum of n·m ≤ 10^6" (grids), store grids as a vector<string> or a flat vector sized n·m per test.

## Time limit to operation count (Codeforces)
- Rule of thumb: 1 second ≈ 10^8 "heavy" operations (with memory access, maps, divisions) up to ~5·10^8–10^9 trivially simple vectorizable operations. Plan for 10^8 per second to be safe.
- Costly operations: map/set operations (~100+ ns each, cache misses), unordered_map (fast on average but large constant and hackable), modulo by a non-constant (slower than by a compile-time constant), division, recursion, dynamic allocation in loops, std::endl.
- Cheap operations: array access in sequential order, additions, comparisons, bit operations.
- Estimate: n log n with n = 10^6 is 2·10^7 — fine; with a set, it is 2·10^7 tree operations — roughly 1–2 s, risky.
- Cache matters: iterating a 2D array row-major is many times faster than column-major for large arrays; adjacency vectors are fine, linked lists of pointers are slow.
- Interactive and output-heavy problems: fast IO matters; printing 10^6 numbers with endl can TLE.
- If your estimate is within 3× of the limit, either optimize constants (arrays instead of maps, avoid long long modulo where not needed, reserve vectors) or find a better complexity.

## Memory limits and sizes (Codeforces)
Standard memory limit is 256 MB (sometimes 512 MB or 64 MB in older problems).
- int = 4 bytes, long long = 8 bytes, double = 8 bytes, char/bool = 1 byte, pointer = 8 bytes.
- 256 MB ≈ 6.4·10^7 ints ≈ 3.2·10^7 long longs. Keep total under ~70–80% of the limit to be safe.
- 2D arrays: dp[5000][5000] of int = 100 MB (fine in 256 MB); of long long = 200 MB (risky). dp[10^4][10^4] ints = 400 MB (too much). Use rolling arrays (keep only the previous row) when the transition uses only the previous layer.
- vector<bool> and bitset use 1 bit per element: 10^9 bits = 125 MB.
- std::set / std::map node overhead is ~40–48 bytes per element in addition to the value; 10^7 elements in a set is ~500 MB — too much.
- vector<vector<int>> with many small vectors has ~24 bytes header per inner vector plus allocation overhead.
- Recursion depth: each frame costs stack space; Codeforces typically gives a large stack (256 MB on Windows builds), but deep recursion (10^6) with big frames can still crash. Prefer iterative DFS for chains of 10^6.
- Global arrays are zero-initialized and live in static memory; large local arrays inside main live on the stack and can overflow — declare big arrays globally or use vectors.

## Value ranges: int vs long long vs __int128
- int holds up to about 2.147·10^9. Any sum of more than two values up to 10^9, or any product of two values over ~46340, overflows int.
- long long holds up to about 9.22·10^18. Product of two values up to 10^9 (10^18) fits; product of two values up to 10^18 does not.
- Common overflow sites: a[i] * a[j] when both are int (the multiplication happens in int before assignment — write 1LL * a[i] * a[j]); sum of n = 2·10^5 values up to 10^9 (2·10^14, needs long long); n*(n-1)/2 for n = 2·10^5 (2·10^10, needs long long); binary search mid = (lo + hi) / 2 with large bounds (use lo + (hi − lo) / 2); answer counts of subarrays (up to n^2/2).
- Modular arithmetic: (a * b) % MOD with a, b < MOD ≈ 10^9 needs 64-bit intermediate. With MOD ≈ 10^18 you need __int128 for the product.
- __int128 (GCC/Clang extension): holds up to ~1.7·10^38. No direct cin/cout support; convert to string manually. Use for products of two long longs, then reduce or compare.
- Doubles have 53-bit mantissa (~15–16 significant digits). Do not compare large integers through double; sqrt(10^18) via sqrtl or adjust with a while loop. long double gives 64-bit mantissa on x86.
- Unsigned types wrap around silently: `v.size() - 1` when v is empty is a huge number. Cast sizes to int.
- Infinity sentinels: use 1e18 (as long long) or LLONG_MAX/4 to allow adding two infinities without overflow; for int use 1e9.

## Reading constraints for hidden hints (Codeforces)
- a_i ≤ 10^6 or ≤ 10^7: counting arrays indexed by value, sieve, harmonic iteration over multiples.
- a_i ≤ 2^30 or 10^9 with bit operations: iterate over 30 bits; trie on bits; "at most 30 distinct prefix OR/AND values".
- k ≤ 20 or m ≤ 20 with large n: bitmask over k (2^k states) with linear work in n.
- n ≤ 2000 and q ≤ 2·10^5: precompute all O(n^2) answers then answer queries in O(1).
- Strings with |s| ≤ 2·10^5 and alphabet 26: per-letter prefix counts (26·n), or iterate over letters.
- "It is guaranteed that the answer does not exceed 10^18": you may need long long but not modulo; also the answer may be computed by a formula.
- "Print modulo 998244353": counting/combinatorics/DP; division requires modular inverse.
- Grid n·m ≤ 10^6: BFS/DFS over cells; flatten indices.
- Queries with no updates: prefix sums, sparse table, offline sorting. With updates: Fenwick tree or segment tree.
- Time limit 1 s with n ≤ 10^6: avoid set/map; prefer sort + scans.
- Unusual tiny bounds (n ≤ 3, values ≤ 2) mean case analysis.

## Pitfalls with complexity estimates (Codeforces)
- Hidden factor: `s = s + c` on strings copies the whole string each time (O(n^2)); use `s += c` or push_back.
- `v.erase(v.begin())` and `s.erase(0, 1)` are O(n) each; in a loop they make O(n^2). Use deque or an index pointer.
- `count(...)`, `find(...)` on vectors, and `s.substr` in loops are linear operations.
- Passing vectors/strings by value to a recursive function copies them every call; pass by const reference.
- Clearing a big global array per test case (see multitest section).
- `map[key]` inserts a default value when the key is missing, growing the map; use `find` or `count` for lookups.
- `set.lower_bound(x)` is O(log n) but `lower_bound(set.begin(), set.end(), x)` is O(n) (non-random-access iterators).
- Harmonic sums: iterating over multiples of every d from 1 to N is N·(1 + 1/2 + ... + 1/N) ≈ N ln N, fine for N = 10^6.
- Nested loops where the inner loop runs over divisors: total divisors of all numbers up to N is about N ln N.
- Amortized arguments: two pointers and monotonic stacks are O(n) total even though they have nested loops — each element enters and leaves once.
