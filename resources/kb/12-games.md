---
topic: Combinatorial Games (Win/Lose, Nim, Sprague-Grundy)
tags: [games, math, dp, brute force, constructive algorithms, number theory]
---
# Combinatorial Games (Win/Lose, Nim, Sprague-Grundy)

## Recognize it (games)
- "Two players alternate moves, both play optimally, who wins?" — output "Alice/Bob", "First/Second", "Ashish/Utkarsh".
- The game is finite, deterministic, with perfect information, and usually impartial (both players have the same moves from each state).
- Constraints are large (n up to 10^9 or 10^18, many test cases) — the answer is a formula on parity, mod k, or a simple characterization, discovered from small cases.
- Several independent sub-games played in parallel (piles, components, independent rows) — Nim/Sprague–Grundy XOR.
- A board with symmetry, or a move that can be copied by the second player — mirror strategy.
- A game on a tree or graph where the target vertex is special (leaf, center) — degree/parity arguments.
- Normal play convention: the player who cannot move loses (assume this unless stated; misère rules flip some answers).

## Core idea (win/lose positions)
For an impartial finite game, every state is either winning (W) or losing (L) for the player to move:
- A terminal state (no moves) is L under normal play.
- A state is W iff at least one move leads to an L state.
- A state is L iff every move leads to a W state.
Compute this by memoized recursion or DP from terminal states for small parameters, print the table, and find the pattern (period, parity, mod 3, powers of two, "only one exceptional value").
Proving the pattern: define the claimed set of L positions and check two facts: (1) from every L position, every move goes to a W position; (2) from every W position, some move goes to an L position. That fully proves the characterization.
Typical strategies to look for:
- Parity: if every move reduces a count by exactly 1 and the game ends at 0, the winner is decided by parity of the total number of moves.
- Mirror/symmetry: the second player copies the first player's move in a symmetric position (center of a board, pairing of piles), so the second player always has a move. The first player can sometimes make a symmetric position with the first move and then mirror.
- Strategy stealing: if the first player could pass or "waste" a move without changing anything, the first player cannot lose.
- Control the forced moves: a player who decides the parity of the remaining forced moves wins (e.g. the first pile with more than one stone in sequential Nim).
- Keeping an invariant: the winner can always restore an L position (e.g. making a total even, making the xor 0, keeping a multiple of k+1).

## Core idea (Nim and Sprague–Grundy)
Nim: piles a_1..a_n, a move removes any positive number of stones from one pile, the player unable to move loses. The first player wins iff a_1 ^ a_2 ^ ... ^ a_n ≠ 0. Winning move: pick a pile with a_i ^ X < a_i (X = total xor) and reduce it to a_i ^ X.
Sprague–Grundy theorem: every impartial game position has a Grundy number g = mex{g(next states)} (mex = minimum excluded non-negative integer). g = 0 ⇔ losing. A sum of independent games (the player moves in exactly one component per turn) has Grundy number equal to the XOR of the components' Grundy numbers.
Workflow:
1. Split the game into independent components (piles, connected components, segments between blocked cells).
2. Compute g for small component sizes by brute force (mex over moves).
3. Find a pattern in g (periodic, g(n) = n mod (k+1), g depends on the highest power of 2 dividing n, etc.).
4. XOR the components' values; non-zero → first player wins.
Common Grundy facts: subtraction game with moves {1..k}: g(n) = n mod (k+1). Moves that split a pile into two piles: g = mex over g(a) ^ g(b). A game where a move from n goes to any smaller value: g(n) = n (that is Nim).
Misère Nim (last player to move loses): same as normal Nim unless all piles are 1, in which case the first player wins iff the number of piles is even.

