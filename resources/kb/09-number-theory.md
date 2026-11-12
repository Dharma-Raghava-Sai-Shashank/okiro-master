---
topic: Number Theory (GCD, Sieve, Factorization, Modular Arithmetic)
tags: [number theory, math, brute force, greedy, constructive algorithms]
---
# Number Theory (GCD, Sieve, Factorization, Modular Arithmetic)

## Recognize it (number theory)
- Divisibility words: "divides", "multiple", "gcd", "lcm", "coprime", "prime", "divisor", "remainder", "mod".
- Values up to 10^9–10^18 with few test values: trial division up to √n (3·10^4 for 10^9, 10^9 for 10^18 is too slow — then use structure, not factorization).
- Many values up to 10^6–10^7: sieve with smallest prime factor, then factorize each value in O(log a).
- "Answer modulo 10^9+7 / 998244353" with division: modular inverse.
- Operations that preserve gcd (subtract one number from another, add the same value to all elements → gcd of differences).
- Sum over i of f(n / i) or counting pairs with floor quotients — floor division blocks, O(√n).
- Constructive problems on numbers (find a, b with given gcd/lcm/sum): use divisors and coprime parts.
- Problems with n ≤ 2·10^5 and a_i ≤ 2·10^5 asking about gcd of subsets/pairs: iterate over d and its multiples (harmonic sum, O(A log A)).

## Core idea: gcd, lcm and their properties (number theory)
- gcd(a, b) = gcd(b, a mod b) (Euclid), O(log min(a, b)). gcd(a, 0) = a. In C++17 use std::gcd / std::lcm (numeric header).
- gcd(a, b) = gcd(a, b − a) = gcd(a, b + k·a) for any integer k. Consequence: gcd(a_1 + x, a_2 + x, ..., a_n + x) = gcd(a_1 + x, a_2 − a_1, a_3 − a_1, ..., a_n − a_1). The differences do not depend on x, so precompute their gcd once.
- If an operation replaces (a, b) with (a, b − a) or (a − b, b), the gcd of the whole multiset is invariant; the reachable values are typically exactly the multiples of that gcd in a range.
- lcm(a, b) = a / gcd(a, b) · b (divide first to avoid overflow). lcm grows fast: lcm of 1..n exceeds 10^18 around n = 43; so "lcm of a prefix" stops changing meaningfully or overflows quickly — cap it.
- gcd of prefixes takes at most log2(a_1)+1 distinct values (each change at least halves it). Same for suffixes and for subarrays ending at r (O(n log A) distinct (r, gcd) pairs).
- gcd(a, b) · lcm(a, b) = a · b. For prime exponents: gcd takes the min exponent per prime, lcm takes the max.
- Bezout: a·x + b·y = gcd(a, b) has integer solutions; ax + by = c solvable iff gcd(a, b) | c.
- Coprime split: write n = p^k · m with gcd(p^k, m) = 1; for coprime d1, d2 dividing n with d1·d2 = n, every prime of n divides exactly one of d1, d2, so gcd(d1 + d2, n) = 1.

## Core idea: primes, sieve and factorization (number theory)
- Trial division: test divisors up to √n; if n > 1 at the end, the remainder is prime. O(√n) per number: fine for one number up to 10^12–10^14 at most, or many numbers up to 10^9 if the count is ≤ ~10^3–10^4.
- Sieve of Eratosthenes: O(N log log N) to mark primes up to N (N ≤ 10^7 fine with vector<bool> or char).
- Linear sieve: computes primes and the smallest prime factor spf[x] for all x ≤ N in O(N); each composite is crossed out exactly once by its smallest prime. Then factorize any x ≤ N in O(log x) by repeated division by spf[x].
- Divisors: enumerate i from 1 to √n; if i | n add i and n/i (skip duplicate when i·i = n). O(√n).
- Divisor count bounds (useful for complexity): max d(n) is 240 for n ≤ 10^6, 1344 for n ≤ 10^9 (n = 735134400), 103680 for n ≤ 10^18. Iterating over all divisors of a number is cheap.
- Number of distinct prime factors: at most 7 for n ≤ 10^6 (510510 = 2·3·5·7·11·13·17), 8 for n ≤ 10^7, at most 9 for n ≤ 10^9 (2·3·5·7·11·13·17·19·23 = 223092870), 15 for ≤ 10^18. Subsets of prime factors (inclusion–exclusion) are therefore small.
- Euler phi: φ(n) = n · Π (1 − 1/p) over distinct primes p | n. Number of x in [1, n] coprime to n. Number of x in [0, m) with gcd(a + x, m) = gcd(a, m) = g is φ(m / g).
- Harmonic iteration: for d = 1..N, for multiples of d: total N ln N. Use it to count, for each d, how many elements are divisible by d, and then the exact count with gcd = d by subtracting multiples (Möbius-like from large to small d).

