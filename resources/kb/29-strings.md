---
topic: Strings (Hashing, Prefix Function/KMP, Z-function, Trie, Palindromes)
tags: [strings, hashing, string suffix structures, data structures, bitmasks, greedy, trees]
---
# Strings (Hashing, Prefix Function/KMP, Z-function, Trie, Palindromes)

## Recognize it
Signals for each string technique on Codeforces:
- "Does pattern p occur in t / how many times / at which positions", |s| up to 10^6 → prefix function (KMP) or Z-function, O(n + m).
- "Longest prefix that is also a suffix (border)", "smallest period", "is s a repetition of a block", "longest string that is a prefix, a suffix and also occurs inside" → prefix function.
- "For each position, longest common prefix with the whole string", "for each suffix of t, how much of p matches" → Z-function.
- "Compare two arbitrary substrings for equality in O(1)", "count distinct substrings with some property" (n ≤ 5000), "longest common substring with binary search", "is substring a palindrome" with many queries → polynomial hashing.
- Set of words with prefix queries, "count strings with a given prefix", autocomplete, or numbers with "maximum xor with x" → trie (binary trie for xor, 30–60 levels).
- "Longest palindromic substring", "count palindromic substrings", "longest palindromic prefix" → expand around centers (n ≤ 5000) or Manacher (n ≤ 10^6).
- Lexicographically smallest/largest string after operations, delete k characters, rearrange to avoid equal neighbours → greedy on characters (see the greedy patterns section).
- Merging strings with maximal overlap, "remove the longest prefix of the next word that is a suffix of the result" → prefix function on `next + '#' + tail`.

## Core idea
**Prefix function:** pi[i] = length of the longest proper prefix of s[0..i] that is also a suffix of s[0..i]. Computed incrementally: try to extend the previous border j = pi[i−1]; on mismatch fall back to the next shorter border j = pi[j−1]. Amortized O(n) since j grows by at most 1 per step. All borders of a prefix are pi[i], pi[pi[i]−1], ... . Smallest period of s = n − pi[n−1]; s is k copies of a block iff n % (n − pi[n−1]) == 0. Pattern matching: compute pi of `p + '#' + t`; every index with pi == |p| ends an occurrence.

**Z-function:** z[i] = length of the longest common prefix of s and s[i..]. Maintain the rightmost matched window [l, r); inside it, z[i] starts from min(r − i, z[i − l]). O(n). Matching: z of `p + '#' + t`, occurrence at positions with z == |p|.

**Polynomial hashing:** H(s[l..r)) = Σ s[i] · B^(r−1−i) mod M, computed from prefix hashes in O(1). Equal strings always have equal hashes; unequal ones collide with probability ≈ n/M per comparison for a random base. Use mod 2^61 − 1 (one 61-bit modulus, fast multiplication with __int128) or two 1e9-scale moduli, and a **random base** so anti-hash tests (common in Codeforces hacks against fixed bases and 2^64 overflow hashing) cannot target you.

**Trie:** a tree of prefixes; node = prefix, edge = next character. Insert/search O(length). Store counts per node (number of strings passing through, number ending here) to answer prefix counts and support deletion.

**Palindromes:** every palindrome has a center (a character or a gap). Expanding from all 2n − 1 centers is O(n²) worst case but trivial. Manacher reuses the mirror of the current rightmost palindrome to get all radii in O(n).

