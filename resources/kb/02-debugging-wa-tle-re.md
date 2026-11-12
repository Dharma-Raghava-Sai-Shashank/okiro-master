---
topic: Debugging WA, TLE, RE and MLE on Codeforces
tags: [implementation, brute force, data structures, hashing]
---
# Debugging WA, TLE, RE and MLE on Codeforces

## Recognize it: which verdict points to what
- Wrong answer on test 1: misread problem, wrong output format, or the code prints debug output. Run the samples locally with the exact input.
- Wrong answer on test 2 (multitest with many small cases): edge cases (n = 1, all equal), state not reset between test cases, or a wrong idea. Test 2 is usually a large batch of random small tests — stress testing will catch it.
- Wrong answer on a late test: overflow, special large structure, or a subtle greedy flaw.
- TLE on an early test: infinite loop, or wrong complexity. TLE on a max test: complexity too high, slow IO, per-test clearing of large arrays, hash attack.
- Runtime error: out-of-bounds access, stack overflow, division by zero, empty container access, invalid comparator in sort.
- Memory limit exceeded: arrays too large, map/set node overhead, recursion depth, vectors growing without bound.
- Idleness limit exceeded (interactive): missing flush or reading/writing the wrong number of lines.
- "Wrong answer: expected YES, found Yes" usually is not an issue (CF checkers are case-insensitive for YES/NO in most modern problems), but always read the statement's note on output case.

## Wrong Answer checklist (Codeforces)
Go through this list in order before rethinking the algorithm.
1. Overflow: any sum of many values, any product, n·(n−1)/2, answer counts. Use long long everywhere the value can exceed 2·10^9. Write `1LL * a * b`.
2. Multitest state not reset: global arrays, counters, maps, vectors of adjacency lists, visited flags, a "found" flag, the answer variable. Reset all of them per test (for the used size only).
3. Off-by-one: 0- vs 1-indexing, inclusive vs exclusive ranges, `<` vs `<=` in loops and binary search bounds, prefix sum p[r] − p[l−1].
4. Output format: spaces vs newlines, missing newline between test cases, printing the answer for every test, printing -1 when impossible, precision for floating output (`fixed << setprecision(10)`).
5. YES/NO wording: "YES"/"NO" vs "Yes"/"No" vs "Alice"/"Bob". Copy from the statement.
6. Edge cases: n = 1, n = 2, all elements equal, already sorted/answer 0, maximum values, zeros, negative numbers (C++ `%` of a negative is negative; `-7 / 2 == -3` truncates toward zero, not floor).
7. Sorting comparator not a strict weak ordering: must return false for equal elements (use `<`, never `<=`). Violations give wrong order or crashes.
8. Uninitialized variables: local variables are garbage; initialize min/max with proper sentinels (`LLONG_MAX`, not `INT_MAX` when values are long long).
9. Reading input in the wrong order (n then m vs m then n), reading a matrix transposed, reading strings with spaces.
10. Early `break`/`return` inside the input-reading loop leaving unread input for the next test case — read all input of the test first, then solve.
11. Integer division and floating point: use integer arithmetic for exact comparisons; ceil(a/b) for positives = (a + b − 1) / b.
12. The idea itself: stress test against a brute force (see the stress-testing section).

## Time Limit Exceeded checklist (Codeforces)
1. Fast IO: put `ios::sync_with_stdio(false); cin.tie(nullptr);` at the start of main. Do not mix scanf/printf with cin/cout after disabling sync.
2. `endl` flushes the buffer every line; with 10^5+ lines use `'\n'`.
3. Per-test memset/fill of big arrays: with t = 10^4 and array size 10^6 that is 10^10 operations. Clear only up to n.
4. Complexity mistakes hidden in library calls: `s = s + x` (copies), `v.erase(v.begin())`, `s.substr` in loops, `std::count`/`find` in loops, `lower_bound(set.begin(), set.end(), x)` (linear for set — use `set.lower_bound(x)`).
5. Passing vectors, strings, or maps by value into functions (especially recursive ones). Use `const vector<int>&`.
6. unordered_map/unordered_set anti-hash tests: Codeforces hackers add inputs that make the default hash collide, turning O(1) into O(n). Use a custom splitmix64 hash with a time-based seed, or use sorting + binary search, or map.
7. map `operator[]` on lookups inserting keys; repeated map lookups inside tight loops (cache the iterator).
8. Recursion with memoization keyed by a map instead of an array.
9. An infinite loop: binary search with `lo = mid` and mid rounding down, a while loop whose variable never changes for some inputs, a two-pointer that never advances.
10. Precomputation (sieve, factorials) inside the test loop instead of once.
11. Too many `long long` modulo operations by a runtime variable: make MOD a `const` or `constexpr`.
12. Using `double`/`pow` in loops, or `pow` for integer powers (also imprecise).
13. If the complexity is truly right but slow, reduce constant: arrays instead of vectors of vectors, iterative instead of recursive, avoid sets.

