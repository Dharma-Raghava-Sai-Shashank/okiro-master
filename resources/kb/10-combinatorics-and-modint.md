---
topic: Combinatorics, Counting mod p and Modint
tags: [combinatorics, math, number theory, probabilities, dp, sortings]
---
# Combinatorics, Counting mod p and Modint

## Recognize it (combinatorics)
- "Count the number of arrays/permutations/subsets/paths ..." with "print the answer modulo 998244353 (or 10^9+7)".
- "Find the expected value ... print it as P · Q^(−1) mod p" — probability/expectation with modular inverse.
- Choosing k items from a group with constraints: nCr, often multiplied over independent groups.
- Non-decreasing sequences of length k over [1, n], distributing identical items into boxes: stars and bars.
- "At least one", "none of the forbidden", "all conditions" over a small number of conditions: inclusion–exclusion.
- Sums over all subsets/pairs/permutations: count contributions per element and multiply by the number of structures containing it.
- n up to 2·10^5 or 10^6 with many nCr queries: precompute factorials and inverse factorials once.
- Sorted data plus "choose k so that the minimum/maximum is a_i": fix the extreme element and count the rest with nCr.

## Core idea (combinatorics mod p)
- Factorials: precompute fact[i] = i! mod p for i ≤ N, then invFact[N] = fact[N]^(p−2) and invFact[i−1] = invFact[i] · i. Then C(n, k) = fact[n] · invFact[k] · invFact[n−k] in O(1). Requires p prime and N < p.
- Product rule for independent choices, sum rule for disjoint cases. Before multiplying, check that choices really are independent (no double counting); before adding, check that cases are disjoint.
- Permutations P(n, k) = n! / (n − k)! — ordered selections.
- Stars and bars: the number of ways to write s as a sum of k non-negative integers is C(s + k − 1, k − 1); with positive integers, C(s − 1, k − 1). Non-decreasing sequences of length k with values in [1, n]: C(n + k − 1, k).
- Inclusion–exclusion: |A_1 ∪ ... ∪ A_m| = Σ|A_i| − Σ|A_i ∩ A_j| + ...; iterate over subsets of conditions (m ≤ 20) or over divisors (Möbius) for gcd-based conditions. Typical: count of x ≤ N coprime to n via subsets of n's prime factors.
- Counting by contribution: answer = Σ over elements (value of element × number of structures in which it plays a role). Example: sum over all k-subsets of the max = Σ_i a_i · C(i, k−1) after sorting ascending (0-indexed i elements are smaller).
- Complement counting: count bad objects and subtract from the total, when "bad" is simpler.
- Bijections: transform the object into a simpler one (concatenate a non-decreasing a with a non-increasing b reversed → one non-decreasing sequence of length 2m).
- Expected value: E[X] = Σ P(event) by linearity, even for dependent events. Probabilities are fractions; represent them mod p by multiplying with modular inverses. The answer P/Q mod p = P · Q^(p−2) mod p.

## C++ template: modint and binomials
```cpp
#include <bits/stdc++.h>
using namespace std;

template <int MOD>
struct ModInt {
    int v;
    ModInt(long long x = 0) { x %= MOD; if (x < 0) x += MOD; v = (int)x; }
    ModInt& operator+=(const ModInt& o) { v += o.v; if (v >= MOD) v -= MOD; return *this; }
    ModInt& operator-=(const ModInt& o) { v -= o.v; if (v < 0) v += MOD; return *this; }
    ModInt& operator*=(const ModInt& o) { v = (int)(1LL * v * o.v % MOD); return *this; }
    ModInt pow(long long e) const {
        ModInt r(1), b(*this);
        for (; e > 0; e >>= 1, b *= b) if (e & 1) r *= b;
        return r;
    }
    ModInt inv() const { return pow(MOD - 2); }      // MOD must be prime, v != 0
    ModInt& operator/=(const ModInt& o) { return *this *= o.inv(); }
    friend ModInt operator+(ModInt a, const ModInt& b) { return a += b; }
    friend ModInt operator-(ModInt a, const ModInt& b) { return a -= b; }
    friend ModInt operator*(ModInt a, const ModInt& b) { return a *= b; }
    friend ModInt operator/(ModInt a, const ModInt& b) { return a /= b; }
    friend bool operator==(const ModInt& a, const ModInt& b) { return a.v == b.v; }
    friend ostream& operator<<(ostream& os, const ModInt& a) { return os << a.v; }
};
using mint = ModInt<998244353>;   // or ModInt<1000000007>

struct Binom {
    vector<mint> f, inf;
    Binom(int n) : f(n + 1), inf(n + 1) {
        f[0] = 1;
        for (int i = 1; i <= n; i++) f[i] = f[i - 1] * i;
        inf[n] = f[n].inv();
        for (int i = n; i > 0; i--) inf[i - 1] = inf[i] * i;
    }
    mint C(int n, int k) const {
        if (k < 0 || k > n || n < 0) return 0;
        return f[n] * inf[k] * inf[n - k];
    }
    mint P(int n, int k) const {                     // ordered selections
        if (k < 0 || k > n) return 0;
        return f[n] * inf[n - k];
    }
    // ways to write s as sum of k >= 1 non-negative parts
    mint starsBars(int s, int k) const { return C(s + k - 1, k - 1); }
};

// nCr for huge n (up to 1e18) but small k (k <= ~1e6): multiplicative formula.
mint Csmall(long long n, int k) {
    if (k < 0 || k > n) return 0;
    mint num = 1, den = 1;
    for (int i = 0; i < k; i++) { num *= mint(n - i); den *= mint(i + 1); }
    return num / den;
}
```