## C++ template: hashing mod 2^61 − 1 with a random base
```cpp
using u64 = unsigned long long;
const u64 MOD = (1ULL << 61) - 1;
u64 mulmod(u64 a, u64 b) {                          // a, b < MOD
    __uint128_t c = (__uint128_t)a * b;
    u64 r = (u64)(c & MOD) + (u64)(c >> 61);        // 2^61 == 1 (mod MOD)
    return r >= MOD ? r - MOD : r;
}
mt19937_64 rng(chrono::steady_clock::now().time_since_epoch().count());
const u64 BASE = uniform_int_distribution<u64>(256, MOD - 2)(rng);

struct Hasher {
    vector<u64> h, pw;                              // h[i] = hash of s[0..i)
    explicit Hasher(const string& s) : h(s.size() + 1, 0), pw(s.size() + 1, 1) {
        for (size_t i = 0; i < s.size(); i++) {
            h[i + 1] = (mulmod(h[i], BASE) + (unsigned char)s[i]) % MOD;
            pw[i + 1] = mulmod(pw[i], BASE);
        }
    }
    u64 get(int l, int r) const {                   // hash of s[l..r), half-open
        return (h[r] + MOD - mulmod(h[l], pw[r - l])) % MOD;
    }
};
```
Uses of hashing: substring equality in O(1); LCP of two suffixes by binary search on length (O(log n)), hence comparing substrings lexicographically; palindrome check by hashing s and reverse(s) (s[l..r) is a palindrome iff its hash equals the hash of the mirrored range in the reversed string: `rev.get(n − r, n − l)`); longest common substring of two strings by binary search on length + hash set; cyclic shifts as substrings of s + s. Combining hashes of concatenations: H(XY) = H(X) · B^|Y| + H(Y).

**Counting distinct substrings by hashing** (n ≤ ~3000): push the hash of every qualifying substring into a vector, `sort` + `unique`. Example (271D Good Substrings: substrings with at most k "bad" letters):
```cpp
long long countDistinctGood(const string& s, const string& goodMask, int k) {
    int n = s.size();
    Hasher H(s);
    vector<u64> all;
    for (int i = 0; i < n; i++) {
        int bad = 0;
        for (int j = i; j < n; j++) {
            bad += goodMask[s[j] - 'a'] == '0';
            if (bad > k) break;
            all.push_back(H.get(i, j + 1));
        }
    }
    sort(all.begin(), all.end());
    return unique(all.begin(), all.end()) - all.begin();
}
```
~10^6 hashes into 2^61 gives collision probability around 10^−7. With a 32-bit modulus the birthday bound makes collisions near certain for 10^6 values; that is why single 1e9+7 hashing fails on distinct-substring counting. A trie of all suffixes (n ≤ 3000, n²/2 nodes worst case) is the deterministic alternative.

## C++ template: prefix function (KMP) and Z-function
```cpp
vector<int> prefixFunction(const string& s) {
    int n = s.size();
    vector<int> pi(n, 0);
    for (int i = 1; i < n; i++) {
        int j = pi[i - 1];
        while (j > 0 && s[i] != s[j]) j = pi[j - 1];
        if (s[i] == s[j]) j++;
        pi[i] = j;
    }
    return pi;
}

vector<int> zFunction(const string& s) {
    int n = s.size();
    vector<int> z(n, 0);
    if (n) z[0] = n;                                // convention: whole string matches itself
    for (int i = 1, l = 0, r = 0; i < n; i++) {     // [l, r) = rightmost window matching a prefix
        if (i < r) z[i] = min(r - i, z[i - l]);
        while (i + z[i] < n && s[z[i]] == s[i + z[i]]) z[i]++;
        if (i + z[i] > r) { l = i; r = i + z[i]; }
    }
    return z;
}

// Occurrences of p in t (start positions), via prefix function on p + sep + t.
vector<int> findAll(const string& p, const string& t) {
    string s = p + '\x01' + t;                      // separator must not occur in p or t
    vector<int> pi = prefixFunction(s), res;
    int m = p.size();
    for (int i = m + 1; i < (int)s.size(); i++)
        if (pi[i] == m) res.push_back(i - 2 * m);   // end index in t is i - m - 1
    return res;
}
```
**Count occurrences of every prefix inside s** (432D Prefixes and Suffixes):
```cpp
vector<int> pi = prefixFunction(s);
int n = s.size();
vector<long long> cnt(n + 1, 0);
for (int i = 0; i < n; i++) cnt[pi[i]]++;
for (int len = n; len > 0; len--) cnt[pi[len - 1]] += cnt[len];   // pass counts down the border chain
for (int len = 1; len <= n; len++) cnt[len]++;                    // the prefix itself
// borders: for (int len = n; len > 0; len = pi[len - 1]) -> prefix of length len equals the suffix
```
Typical uses: 126B Password (candidate = pi[n−1]; it is valid if some pi[i] with i < n − 1 reaches it, otherwise try pi[pi[n−1]−1]); 1200E Compress Words (overlap of the next word with the current tail = pi value at the end of `word + '#' + last |word| chars of result`); 1137B Camp Schedule (place the pattern greedily, each next copy overlaps by its longest border). Z-function equivalents: z[i] + i == n means s[i..] is a border; z over `p + '#' + t` answers "how long a prefix of p starts at each position of t" (535D Tavas and Malekas checks overlaps of placed occurrences this way).

