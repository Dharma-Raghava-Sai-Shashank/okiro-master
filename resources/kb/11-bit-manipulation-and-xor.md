---
topic: Bit Manipulation and XOR
tags: [bitmasks, math, greedy, constructive algorithms, dp, combinatorics, data structures]
---
# Bit Manipulation and XOR

## Recognize it (bit manipulation)
- Operations AND (&), OR (|), XOR (^) appear in the statement or in the formula to optimize.
- Values up to 2^30 or 2^60: you can afford a loop over 30–60 bits per element (O(n log A)).
- "Maximize the xor/AND of ...": greedy bit by bit from the highest bit.
- "Sum over all pairs/subarrays of xor (or AND/OR)": treat each bit independently and count contributions.
- Subsets of a small set (k ≤ 20): bitmasks represent subsets; iterate over all masks or submasks.
- Operations that look strange but preserve per-bit counts (e.g. replace (x, y) with (x & y, x | y)).
- "Find x such that ..." where x is a non-negative integer and the condition is bitwise: decide x's bits from the top.
- Subset xor questions: "can xor of a subset equal k", "maximum subset xor", "number of distinct subset xors" → xor basis.

## Core idea: XOR properties and per-bit thinking
- XOR is addition mod 2 per bit: x ^ x = 0, x ^ 0 = x, commutative and associative; it is its own inverse: if a ^ b = c then a ^ c = b.
- Prefix xor: px[i] = a[1] ^ ... ^ a[i]; xor(l..r) = px[r] ^ px[l−1]. A subarray has xor 0 iff two prefix xors are equal.
- XOR of 1..n has period 4: n % 4 == 0 → n, 1 → 1, 2 → n + 1, 3 → 0.
- a + b = (a ^ b) + 2·(a & b). Also a ^ b ≤ a + b and a | b = (a ^ b) + (a & b).
- Per-bit independence: for sums of xor over pairs, bit b contributes 2^b · cnt0_b · cnt1_b. For sums of AND, 2^b · C(cnt1_b, 2); for OR, 2^b · (total pairs − C(cnt0_b, 2)).
- (x & y, x | y) replacement keeps the number of set bits in each position across the array; only the distribution changes.
- Comparing a & b with a ^ b: a & b ≥ a ^ b iff a and b have the same highest set bit.
- Highest set bit: 63 − __builtin_clzll(x) (x > 0). Lowest set bit: x & −x. Popcount: __builtin_popcountll(x). Clear lowest set bit: x & (x − 1). Test bit: x >> b & 1.
- Powers of two: x > 0 and (x & (x − 1)) == 0.
- Distinct values: OR (or AND, or gcd) of all subarrays ending at r takes at most log2(A)+1 distinct values, because each change adds (removes) at least one bit. So all subarray ORs number O(n log A).
- Greedy from the high bit: bit b is worth more than all lower bits combined (2^b > 2^b − 1), so lexicographic decisions over bits from the top are optimal for maximize/minimize objectives.

## C++ template (bits, submasks, OR-subarrays, xor basis)
```cpp
#include <bits/stdc++.h>
using namespace std;
using ll = long long;

int highBit(ll x) { return 63 - __builtin_clzll(x); }          // x > 0
ll lowBit(ll x) { return x & -x; }
ll xorUpTo(ll n) { ll r[4] = {n, 1, n + 1, 0}; return r[n % 4]; } // 1 ^ 2 ^ ... ^ n

// Iterate over all non-empty submasks of mask (total over all masks: 3^k).
void forSubmasks(int mask) {
    for (int s = mask; s > 0; s = (s - 1) & mask) {
        // use s
    }
}

// Sum over all pairs i<j of (a_i ^ a_j), per-bit counting.
ll sumPairXor(const vector<ll>& a) {
    ll res = 0;
    for (int b = 0; b < 31; b++) {
        ll ones = 0;
        for (ll x : a) ones += x >> b & 1;
        res += (1LL << b) * ones * ((ll)a.size() - ones);
    }
    return res;
}

// Number of distinct values of OR over all subarrays: keep the set of ORs
// of subarrays ending at r (at most ~31 values).
int distinctSubarrayOr(const vector<int>& a) {
    set<int> all; vector<int> cur;
    for (int x : a) {
        vector<int> nxt = {x};
        for (int v : cur) if ((v | x) != nxt.back()) nxt.push_back(v | x);
        cur = nxt;
        all.insert(cur.begin(), cur.end());
    }
    return all.size();
}

// XOR linear basis over 60 bits.
struct XorBasis {
    ll b[60] = {};
    int rank = 0;
    bool insert(ll x) {                     // returns false if x is already representable
        for (int i = 59; i >= 0; i--) if (x >> i & 1) {
            if (!b[i]) { b[i] = x; rank++; return true; }
            x ^= b[i];
        }
        return false;
    }
    bool canMake(ll x) const {
        for (int i = 59; i >= 0; i--) if (x >> i & 1) {
            if (!b[i]) return false;
            x ^= b[i];
        }
        return true;
    }
    ll maxXor() const {
        ll r = 0;
        for (int i = 59; i >= 0; i--) r = max(r, r ^ b[i]);
        return r;
    }
};
```