## C++ template (number theory)
```cpp
#include <bits/stdc++.h>
using namespace std;
using ll = long long;

// Linear sieve: primes and smallest prime factor up to N.
vector<int> spf, primes;
void sieve(int N) {
    spf.assign(N + 1, 0);
    for (int i = 2; i <= N; i++) {
        if (spf[i] == 0) { spf[i] = i; primes.push_back(i); }
        for (int p : primes) {
            if (p > spf[i] || (ll)i * p > N) break;
            spf[i * p] = p;
        }
    }
}
// Factorize x <= N using spf: returns (prime, exponent) pairs.
vector<pair<int,int>> factorSpf(int x) {
    vector<pair<int,int>> f;
    while (x > 1) {
        int p = spf[x], e = 0;
        while (x % p == 0) { x /= p; e++; }
        f.push_back({p, e});
    }
    return f;
}
// Trial division for one large number (up to ~1e12-1e14).
vector<pair<ll,int>> factorTrial(ll n) {
    vector<pair<ll,int>> f;
    for (ll p = 2; p * p <= n; p++) if (n % p == 0) {
        int e = 0; while (n % p == 0) { n /= p; e++; }
        f.push_back({p, e});
    }
    if (n > 1) f.push_back({n, 1});
    return f;
}
// All divisors in O(sqrt n), sorted.
vector<ll> divisors(ll n) {
    vector<ll> small, large;
    for (ll i = 1; i * i <= n; i++) if (n % i == 0) {
        small.push_back(i);
        if (i != n / i) large.push_back(n / i);
    }
    small.insert(small.end(), large.rbegin(), large.rend());
    return small;
}
// Fast power mod m, inverse via Fermat (m prime), extended gcd.
ll power(ll b, ll e, ll m) {
    ll r = 1 % m; b %= m; if (b < 0) b += m;
    for (; e > 0; e >>= 1, b = b * b % m) if (e & 1) r = r * b % m;
    return r;
}
ll invPrime(ll a, ll p) { return power(a, p - 2, p); }       // a not divisible by p
ll extgcd(ll a, ll b, ll& x, ll& y) {                       // a*x + b*y = gcd(a, b)
    if (b == 0) { x = 1; y = 0; return a; }
    ll x1, y1, g = extgcd(b, a % b, x1, y1);
    x = y1; y = x1 - (a / b) * y1;
    return g;
}
ll invGeneral(ll a, ll m) {                                 // -1 if gcd(a, m) != 1
    ll x, y; ll g = extgcd(((a % m) + m) % m, m, x, y);
    if (g != 1) return -1;
    return ((x % m) + m) % m;
}
// Euler phi by trial division.
ll phi(ll n) {
    ll r = n;
    for (ll p = 2; p * p <= n; p++) if (n % p == 0) {
        while (n % p == 0) n /= p;
        r -= r / p;
    }
    if (n > 1) r -= r / n;
    return r;
}
// Sum over i=1..n of (n / i) in O(sqrt n) using floor-division blocks.
ll sumFloor(ll n) {
    ll s = 0;
    for (ll i = 1; i <= n; ) {
        ll q = n / i, j = n / q;         // n / k == q for all k in [i, j]
        s += q * (j - i + 1);
        i = j + 1;
    }
    return s;
}
```

