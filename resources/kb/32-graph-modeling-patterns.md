---
topic: Graph Modeling Patterns (Hidden Graphs in Codeforces Problems)
tags: [graphs, dfs and similar, dsu, shortest paths, constructive algorithms, math, greedy]
---
# Graph Modeling Patterns (Hidden Graphs in Codeforces Problems)

## Recognize it
Many Codeforces problems never say "graph". Signals that a graph is hiding in the statement:
- "Minimum number of operations to turn x into y" where each operation is one of a few moves (double, subtract 1, flip, swap adjacent) → states are nodes, operations are edges, BFS (520B Two Buttons).
- Grid or board with **extra information** you must remember (keys collected, walls broken so far, direction faced, time modulo k, parity of moves) → node = (cell, extra state), BFS/Dijkstra on the product graph.
- "From position i you can jump to i ± a[i]", "teleport between cells with the same letter" → implicit graph; often BFS on the **reversed** edges from all targets at once (1272E Nearest Opposite Parity).
- Every element points to exactly one other element: "a_i is the friend/next room/target of i", "i → p_i" → functional graph (each component is one cycle with trees hanging into it).
- A permutation and "after how many steps does i return", "minimum swaps to sort", "how many permutations can be obtained by swapping a_i and b_i columns" → cycle decomposition of the permutation.
- Constraints between pairs: "x and y must be equal", "x and y must differ", "x is before y", "x_j − x_i ≤ w" → edges with meaning: DSU for equality, 2-colouring for "differ"/parity, topological sort for order, shortest paths for difference constraints.
- Items with two attributes (domino with two numbers, card with two colours, cell with row and column) → attributes are vertices, items are **edges** between them; degree/cycle/component arguments solve it (1702E Split Into Two Sets).
- "Is it possible to split into two groups such that ..." with pairwise conflicts → bipartite check; "count the ways" → 2^(components) style answers.

## Core idea
Modeling is deciding **what a vertex is** and **what an edge is**, then picking the standard algorithm:
1. Vertex = the minimal information needed to continue optimally (the "state"). If two situations with the same state always have the same future, the state is complete. Count states: it must fit in memory and time (≤ ~10^7 for BFS).
2. Edge = one allowed move/operation/relation. Weighted? All equal → BFS. Weights 0/1 → 0-1 BFS with a deque. Non-negative → Dijkstra. Relations without direction or cost (equal, connected) → DSU or plain DFS components.
3. Many-to-many edges (all cells with the same value connected) are quadratic; add a **virtual vertex** per group and connect each member to it (cost split as 1 into the hub and 0 out, or 0.5 + 0.5 scaled by 2).
4. Many sources or many targets → multi-source BFS: push all sources with distance 0. "Distance from each vertex to the nearest target" → reverse all edges and run multi-source BFS from the targets.
5. Bound the state space: values that can never help (numbers above 2·max for 520B, positions outside the array) are cut.
6. Structural facts replace search: functional graphs are cycles with in-trees; permutations are disjoint cycles; a graph where all degrees are 2 is a union of cycles; "items as edges" makes connected components and cycle parity the whole answer.

Typical answer forms: number of components (each component needs one representative, so cost = Σ min per component), product over components (independent choices: 2 colourings per bipartite component), n − components (number of merges/swaps needed), Σ over cycles of f(cycle length).

