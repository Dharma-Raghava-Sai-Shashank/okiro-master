---
topic: DSU (Union-Find) and Minimum Spanning Trees
tags: [dsu, graphs, trees, greedy, sortings, data structures]
---
# DSU (Union-Find) and Minimum Spanning Trees

## Recognize it
Signals for DSU (disjoint set union) or MST on Codeforces:
- Edges or equalities **arrive over time** and you must answer "are x and y connected?", "size of x's group?", "number of groups?" after each addition → DSU, nearly O(1) per operation.
- "Connect all vertices with minimum total cost", "minimum cost to make the graph connected", "build roads / power stations" → MST (Kruskal with DSU).
- **Deletions** of edges/elements with connectivity queries, and all operations are known in advance → process in reverse so deletions become additions (offline reversal).
- "For each query weight w, count pairs whose path uses only edges ≤ w" or "maximum edge on a path is minimized" → sort edges by weight, union incrementally, answer offline (1213G Path Queries).
- Constraints like "a_i = a_j", "x and y in the same group", "x and y have different colors / parity relation" → DSU (with parity for the "different" relation).
- Merging intervals / "next free slot to the right" → DSU on indices with "parent = next unfilled position".
- n, m ≤ 2·10^5 with up to 2·10^5 merge/query operations → DSU fits easily.

## C++ template: DSU with path compression and union by size
DSU keeps a forest; each set is a tree identified by its root. `find` with path compression plus union by size gives amortized inverse-Ackermann time (effectively constant).
```cpp
struct DSU {
    vector<int> p, sz;
    int comps;
    explicit DSU(int n) : p(n), sz(n, 1), comps(n) { iota(p.begin(), p.end(), 0); }
    int find(int x) {                       // iterative path compression (no recursion depth issues)
        int r = x;
        while (p[r] != r) r = p[r];
        while (p[x] != r) { int nx = p[x]; p[x] = r; x = nx; }
        return r;
    }
    bool unite(int a, int b) {              // returns false if already in the same set
        a = find(a); b = find(b);
        if (a == b) return false;
        if (sz[a] < sz[b]) swap(a, b);
        p[b] = a;
        sz[a] += sz[b];
        comps--;
        return true;
    }
    bool same(int a, int b) { return find(a) == find(b); }
    int size(int x) { return sz[find(x)]; }
};
```
DSU facts: number of components = n − (successful unions). `unite` returning false on an edge means that edge closes a cycle (cycle detection in undirected graphs, redundant edges to remove in 25D Roads not only in Berland). Sizes of groups after all unions: count `size(find(i))` for each i (1167C News Distribution: answer for each user is the size of its group). Recursive `find` (`return p[x] == x ? x : p[x] = find(p[x]);`) is fine with union by size because depth stays O(log n).

## C++ template: DSU with extra information (sum, min, parity)
Store aggregates at the root and merge them in `unite`. Anything associative and commutative works: sum, min, max, count of special vertices, edge count, a bitmask of colors.

Parity DSU stores, for each vertex, the parity of its relation to its parent; the parity to the root is the XOR along the path. It answers "are x and y in the same / opposite class" and detects contradictions (odd cycles), which is bipartiteness checking online.
```cpp
// DSU with per-set sum and parity relation. rel(x) = parity between x and its root.
struct DSUParity {
    vector<int> p, sz, par;                 // par[x] = parity of edge x -> p[x]
    vector<long long> sum;
    DSUParity(int n, const vector<long long>& val) : p(n), sz(n, 1), par(n, 0), sum(val) {
        iota(p.begin(), p.end(), 0);
    }
    pair<int, int> find(int x) {            // returns {root, parity(x, root)}
        int r = x, acc = 0;
        while (p[r] != r) { acc ^= par[r]; r = p[r]; }
        // path compression: rewrite each node on the path to point at r with its parity
        int cur = x, curPar = acc;
        while (p[cur] != r && p[cur] != cur) {
            int nx = p[cur], nxPar = curPar ^ par[cur];
            p[cur] = r; par[cur] = curPar;
            cur = nx; curPar = nxPar;
        }
        return {r, acc};
    }
    // Impose parity(a) XOR parity(b) == d (d=0 same class, d=1 different).
    // Returns false on contradiction.
    bool unite(int a, int b, int d) {
        auto [ra, pa] = find(a);
        auto [rb, pb] = find(b);
        if (ra == rb) return (pa ^ pb) == d;
        if (sz[ra] < sz[rb]) { swap(ra, rb); swap(pa, pb); }
        p[rb] = ra;
        par[rb] = pa ^ pb ^ d;
        sz[ra] += sz[rb];
        sum[ra] += sum[rb];
        return true;
    }
};
```
Uses of extended DSU: component sum of values for "maximum sum segment after each addition" (722C Destroying Array, reversed); parity classes for "x says y is an imposter/crewmate" (1594D The Number of Imposters: count per component how many are in class 0 and 1, take the max); bipartite check while adding edges; weighted DSU with potentials (difference constraints x_b − x_a = w along equality edges, conflict detection).