## C++ template: trie and binary trie (maximum xor)
```cpp
struct Trie {                                       // lowercase words
    vector<array<int, 26>> nxt;
    vector<int> pass, ends;                         // strings through node / ending at node
    Trie() { newNode(); }
    int newNode() {
        nxt.emplace_back(); nxt.back().fill(-1);
        pass.push_back(0); ends.push_back(0);
        return (int)nxt.size() - 1;
    }
    void insert(const string& s) {
        int v = 0; pass[v]++;
        for (char ch : s) {
            int c = ch - 'a';
            if (nxt[v][c] == -1) { int u = newNode(); nxt[v][c] = u; }
            v = nxt[v][c]; pass[v]++;
        }
        ends[v]++;
    }
    int countPrefix(const string& s) {              // number of inserted strings with prefix s
        int v = 0;
        for (char ch : s) { v = nxt[v][ch - 'a']; if (v == -1) return 0; }
        return pass[v];
    }
};

struct XorTrie {                                    // multiset of values in [0, 2^30)
    static const int B = 30;
    vector<array<int, 2>> ch;                       // child 0 means "absent" (0 is the root)
    vector<int> cnt;
    XorTrie() : ch(1, {0, 0}), cnt(1, 0) {}
    void update(int x, int d) {                     // d = +1 insert, -1 erase (x must be present)
        int v = 0; cnt[v] += d;
        for (int b = B - 1; b >= 0; b--) {
            int c = x >> b & 1;
            if (!ch[v][c]) { ch[v][c] = ch.size(); ch.push_back({0, 0}); cnt.push_back(0); }
            v = ch[v][c]; cnt[v] += d;
        }
    }
    int maxXor(int x) const {                       // requires a non-empty multiset
        int v = 0, res = 0;
        for (int b = B - 1; b >= 0; b--) {
            int want = (x >> b & 1) ^ 1;
            int u = ch[v][want];
            if (u && cnt[u] > 0) { res |= 1 << b; v = u; }
            else v = ch[v][want ^ 1];
        }
        return res;
    }
};
```
Binary trie greedy: from the highest bit, prefer the child that makes the xor bit 1. Min xor: prefer the same bit. Counting "pairs with xor < k": walk the bits of k, adding whole subtrees when the xor bit is fixed below k's bit. Memory: N · B nodes (2·10^5 · 30 = 6·10^6 nodes × 12 bytes ≈ 72 MB); reserve or use static arrays and check the memory limit. Max xor subarray = max over pairs of prefix xors (insert 0 first). 706D Vasiliy's Multiset is exactly insert/erase/max-xor; 923C Perfect Security greedily pairs each a_i with the key minimizing a_i xor key, erasing used keys.

## Palindromes: expand around center and Manacher
Expand around center, O(n²) worst case, enough for n ≤ 5000: for each center c (both odd `c, c` and even `c, c+1`), grow while the ends match; also gives "is s[l..r] a palindrome" for all pairs via dp: pal[l][r] = s[l] == s[r] && pal[l+1][r−1].