## Runtime Error and Memory Limit checklist (Codeforces)
Runtime error (RE):
- Out-of-bounds indexing: arrays sized n but accessed at n (1-indexed loops), `a[i+1]` at the last i, negative indices from `i - 1` at i = 0, prefix arrays needing size n+1.
- Stack overflow: recursive DFS on a path of 10^5–10^6 nodes. Convert to an iterative DFS with an explicit stack, or use BFS order.
- Division or modulo by zero: gcd results, counts that may be 0, `x % k` when k = 0.
- Empty container access: `v.back()`, `v.front()`, `pq.top()`, `*s.begin()`, `s.rbegin()` on empty containers; `v.size() - 1` underflows to a huge unsigned value when v is empty.
- Invalid iterator: erasing from a set while iterating without using the returned iterator; dereferencing `s.end()`, or `prev(s.begin())`.
- Comparator violating strict weak ordering in `std::sort` can read out of bounds.
- Large local arrays inside main (on the stack): make them global or vectors.
- Exceptions: `stoi` on huge numbers, `vector::at`, bad_alloc from huge allocations.
Memory limit exceeded (MLE):
- 2D arrays of long long at 5000×5000 = 200 MB; use int or rolling arrays.
- Storing all states in a map/set (~48 bytes overhead per node).
- Recursion depth × frame size.
- Pushing into vectors without bound (BFS revisiting nodes because visited was set on pop instead of on push).
- `vector<vector<int>>` with 10^6 inner vectors.

## Stress testing: setup and loop (Codeforces)
Stress testing finds counterexamples automatically: a random generator, a slow but obviously correct brute force, the fast solution, and a loop comparing outputs.
Steps:
1. Write `brute.cpp`: the simplest correct solution — try all subsets/permutations/all pairs, simulate the process literally, O(n^3) or exponential. Correctness over speed. Share no logic with the main solution (otherwise you copy the bug).
2. Write `gen.cpp`: reads a seed from `argv[1]`, prints a small random test (n between 1 and 6–8, values between 1 and 10). Small values make collisions, equal elements, and edge cases likely.
3. Compile all three with -O2.
4. Loop over seeds, compare outputs, stop at the first difference and print the input.
For problems with many valid answers, write a `checker` that validates the fast solution's output (constraints satisfied, objective equals brute's optimum) instead of comparing text.

Bash stress loop:
```bash
g++ -O2 -std=c++17 sol.cpp -o sol
g++ -O2 -std=c++17 brute.cpp -o brute
g++ -O2 -std=c++17 gen.cpp -o gen
for i in $(seq 1 10000); do
  ./gen $i > in.txt
  ./sol < in.txt > out1.txt
  ./brute < in.txt > out2.txt
  if ! cmp -s out1.txt out2.txt; then
    echo "Mismatch on seed $i"; cat in.txt; echo "sol:"; cat out1.txt; echo "brute:"; cat out2.txt
    break
  fi
done
```

## Stress testing: C++ random generator template (Codeforces)
The generator takes the seed from the command line so every failing test is reproducible. Use mt19937 (never rand(), which has small RAND_MAX on some platforms). Keep tests tiny so the brute force is fast and the counterexample is readable.

```cpp
#include <bits/stdc++.h>
using namespace std;

mt19937 rng;
long long rnd(long long lo, long long hi) { // inclusive
    return uniform_int_distribution<long long>(lo, hi)(rng);
}

int main(int argc, char* argv[]) {
    unsigned seed = argc > 1 ? (unsigned)atoi(argv[1]) : 1u;
    rng.seed(seed);
    int t = 1;                       // one test per file keeps shrinking easy
    printf("%d\n", t);
    while (t--) {
        int n = (int)rnd(1, 6);
        printf("%d\n", n);
        for (int i = 0; i < n; i++) printf("%lld ", rnd(1, 10));
        printf("\n");
        // random permutation:
        // vector<int> p(n); iota(p.begin(), p.end(), 1); shuffle(p.begin(), p.end(), rng);
        // random string over "ab": char c = 'a' + rnd(0, 1);
        // random tree: for v = 2..n print rnd(1, v - 1) and v as an edge
    }
}
```
Generator tips:
- Random trees: parent of v is a random vertex in [1, v−1]; then shuffle labels if the solution might depend on labeling.
- Random connected graphs: tree + a few extra random edges; avoid duplicates with a set if the problem forbids multi-edges.
- Generate also "structured" tests: all equal, sorted, alternating, a single big value, by branching on `rnd(0, 3)`.
- Respect all guarantees of the problem (distinct values, answer exists, sum constraints), or the brute and solution disagree on invalid input.