## C++ template: BFS over states and reversed multi-source BFS
```cpp
// Grid BFS where a state is (row, col, walls broken so far). At most K walls may be broken.
int bfsWithBreaks(const vector<string>& g, int K) {
    int n = g.size(), m = g[0].size();
    auto id = [&](int r, int c, int k) { return (r * m + c) * (K + 1) + k; };
    vector<int> dist(n * m * (K + 1), -1);
    queue<int> q;
    dist[id(0, 0, 0)] = 0; q.push(id(0, 0, 0));
    const int dr[] = {1, -1, 0, 0}, dc[] = {0, 0, 1, -1};
    while (!q.empty()) {
        int s = q.front(); q.pop();
        int k = s % (K + 1), cell = s / (K + 1), r = cell / m, c = cell % m;
        if (r == n - 1 && c == m - 1) return dist[s];
        for (int d = 0; d < 4; d++) {
            int nr = r + dr[d], nc = c + dc[d];
            if (nr < 0 || nr >= n || nc < 0 || nc >= m) continue;
            int nk = k + (g[nr][nc] == '#');
            if (nk > K) continue;
            int t = id(nr, nc, nk);
            if (dist[t] == -1) { dist[t] = dist[s] + 1; q.push(t); }
        }
    }
    return -1;
}

// From i you may jump to i - a[i] or i + a[i] (a[i] >= 1). ans[i] = fewest jumps from i to any j
// whose a[j] has the opposite parity of a[i], or -1. Reverse edges + multi-source BFS per parity.
vector<int> nearestOppositeParity(const vector<int>& a) {
    int n = a.size();
    vector<vector<int>> rg(n);                       // rg[j] contains i if i can jump to j
    for (int i = 0; i < n; i++)
        for (int j : {i - a[i], i + a[i]})
            if (j >= 0 && j < n) rg[j].push_back(i);
    vector<int> ans(n, -1);
    for (int par = 0; par < 2; par++) {              // targets: a[j] % 2 == par
        vector<int> dist(n, -1);
        queue<int> q;
        for (int j = 0; j < n; j++) if (a[j] % 2 == par) { dist[j] = 0; q.push(j); }
        while (!q.empty()) {
            int v = q.front(); q.pop();
            for (int u : rg[v]) if (dist[u] == -1) { dist[u] = dist[v] + 1; q.push(u); }
        }
        for (int i = 0; i < n; i++) if (a[i] % 2 != par) ans[i] = dist[i];
    }
    return ans;
}
```
State design examples: (vertex, coupons used) for "up to k free edges" with Dijkstra on n·(k+1) states; (cell, direction) for "turning costs 1"; (vertex, time mod k) for periodic obstacles; (mask of collected items, position) for ≤ 15 items. Implicit graphs on numbers (520B: from n either double or subtract 1): BFS over values in [1, 2·max(n, m)], or think backwards from m (halve if even, else add 1), which is the greedy view of the same graph.

## C++ template: functional graphs (one outgoing edge per vertex)
```cpp
// f[v] = the unique successor of v. Computes, for every vertex: whether it lies on a cycle,
// the id of the cycle it eventually reaches, and its tail length (steps until the cycle).
struct FunctionalGraph {
    vector<int> onCycle, cycId, tail, cycLen;
    explicit FunctionalGraph(const vector<int>& f) {
        int n = f.size();
        vector<int> state(n, 0);                     // 0 unvisited, 1 on current walk, 2 finished
        onCycle.assign(n, 0); cycId.assign(n, -1); tail.assign(n, 0);
        for (int s = 0; s < n; s++) {
            if (state[s]) continue;
            vector<int> path;
            int v = s;
            while (state[v] == 0) { state[v] = 1; path.push_back(v); v = f[v]; }
            if (state[v] == 1) {                     // the walk closed a new cycle through v
                int id = cycLen.size(), len = 0, u = v;
                do { onCycle[u] = 1; cycId[u] = id; len++; u = f[u]; } while (u != v);
                cycLen.push_back(len);
            }
            for (int i = (int)path.size() - 1; i >= 0; i--) {   // successors are finished first
                int x = path[i];
                if (!onCycle[x]) { tail[x] = tail[f[x]] + 1; cycId[x] = cycId[f[x]]; }
                state[x] = 2;
            }
        }
    }
};
```
Each weakly connected component of a functional graph has **exactly one cycle**; every other vertex lies on a tail that flows into it. Facts: starting anywhere and walking long enough you end on the cycle of your component; vertex v is reached from u after k steps for all large k iff they share a cycle; "catch the mouse wherever it starts" needs one trap per cycle, the cheapest vertex on it (1027D Mouse Hunt); "who is left holding two badges" means walking from each start until a repeat (1020B Badge, n ≤ 1000, simulate). k-th successor for huge k: binary lifting up[j][v] = up[j−1][up[j−1][v]], or walk the tail then take k mod cycle length. Constructibility via cyclic operations of length k (1867D Cyclic Operations): with i → b_i, every cycle must have length exactly k (and for k = 1, b_i = i everywhere); tails are always fine.