## Offline reversal: deletions become additions
DSU cannot split sets. If the problem deletes edges or elements and asks about connectivity or component aggregates after each deletion, and all operations are known up front:
1. Apply all deletions to get the final state; build DSU on what remains.
2. Walk the operations backwards; each deletion becomes an addition (`unite`), and the answer for step i is read **before** undoing deletion i (careful with off-by-one).
3. Output answers in original order.
```cpp
// 722C-style: a permutation `order` destroys elements one by one; after each destruction
// print the maximum sum of a contiguous segment of non-destroyed elements.
vector<long long> maxSegmentAfterDeletions(const vector<long long>& a, const vector<int>& order) {
    int n = a.size();
    vector<int> p(n);
    iota(p.begin(), p.end(), 0);
    vector<long long> sum(a);
    vector<char> alive(n, 0);
    auto find = [&](int x) {
        while (p[x] != x) { p[x] = p[p[x]]; x = p[x]; }   // path halving
        return x;
    };
    vector<long long> ans(n);
    long long best = 0;
    for (int i = n - 1; i >= 0; i--) {
        ans[i] = best;                    // state after deletions 0..i (i.e. before re-adding order[i])
        int x = order[i];
        alive[x] = 1;
        for (int y : {x - 1, x + 1})
            if (y >= 0 && y < n && alive[y]) {
                int rx = find(x), ry = find(y);
                if (rx != ry) { p[ry] = rx; sum[rx] += sum[ry]; }
            }
        best = max(best, sum[find(x)]);
    }
    return ans;
}
```
This pattern also handles "remove vertices one by one, count components after each removal" and "edges disappear over time". If operations are interleaved additions and deletions with queries (fully dynamic), offline reversal does not apply; use DSU with rollback over a segment tree on time (2300+).

## C++ template: Kruskal's MST
Kruskal: sort edges by weight, add an edge if it connects two different components. The result is a minimum spanning forest. O(m log m).
```cpp
struct WEdge { long long w; int u, v; };

// Returns {total weight, chosen edge indices}. If the graph is disconnected,
// chosen.size() < n - 1 (spanning forest).
pair<long long, vector<int>> kruskal(int n, vector<WEdge> edges) {
    vector<int> idx(edges.size());
    iota(idx.begin(), idx.end(), 0);
    sort(idx.begin(), idx.end(), [&](int a, int b) { return edges[a].w < edges[b].w; });
    vector<int> p(n);
    iota(p.begin(), p.end(), 0);
    auto find = [&](int x) {
        while (p[x] != x) { p[x] = p[p[x]]; x = p[x]; }
        return x;
    };
    long long total = 0;
    vector<int> chosen;
    for (int i : idx) {
        int a = find(edges[i].u), b = find(edges[i].v);
        if (a == b) continue;
        p[a] = b;
        total += edges[i].w;
        chosen.push_back(i);
    }
    return {total, chosen};
}
```
MST properties used in proofs: (cut) the lightest edge crossing any cut is in some MST; (cycle) the heaviest edge on any cycle is in no MST (if strictly heaviest). MST also minimizes the maximum edge on the path between every pair (minimum bottleneck paths). Maximum spanning tree = sort descending. Virtual vertex trick: "build a power station at city i for cost c_i or connect cities" → add vertex 0 with edges (0, i, c_i) and run MST (1245D Shichikuji and Power Grid). Implicit dense graphs (edge weight = f(i, j)) with special structure: only O(n) candidate edges matter (1095F Make It Connected: every useful plain edge is dominated by connecting to the minimum-value vertex, so add n − 1 edges (min, i, a_min + a_i) plus the special offers).