## Bit-by-bit greedy from the high bit (bit manipulation)
Pattern for "find x maximizing/minimizing some bitwise function" or "maximize the AND of pairings":
1. Keep the answer built so far, ans, and decide bits from b = 30 (or 59) down to 0.
2. Tentatively set bit b: candidate = ans | (1 << b). Check whether the candidate is still achievable given the higher-bit decisions (the check usually looks only at the bits in the candidate mask).
3. If achievable keep it, otherwise leave the bit 0.
Examples:
- Maximum AND of a[i] ^ b[p(i)] over a pairing p: candidate mask works iff the multiset {a_i & mask} equals the multiset {~b_i & mask} (sort both and compare).
- Choose x to minimize the number of inversions of a ^ x: process bits from the top, split the array into groups sharing the same higher bits (a trie or recursive partition); in each group count pairs where the current bit creates an inversion with bit 0 vs bit 1, and choose the cheaper option per bit (summing over groups).
- Maximum xor of two elements: insert numbers into a binary trie and for each query walk the trie preferring the opposite bit.
- Counting x ≤ N with a bitwise property: digit DP over bits with a "tight" flag.
Proof: the contribution of bit b dominates the sum of all lower bits, so a higher-bit improvement never loses to lower-bit losses.

## Variations and tricks (bit manipulation)
- Count pairs with a_i & a_j ≥ a_i ^ a_j: group by highest set bit; count C(cnt, 2) per group.
- Sum of differences between consecutive numbers 0..n in bits (number of changed bits): Σ_b floor(n / 2^b).
- Redistributing bits (x & y, x | y): per-bit counts are invariant; to maximize the sum of squares, greedily build numbers by taking one bit from every non-empty bit position.
- Counting arrays by AND vs XOR per bit: AND of all elements has bit b only if all have it; XOR's bit is the parity of how many have it. Do DP from the highest bit where the comparison is decided.
- Reachability with x → x + y when x & y = y (y submask of x): reachable from u to v iff u ≤ v and for every k, popcount of u's lowest k bits ≥ popcount of v's lowest k bits.
- xor = sum - 2·and, so given s = a + b and x = a ^ b, a & b = (s − x)/2 must be a non-negative integer with no common bits with x.
- Construct an array with xor 0 or given xor: add two numbers x and x ^ target with a large unused bit (e.g. 2^29) to stay distinct.
- Gray code: g(i) = i ^ (i >> 1) — consecutive values differ in one bit.
- Bitmask DP over subsets: dp[mask] with transitions adding one element; SOS DP (sum over subsets) in O(2^k · k).
- Bitset for subset-sum/reachability: bitset<N> b; b |= b << w — divides the O(n·W) DP by 64.
- Number of distinct subset xors = 2^rank of the xor basis; the k-th smallest uses the reduced basis.

## Pitfalls (bit manipulation)
- `1 << 40` overflows int; write `1LL << 40`.
- Operator precedence: `a & b == c` parses as `a & (b == c)`; always parenthesize bitwise expressions: `(a & b) == c`.
- `__builtin_clz(0)` is undefined; check x > 0.
- `__builtin_popcount` takes unsigned int; use `__builtin_popcountll` for 64-bit values.
- Right-shifting negative numbers is implementation-defined (arithmetic in practice); prefer unsigned or non-negative values.
- Using int masks for k > 31 elements.
- Forgetting that ~x has all high bits set (sign bit); mask it: (~x) & ((1 << B) − 1).
- Assuming AND/OR of a subarray is invertible like xor (it is not; use prefix only for xor and sums, sparse tables or bit counts for AND/OR ranges).
- Submask enumeration loop missing the empty submask (if needed, handle s = 0 separately).

## Classic Codeforces problems (bit manipulation)
- 1420B Rock and Lever (1200) — a_i & a_j ≥ a_i ^ a_j iff both share the highest set bit; count pairs per highest bit.
- 1362C Johnny and Another Rating Drop (1400) — total changed bits from 0 to n equals Σ_b floor(n / 2^b).
- 1368D AND, OR and square sum (1700) — the operation preserves per-bit counts; greedily assemble numbers taking one bit from each non-empty position to maximize the sum of squares.
- 1557C Moamen and XOR (1700) — per-bit casework from the highest bit: either all bits equal so far, or AND wins at bit b (possible only when n is even); multiply counts mod 1e9+7.
- 1491D Zookeeper and The Infinite Zoo (1800) — u reaches v iff u ≤ v and every low-bit prefix of u has at least as many set bits as the same prefix of v.
- 1721D Maximum AND (1800) — build the answer from the high bit; a mask is feasible iff sorted (a_i & mask) equals sorted (~b_i & mask).
- 1416C XOR Inverse (2000) — decide x bit by bit from the top; within groups sharing higher bits, count inversions created by bit 0 vs bit 1 and pick the cheaper.
- 1101G (Zero XOR Subset)-less (2300) — the answer is the rank of the xor basis of prefix xors (−1 if the total xor is 0); a harder application of linear basis.