## C++ template: permutations as cycles
```cpp
// p is a permutation of 0..n-1 (i -> p[i]). len[i] = length of the cycle containing i.
vector<int> cycleLengths(const vector<int>& p) {
    int n = p.size();
    vector<int> len(n, 0);
    for (int s = 0; s < n; s++) {
        if (len[s]) continue;
        vector<int> cyc;
        int v = s;
        do { cyc.push_back(v); v = p[v]; } while (v != s);
        for (int x : cyc) len[x] = cyc.size();
    }
    return len;
}
```
Permutation facts used constantly:
- Element i returns to itself after exactly len[i] applications (1249B2 Books Exchange prints len[i]).
- Minimum number of swaps (any two positions) to sort = n − (number of cycles). Each swap changes the cycle count by exactly ±1, so the parity of a permutation is (n − cycles) mod 2; adjacent swaps needed = number of inversions, which has the same parity.
- p^k: inside a cycle of length L, element at position t moves to position (t + k) mod L; the permutation's order is the lcm of cycle lengths (can be huge; take it modulo only if asked).
- Two permutations a, b as rows, operation "swap a_i and b_i in a column", count resulting valid configurations: edges a_i — b_i form a graph of cycles, each cycle has 2 states → 2^(cycles) (1534C Little Alawn's Puzzle).
- Matching value positions: "make a equal to b by applying a permutation" — build i → pos_in_b(a_i) and decompose into cycles.

## C++ template: parity constraints, bipartite colouring, DSU for equality
```cpp
// Constraints (u, v, w): color[u] XOR color[v] == w (w = 1 "different", 0 "same").
// Returns a valid colouring, or an empty vector if the constraints contradict (odd cycle).
vector<int> parityColor(int n, const vector<array<int, 3>>& cons) {
    vector<vector<pair<int, int>>> g(n);
    for (auto [u, v, w] : cons) { g[u].push_back({v, w}); g[v].push_back({u, w}); }
    vector<int> col(n, -1);
    for (int s = 0; s < n; s++) {
        if (col[s] != -1) continue;
        col[s] = 0;
        queue<int> q; q.push(s);
        while (!q.empty()) {
            int v = q.front(); q.pop();
            for (auto [u, w] : g[v]) {
                if (col[u] == -1) { col[u] = col[v] ^ w; q.push(u); }
                else if (col[u] != (col[v] ^ w)) return {};
            }
        }
    }
    return col;
}

// Equality constraints: positions forced equal (palindrome + period k) form DSU groups;
// in each group keep the most frequent letter. Answer = number of changed positions.
int minChangesPalindromePeriodic(const string& s, int k) {
    int n = s.size();
    vector<int> p(n);
    iota(p.begin(), p.end(), 0);
    auto find = [&](int x) { while (p[x] != x) { p[x] = p[p[x]]; x = p[x]; } return x; };
    for (int i = 0; i < n; i++) {
        p[find(i)] = find(n - 1 - i);
        if (i + k < n) p[find(i)] = find(i + k);
    }
    vector<array<int, 26>> freq(n);
    vector<int> sz(n, 0);
    for (int i = 0; i < n; i++) { int r = find(i); freq[r][s[i] - 'a']++; sz[r]++; }
    int changes = 0;
    for (int r = 0; r < n; r++)
        if (sz[r]) changes += sz[r] - *max_element(freq[r].begin(), freq[r].end());
    return changes;
}
```
`vector<array<int, 26>> freq(n)` value-initializes, so all counts start at 0. Parity colouring answers: plain bipartite check (all w = 1); per component the classes have sizes c0, c1 → "max people of one type" = Σ max(c0, c1); "count assignments where each edge has an odd endpoint sum" (1093D Beautiful Graph) = Π (2^c0 + 2^c1); orient every edge from colour 0 to colour 1 so no path of length 2 exists (1144F Graph Without Long Directed Paths). Items as edges with all degrees 2 (1702E Split Into Two Sets: numbers are vertices, dominoes are edges, any number used more than twice or a domino (x, x) → NO): components are cycles, and splitting works iff every cycle is even, i.e. the graph is bipartite. DSU handles equalities online and with merging aggregates; when you also need "different", use parity DSU (see the DSU file) or this BFS colouring offline. Counting with DSU components: when items are edges and each successful union "uses" one item, the number of useful items is (vertices − components), and the rest are wasted (1209D Cow and Snacks: flavours are vertices, guests are edges; sad guests = k − (n − components)).

## Variations and tricks
- **Constraints to DAG:** "x must come before y" from comparing adjacent sorted words, "task dependencies" → topological sort; a cycle means impossible. Choosing directions for undirected edges so the result is acyclic: topologically sort the directed part, orient every undirected edge along that order (1385E Directing Edges).
- **Difference constraints** x_v − x_u ≤ w → edge u → v with weight w, shortest paths (Bellman–Ford if negative); equalities with offsets → weighted DSU or DFS assigning potentials, checking consistency on every back edge.
- **Rows and columns as vertices:** a cell (r, c) becomes an edge r — c in a bipartite graph of n + m vertices; "rook placement", "fill the grid so each row/column constraint holds", "minimum cells to add so the set is connected" = components − 1.
- **Values as vertices:** for "a_i and a_j interact if they share a prime factor", connect each number to its primes (virtual vertices) instead of O(n²) pairs.
- **0-1 BFS** for "moving along the arrow is free, changing direction costs 1": deque, push_front on 0, push_back on 1.
- **Layered graph:** k-th usage limits (coupons, wall breaks, free moves) become k+1 copies of the graph with forward edges between layers.
- **Reverse thinking:** shortest path to a target from every vertex = one BFS from the target on reversed edges; for operations that are hard forwards (multiplication), go backwards from the target (division).
- **Complement graph** with n large and m small: BFS keeping the set of unvisited vertices, visiting all non-neighbours.
- **Contracting equal parts:** after DSU-merging equal elements, build a graph on DSU roots for the remaining relations.

## Pitfalls
- Underestimating the state count: n·m·K with K = 10 and a 1000 × 1000 grid is 10^7 states → int arrays only, no maps of tuples.
- Forgetting that an implicit graph can be infinite (doubling forever); cap the values.
- BFS distances with Dijkstra-only weights (0 and 1 mixed) — plain BFS is wrong; use 0-1 BFS.
- Functional graph detection with recursion on 2·10^5 vertices along a long tail: stack depth; use the iterative walk above.
- Cycle detection marking "visited" without distinguishing "on the current walk" from "finished": tails that run into an old cycle get counted as a new cycle.
- Permutation input is 1-based; subtract 1 before decomposing or you index out of bounds.
- Parity colouring must check every edge, including those to already coloured vertices; checking only tree edges misses odd cycles.
- Products over components (2^c0 + 2^c1) need modular arithmetic and precomputed powers; isolated vertices are components too (contribute 2^1 + 2^0 = 3 in 1093D).
- Building O(n²) edges for "same value" groups instead of virtual vertices → TLE/MLE.
- Multi-test: clear adjacency lists and DSU arrays per test sized by that test's n.

## Classic Codeforces problems
- 520B Two Buttons (1400) — BFS over integers with edges ×2 and −1, or greedy backwards from m (halve when even, else +1).
- 1249B2 Books Exchange (hard version) (1300) — the answer for each kid is the length of its permutation cycle.
- 1027D Mouse Hunt (1700) — functional graph; place one trap per cycle at its cheapest vertex.
- 1702E Split Into Two Sets (1600) — numbers as vertices, dominoes as edges; all degrees must be 2 and every cycle even.
- 1867D Cyclic Operations (1800) — functional graph i → b_i; every cycle must have length exactly k (k = 1 needs b_i = i).
- 1272E Nearest Opposite Parity (1900) — reverse the jump edges and run a multi-source BFS from all positions of each parity.