Manacher in O(n) on the transformed string t = "#s0#s1#...#" so that every palindrome has odd length in t:
```cpp
// p[i] = largest k with t[i-k..i+k] a palindrome; in s this is a palindrome of length p[i]
// starting at index (i - p[i]) / 2.
vector<int> manacher(const string& s) {
    string t = "#";
    for (char c : s) { t += c; t += '#'; }
    int m = t.size();
    vector<int> p(m, 0);
    for (int i = 0, c = 0, r = -1; i < m; i++) {      // [c - p[c], r] = rightmost palindrome found
        int k = (i <= r) ? min(p[2 * c - i], r - i) : 0;
        while (i - k - 1 >= 0 && i + k + 1 < m && t[i - k - 1] == t[i + k + 1]) k++;
        p[i] = k;
        if (i + k > r) { c = i; r = i + k; }
    }
    return p;
}
```
Uses: longest palindromic substring = max p[i]; number of palindromic substrings = Σ over i of (p[i] + 1) / 2 (each center contributes its radius count in s); "is s[l..r] a palindrome" in O(1): center index in t is l + r + 1, check p[l + r + 1] ≥ r − l + 1. Longest palindromic prefix: largest p[i] with (i − p[i]) / 2 == 0; or prefix function on `s + '#' + reverse(s)` (its last pi value). 1326D2 Prefix-Suffix Palindrome: strip the longest equal outer pairs s[i] == s[n−1−i], then take the longer of the longest palindromic prefix/suffix of the middle part.

## Variations and tricks
Common greedy patterns on strings in Codeforces:
- **Lexicographic minimum:** decide position by position; a smaller character earlier beats anything later. To delete k characters for the smallest result, use a monotonic stack: pop while the top is larger than the current character and deletions remain.
- **Rearrangements:** only character counts matter (anagrams, palindromes need ≤ 1 odd count, "no two equal adjacent" needs max count ≤ (n + 1) / 2).
- **Subsequence questions:** two pointers for one check; `nxt[i][c]` (next occurrence of c at or after i) for many checks in O(|p|) each; counting subsequences "abc" with dp over prefix counts.
- **Cyclic shifts / rotations:** t is a rotation of s iff |s| == |t| and t occurs in s + s.
- **Equal characters at mirrored or periodic positions:** positions forced equal form groups (DSU or direct indexing); in each group keep the most frequent letter (1332C K-Complete Word).
- **Adjacent swaps to transform s into t** = inversions of the matched index sequence (match the k-th occurrence of each letter in order), counted with a Fenwick (1430E String Reversal).
- **Binary strings:** compress into runs (run-length encoding); answers usually depend on run counts and lengths.
- **Small alphabet:** iterate over all 26 letters as the "target" and solve each in O(n).
- **Periodicity:** the minimal period from the prefix function; any period p and q with p + q ≤ n + gcd(p, q) implies period gcd(p, q) (Fine–Wilf), useful in proofs.

## Pitfalls
- Fixed base with mod 2^64 overflow hashing: Thue–Morse anti-hash tests break it deterministically. Always random base, prime modulus.
- Single 1e9+7 modulus with ~10^6 compared hashes: birthday collisions. Use mod 2^61 − 1 or a pair of moduli.
- Mapping 'a' → 0 in hashing makes "a" and "aa" both hash to 0; add 1 or use the raw char code (as above).
- Separator in `p + sep + t` must not appear in either string; without it pi can exceed |p|.
- Prefix function index confusion: pi[i] refers to the prefix ending at i (length i + 1); borders of the whole string start at pi[n − 1].
- Z-function z[0] convention differs between implementations (0 or n); check before using it.
- Trie with `array<int, 26>` per node and 10^6 total characters: 104 MB. Use smaller alphabets, map children, or count nodes carefully.
- Binary trie bit count: values up to 10^9 need 30 bits, up to 10^18 need 60 bits with `1LL << b`.
- O(n²) substring loops with `s.substr` create copies: O(n³). Use hashes or indices.
- Recursive DFS on a trie of depth 10^6 can overflow the stack; iterate.

## Classic Codeforces problems
- 126B Password (1700) — border pi[n−1] must also appear as some pi[i] inside; otherwise fall back to the next border.
- 432D Prefixes and Suffixes (2000) — walk the border chain of pi[n−1]; occurrence counts of each prefix by pushing counts down pi.
- 1200E Compress Words (2000) — overlap via prefix function on `word + '#' + tail of the result`, only the last |word| characters.
- 271D Good Substrings (1800) — enumerate substrings with at most k bad letters, count distinct by 61-bit hashing (or a trie).
- 706D Vasiliy's Multiset (1800) — binary trie with counts supports insert, erase and maximum xor greedily from the top bit.
- 1326D2 Prefix-Suffix Palindrome (Hard version) (1800) — strip matching ends, then the longest palindromic prefix or suffix of the middle via prefix function or Manacher.