## C++ template (games)
```cpp
#include <bits/stdc++.h>
using namespace std;

// Brute-force win/lose table for a single-number game: from n you may move to
// n - d for allowed d (example: subtract 1, 2 or k). Print and look for a pattern.
vector<int> winTable(int maxN, const vector<int>& moves) {
    vector<int> win(maxN + 1, 0);                    // win[0] = 0 (no move -> lose)
    for (int n = 1; n <= maxN; n++)
        for (int d : moves) if (d <= n && !win[n - d]) { win[n] = 1; break; }
    return win;
}

// Grundy numbers with mex, for a subtraction game with an arbitrary move set.
vector<int> grundyTable(int maxN, const vector<int>& moves) {
    vector<int> g(maxN + 1, 0);
    for (int n = 1; n <= maxN; n++) {
        vector<char> seen(moves.size() + 2, 0);
        for (int d : moves) if (d <= n && g[n - d] < (int)seen.size()) seen[g[n - d]] = 1;
        int m = 0; while (seen[m]) m++;
        g[n] = m;
    }
    return g;
}

// Generic memoized search over encoded states (state -> list of next states).
map<long long, bool> memo;
bool winning(long long state, const function<vector<long long>(long long)>& nextStates) {
    auto it = memo.find(state);
    if (it != memo.end()) return it->second;
    bool res = false;
    for (long long s : nextStates(state)) if (!winning(s, nextStates)) { res = true; break; }
    return memo[state] = res;
}

// Nim: first player wins iff xor != 0.
bool nimFirstWins(const vector<long long>& piles) {
    long long x = 0; for (long long p : piles) x ^= p;
    return x != 0;
}
```

## Finding the pattern by brute force over small states (games)
- Encode the state compactly (n, or a tuple, or a sorted vector of piles, or a bitmask of a small board) and run memoized recursion over all states up to a small size (n ≤ 30, piles ≤ 6 each, boards ≤ 4×4).
- Print W/L (or Grundy numbers) in a table indexed by the parameters; for two parameters print a grid. Look for: periodicity in n, dependence on n mod 2/3/4/(k+1), dependence on whether n is a power of two, on the number of odd elements, on whether max > sum − max.
- Check special values separately: n = 1, n = 2, the exceptional k values (e.g. when k is a multiple of 3 in a 1-2-k subtraction game the period becomes k+1).
- Once a formula is guessed, verify it against the brute force for all small states programmatically (assert equality), then prove it with the L/W closure argument.
- For games on strings or arrays, brute force over all short strings (length ≤ 10 over a 2-letter alphabet) to see what matters (number of zeros, positions of a character, palindrome structure).
- For tree games, brute force over small trees (paths, stars) to see whether the answer depends on degree of the special vertex or on n's parity.

## Pitfalls (games)
- Answering with intuition ("the first player always takes the biggest pile") without brute-force verification — many game problems are designed so intuitive strategies fail.
- Mixing normal and misère play.
- Forgetting that a player might be forced to move (no passing) — forced moves often decide parity.
- Wrong winner names or swapped output (who moves first?).
- XORing Grundy values for games that are not sums (if a move affects several components at once, Sprague–Grundy does not apply directly).
- Treating a partisan game (different moves for each player) as impartial.
- Memoization keyed on mutable containers (encode states canonically: sort piles if their order does not matter).
- Overflow in formulas with n up to 10^18 (use long long, careful with squares in geometry-based games).

## Classic Codeforces problems (games)
- 1382B Sequential Nim (1100) — let c be the number of leading piles equal to 1; if all piles are 1 the winner is decided by parity of n, otherwise the first player wins iff c is even (whoever reaches the first big pile controls the game).
- 1527B1 Palindrome Game (easy version) (1200) — string starts as a palindrome; with z zeros, z = 1 or z even → BOB, z odd and > 1 → ALICE (Alice takes the middle zero and then mirrors).
- 1220C Substring Game in the Lesson (1300) — for each k, Ann wins iff some character before position k is strictly smaller than s[k]; check with a running prefix minimum.
- 1363C Game On Leaves (1600) — if x has degree ≤ 1 the first player removes it immediately; otherwise the game lasts until two nodes remain, so the winner is decided by the parity of n.
- 1537D Deleting Divisors (1700) — odd n loses; even n that is not a power of two wins (move to an odd number); n = 2^k wins iff k is even.
- 1194D 1-2-K Game (1700) — if k is not divisible by 3, n is losing iff n % 3 == 0; otherwise reduce r = n % (k+1), and r is losing iff r % 3 == 0 and r ≠ k.
- 1396B Stoned Game (1800) — if the largest pile exceeds the sum of the others, the first player wins by always taking it; otherwise the winner is decided by the parity of the total.
- 1451D Circle Game (1700) — find the largest k with (kz, kz) inside the circle; the second player can mirror to stay on the diagonal, so the first player wins iff (kz, (k+1)z) is also inside.