## C++ template: inclusion–exclusion and expected value
```cpp
#include <bits/stdc++.h>
using namespace std;
using ll = long long;

// Count x in [1, N] coprime to n, via inclusion-exclusion over n's distinct primes.
ll countCoprime(ll N, ll n) {
    vector<ll> ps;
    for (ll p = 2; p * p <= n; p++) if (n % p == 0) { ps.push_back(p); while (n % p == 0) n /= p; }
    if (n > 1) ps.push_back(n);
    int m = ps.size(); ll res = 0;
    for (int mask = 0; mask < (1 << m); mask++) {
        ll prod = 1;
        for (int i = 0; i < m; i++) if (mask >> i & 1) prod *= ps[i];
        res += (__builtin_popcount(mask) % 2 ? -1 : 1) * (N / prod);
    }
    return res;
}

// Expected value mod p: probability = num / den -> num * den^(p-2).
const ll MOD = 998244353;
ll pw(ll b, ll e) { ll r = 1; b %= MOD; for (; e; e >>= 1, b = b * b % MOD) if (e & 1) r = r * b % MOD; return r; }
ll fracMod(ll num, ll den) { return num % MOD * pw(den, MOD - 2) % MOD; }
```

## Variations and tricks (combinatorics)
- Fix the extreme element: sort; the number of k-subsets whose minimum is a_i (distinct values) is C(n − 1 − i, k − 1) for 0-indexed i. Close tuples (max − min ≤ d): fix the minimum and choose the others from a window found by two pointers.
- Fix the "last" event in a sweep: count each subset exactly once at the moment its last member appears (events + C(c, k−1)).
- Independent groups: multiply the number of ways per group, then multiply by the number of ways to assign roles to groups (C(groups, half)).
- Arrays with one repeated value and a unimodal shape: choose the n−1 distinct values C(m, n−1), choose which one is duplicated (not the maximum, n−2 ways), and each remaining value goes left or right of the peak (2^(n−3)).
- Binary search simulation: walk the search path for the target position; each visited midpoint forces a value smaller or larger than x; count with permutations P(cntSmaller available, need) times the free factorial.
- Catalan numbers C(2n, n)/(n+1): balanced bracket sequences, binary trees, monotone lattice paths not crossing the diagonal. Reflection principle: bad paths = C(2n, n+1).
- Lattice paths from (0,0) to (a,b) with right/up steps: C(a + b, a).
- Derangements: D(n) = (n − 1)(D(n − 1) + D(n − 2)), D(1) = 0, D(2) = 1.
- Counting by complement: total − bad, e.g. arrays with at least one element ≥ k = m^n − (k−1)^n.
- Pascal's triangle for small n (≤ 5000) when the modulus is not prime or when precomputing all C(n, k): C[n][k] = C[n−1][k−1] + C[n−1][k].
- Lucas theorem for C(n, k) mod a small prime p: product of C(n_i, k_i) over base-p digits.
- Sum of a geometric series mod p: (r^n − 1) / (r − 1), or with care when r ≡ 1.
- Expected number of steps: linearity over indicator variables; for "expected max", use P(max ≥ t) summed over t.

## Pitfalls (combinatorics)
- Factorial table too small (C(n + k − 1, k − 1) needs indices up to n + k).
- Not handling k < 0 or k > n in C (must return 0).
- Taking the inverse of 0 mod p (e.g. dividing by a count that is a multiple of p, or by zero).
- Subtraction without normalization producing negative residues (use the modint or add MOD).
- Double counting: ordered vs unordered selections; identical vs distinct objects; counting a subset once per member instead of once.
- Using 10^9+7 where the statement says 998244353 (read carefully).
- Inclusion–exclusion sign errors; product of primes overflowing when the mask is large (break once prod > N).
- Precomputing factorials per test case in multitest (precompute once to the global maximum).
- Probability modulo p is not a real number: you cannot compare or round it.
- int overflow in 1LL * v * o.v — always multiply in 64-bit.

## Classic Codeforces problems (combinatorics)
- 1436C Binary Search (1500) — simulate the binary search over positions to learn how many cells must hold values smaller/larger than x; answer = P(x−1, small) · P(n−x, large) · (remaining)!.
- 1288C Two Arrays (1600) — concatenate a with reversed b to get a non-decreasing sequence of length 2m over [1, n]: C(n + 2m − 1, 2m).
- 1795D Triangle Coloring (1600) — choose which n/6 triangles are majority-red: C(n/3, n/6); each triangle multiplies by the number of ways to keep the two heaviest edges (count of minimum-weight edges).
- 1312D Count the Arrays (1700) — C(m, n−1) distinct values, n−2 choices for the duplicated non-maximum value, 2^(n−3) sides for the rest.
- 1279D Santa's Bot (1700) — probability = Σ over kids x and items y in x's list of (1/n)·(1/k_x)·(cnt_y/n), all mod 998244353.
- 1420D Rescue Nibel! (1800) — sweep lamp events; each lamp turning on with c lamps already on adds C(c, k−1).