## Stress testing: brute force strategy and shrinking counterexamples (Codeforces)
Brute force strategies, from most to least reliable:
- Enumerate everything: all subsets (2^n), all permutations (next_permutation), all subarrays, all sequences of operations up to a depth (BFS over states).
- Simulate literally: implement the statement's process step by step without any cleverness.
- Use a different, slower algorithm: O(n^2) DP instead of the greedy; recompute from scratch per query instead of a data structure.
- For games: recursive win/lose over all states with memoization.
Shrinking a counterexample:
1. Start with the smallest generator parameters (n up to 3–4, values up to 3–5) so the first failing test is already tiny.
2. If a large test fails, reduce it: remove one element (or one query) at a time and keep the removal if the mismatch persists; then decrease values one at a time.
3. Once minimal, solve it by hand. Compare your hand answer with both outputs — sometimes the brute force is the one that is wrong.
4. Trace the fast solution on the minimal input with debug prints (to stderr: `cerr << ...`) to find the exact line where the logic diverges.
5. After fixing, rerun the stress loop; one bug often hides a second one.
When the problem has multiple correct outputs, the brute force should output the optimal value only, and a checker verifies the solution's output is valid and achieves it.

## Anti-hash: custom hash for unordered_map (Codeforces)
On Codeforces, open hacking and uphacks add tests that collide the default `std::hash` for integers (identity hash), causing unordered_map to degrade to O(n) per operation and TLE. Fix: a randomized splitmix64 hash.

```cpp
#include <bits/stdc++.h>
using namespace std;

struct SplitHash {
    static uint64_t splitmix64(uint64_t x) {
        x += 0x9e3779b97f4a7c15ULL;
        x = (x ^ (x >> 30)) * 0xbf58476d1ce4e5b9ULL;
        x = (x ^ (x >> 27)) * 0x94d049bb133111ebULL;
        return x ^ (x >> 31);
    }
    size_t operator()(uint64_t x) const {
        static const uint64_t SEED =
            chrono::steady_clock::now().time_since_epoch().count();
        return splitmix64(x + SEED);
    }
};

// usage:
// unordered_map<long long, int, SplitHash> cnt;
// cnt.reserve(1 << 20); cnt.max_load_factor(0.25);
// for pairs, combine: key = (uint64_t)a << 32 | (uint32_t)b
```
Alternatives that are always safe: sort + unique + lower_bound (coordinate compression) and arrays; `std::map` (O(log n) guaranteed); `__gnu_pbds::gp_hash_table` with the same custom hash (GCC only).

## Debugging technique and habits (Codeforces)
- Print debug output to stderr (`cerr`), which Codeforces ignores, so forgetting to remove it does not cause WA (it can still cost time if massive).
- A debug macro: `#define dbg(x) cerr << #x << " = " << (x) << endl` — guard with `#ifdef LOCAL` so it is compiled out on the judge.
- Compile locally with sanitizers to catch RE: `-fsanitize=address,undefined -g` (out of bounds, overflow of signed ints, use after free). Also `-D_GLIBCXX_DEBUG` (GCC) checks vector bounds and invalid comparators.
- Compile with warnings `-Wall -Wextra -Wshadow` to catch uninitialized variables, shadowed names, and sign comparisons.
- Re-read the code top to bottom slowly while asking "what is the value of this variable for n = 1?"
- Check that every variable that depends on the test case is declared inside the test loop.
- If WA persists and stress tests pass, the generator is too narrow: increase value ranges, add edge-structured tests, or reread the statement for a misread condition.
- When the verdict is WA on test k, look at what that test likely contains (CF shows the beginning of the test): huge values → overflow; t = 10^4 → reset bugs; n = 1 → edge case.

## Pitfalls checklist summary (Codeforces debugging)
- int overflow in products and sums; use long long and 1LL.
- Multitest leftovers: globals, adjacency lists, flags.
- endl and missing fast IO on large output.
- memset of a large array per test case.
- Recursion depth 10^5+ on path-shaped trees.
- `<=` in sort comparators.
- `v.size() - 1` with empty v (unsigned underflow).
- Negative modulo: use `((x % m) + m) % m`.
- Unhashed unordered_map under hacks.
- Floating point equality; prefer integers or an epsilon.
- `pow`, `sqrt` imprecision for integers: correct with while loops (`while (r*r > x) r--; while ((r+1)*(r+1) <= x) r++;`).
- Reading until EOF vs reading exactly t tests.