## Modular arithmetic essentials (number theory)
- Work with a fixed prime modulus (10^9+7 or 998244353) declared `const` so the compiler optimizes `%`.
- Addition: (a + b) % M; subtraction: ((a − b) % M + M) % M — C++ `%` keeps the sign of the dividend, so negative values must be normalized.
- Multiplication: (a % M) * (b % M) % M in 64-bit; both factors must be < M ≈ 10^9 so the product < 10^18 fits in long long.
- Division by b ⇔ multiplication by b^(M−2) mod M (Fermat), valid only when M is prime and b mod M ≠ 0. For a non-prime modulus, the inverse exists iff gcd(b, M) = 1, computed with extended Euclid.
- Fast exponentiation is O(log e). Exponents can be reduced mod (M − 1) when the base is coprime to M (Fermat), e.g. a^(b^c) mod M = a^(b^c mod (M−1)) mod M.
- Precompute inverses of 1..n in O(n): inv[1] = 1, inv[i] = (M − (M / i) · inv[M % i] % M) % M.
- Comparisons do not survive modulo: if you need "which is larger", compare the real values (with logs, __int128, or capped arithmetic), not the residues.
- Products of two values up to 10^18 modulo something: use __int128 for the intermediate.
- Products of all numbers coprime to n modulo n: equals −1 (n − 1) for n = 1, 2, 4, p^k, 2p^k, else 1 (generalized Wilson); in CF problems remove one element to fix the product to 1.

## Floor division and parity tricks (number theory)
- n / i (integer division) takes at most 2√n distinct values for i = 1..n. Iterate over blocks [i, j] with j = n / (n / i): O(√n). Used for sums like Σ f(n / i), Σ (n mod i) = Σ (n − i · (n / i)), and divisor-sum-like counts.
- ceil(a / b) for positive integers = (a + b − 1) / b. For possibly negative a, use floor division carefully: floorDiv(a, b) = a / b − ((a % b != 0) && ((a < 0) != (b < 0))).
- Number of multiples of d in [l, r] = r / d − (l − 1) / d (for l ≥ 1).
- Parity: a + b is even iff a, b have the same parity; a product is odd iff all factors are odd; n(n+1)/2 parity depends on n mod 4.
- Squares: x is a perfect square iff all prime exponents are even; to compute the square-free part, keep primes with odd exponent (useful for "product is a perfect square" pairing problems).
- Numbers of the form 2^k: x & (x − 1) == 0. Odd part: x / (x & −x).
- Digits: the sum of digits is congruent to the number mod 9 (and mod 3); divisibility by 11 via alternating digit sums.
- Integer square root: use sqrtl then correct with while loops to avoid floating-point off-by-one.

## Pitfalls (number theory)
- Overflow in `i * i <= n` with int i when n near 10^18 — use long long i.
- Overflow in lcm: compute a / gcd(a, b) * b and check against a limit (or use __int128).
- Sieving to 10^7 with vector<int> spf (40 MB) is fine, but with long long or extra arrays may hit memory limits.
- Fermat inverse with a non-prime modulus or with a value divisible by the modulus (returns 0, silently wrong).
- Negative numbers with `%`.
- gcd(0, 0) = 0; dividing by a gcd that might be zero.
- Trial division per test for many test cases with values up to 10^9: 10^4 tests × 3·10^4 = 3·10^8 — borderline; precompute primes up to 31623 and divide only by primes (≈ 3400 primes).
- Forgetting the leftover prime factor > √n after trial division.
- Using pow() from cmath for integer powers (floating point error).

## Classic Codeforces problems (number theory)
- 1360D Buying Shovels (1300) — find the largest divisor of n that is ≤ k by enumerating divisors up to √n; the answer is n divided by it.
- 1458A Row GCD (1600) — gcd(a_1 + b, ..., a_n + b) = gcd(a_1 + b, gcd of all a_i − a_1); precompute the difference gcd once.
- 1349A Orac and LCM (1600) — answer = lcm over i of gcd(a_i, suffix gcd of a_{i+1..n}); equivalently each prime contributes its second-smallest exponent.
- 1514C Product 1 Modulo N (1600) — take every x in [1, n−1] coprime to n; if their product mod n is p ≠ 1, remove p (which is itself in the set).
- 1295D Same GCDs (1800) — with g = gcd(a, m), the count of x in [0, m) with gcd(a + x, m) = g is φ(m / g).
- 1366D Two Divisors (2000) — with smallest prime p of a_i, take d1 = p^k (full power) and d2 = a_i / p^k; if d2 = 1 print −1; coprime parts give gcd(d1 + d2, a_i) = 1. Use a linear sieve for 10^7.