## Prim's algorithm (brief)
Prim grows one tree from a start vertex, repeatedly adding the cheapest edge leaving the tree. With a heap: O(m log n), same as Kruskal, so Kruskal is usually simpler. Prim wins on **dense complete graphs** given implicitly (n ≤ 5000, weight = f(i, j)): the O(n²) array version needs no edge list.
```cpp
// O(n^2) Prim for a complete graph with weight function w(i, j). Returns MST weight.
template <class F>
long long primDense(int n, F w) {
    const long long INF = LLONG_MAX / 4;
    vector<long long> best(n, INF);
    vector<char> in(n, 0);
    best[0] = 0;
    long long total = 0;
    for (int it = 0; it < n; it++) {
        int v = -1;
        for (int i = 0; i < n; i++)
            if (!in[i] && (v == -1 || best[i] < best[v])) v = i;
        in[v] = 1;
        total += best[v];
        for (int u = 0; u < n; u++)
            if (!in[u]) best[u] = min(best[u], w(v, u));
    }
    return total;
}
```
Use Prim O(n²) for: Euclidean/Manhattan MST on n ≤ 5000 points, XOR/compound weight complete graphs with small n. For n = 2·10^5 complete graphs you need structure (Boruvka with a trie for XOR-MST, or the rotation trick for Manhattan MST), typically 2300+.

## Processing edges by weight (offline DSU tricks)
Sorting edges by weight and uniting in that order turns many "path max / threshold" questions into incremental DSU problems.
- **Pairs with max edge ≤ q** (1213G Path Queries): sort edges and queries by weight; when merging components of sizes a and b, the number of connected pairs grows by a·b. Answer each query after inserting all edges with weight ≤ q.
- **Minimum possible maximum edge between u and v** = the weight at which u and v first become connected; answer many such queries with Kruskal reconstruction tree or parallel binary search (2200+), or with LCA max-edge on the MST.
- **Edges in some MST / all MSTs**: process groups of equal weight together. For each group, first check every edge against the DSU state before the group (if endpoints already connected → in no MST), then unite the whole group. An edge is in every MST iff it is in some MST and is a bridge in the graph formed by the group's useful edges on the contracted components.
- **MST containing a forced edge** (609E Minimum spanning tree for each edge): answer = MST − (max edge on the MST path between u and v) + w(u, v), with max on path via binary lifting.
- **Two independent forests** (1559D1 Mocha and Diana): greedily add edge (i, j) if it joins different components in both DSUs; with n ≤ 1000 try all pairs.
- **Complement graph components** in O(n + m): BFS keeping a set/list of unvisited vertices, and from v visit all unvisited vertices that are NOT neighbors of v.
- **"Next free index"** DSU: painting segments in reverse order of queries, `nxt[i] = find(i+1)` after filling i, total O(n α).

## Pitfalls
- Union by size without updating size at the new root, or updating `sz[b]` instead of `sz[a]`.
- Comparing `p[a] == p[b]` instead of `find(a) == find(b)`.
- Recursive `find` without union by size on a path-like union sequence: deep recursion + O(n) per find.
- Offline reversal off-by-one: recording the answer after re-adding instead of before.
- Kruskal sort comparator on weight only is fine; sorting `tuple<w,u,v>` also fine. Forgetting that the graph may be disconnected (MST does not exist → print −1).
- Total MST weight overflow: n · 10^9 needs long long.
- Pairs counting a·b with a, b up to 2·10^5 → long long.
- Parity DSU: when attaching rb under ra, the edge parity is pa ⊕ pb ⊕ d, not d.
- Multi-test: re-create DSU per test with the test's n.

## Classic Codeforces problems
- 1167C News Distribution (1400) — union each group's members; every user's answer is its component size.
- 722C Destroying Array (1600) — reverse the destruction order and merge neighbors with DSU tracking segment sums.
- 1213G Path Queries (1800) — sort edges and queries by weight; each union adds size_a·size_b pairs.
- 1095F Make It Connected (1900) — only edges to the minimum-value vertex plus special offers are needed; then Kruskal.
- 1245D Shichikuji and Power Grid (1900) — virtual vertex 0 for power stations, MST on a dense graph with Prim or Kruskal.
- 609E Minimum spanning tree for each edge (2100) — MST plus maximum edge on the tree path via binary lifting.
