---
topic: Trees (rooting, diameter, LCA, Euler tour, small-to-large, centroid)
tags: [trees, dfs and similar, graphs, dp, data structures, divide and conquer, binary search]
---
# Trees (rooting, diameter, LCA, Euler tour, small-to-large, centroid)

## Recognize it
Signals for tree techniques on Codeforces:
- "n vertices and n − 1 edges, connected" or "parent of vertex i is p_i < i" → it is a tree; any two vertices have a unique simple path.
- "Farthest pair", "longest path", "center of the tree" → diameter via two BFS.
- Many queries "distance between u and v", "is u an ancestor of v", "k-th ancestor", "max edge on the path" → binary lifting LCA, O(log n) per query.
- Queries about "all vertices in the subtree of v" (sum, count, update) → Euler tour (tin/tout) flattening + Fenwick/segment tree.
- "For each vertex, count distinct colors / most frequent color in its subtree" → small-to-large merging (DSU on tree), O(n log n) or O(n log² n).
- "Count paths with length k / property over all pairs", n up to 2·10^5 → centroid decomposition (usually 2100+).
- "Add x on the path u–v for many paths, then report each vertex/edge" → difference on tree with LCA.
- "Sum over all pairs of distances" → contribution of each edge = size·(n − size).
- Rooted-tree input as parent array p_i < i → process vertices in decreasing index order for bottom-up DP, no DFS needed.

## C++ template: rooting, parent, depth, subtree sizes
Root the tree at vertex 0 with BFS: the BFS order lists every parent before its children. Iterate it forward for top-down values (depth, parent, prefix sums from root), backward for bottom-up values (subtree size, subtree DP). No recursion, so path-shaped trees with n = 10^6 are safe.
```cpp
struct RootedTree {
    int n;
    vector<int> par, depth, sz, order;
    RootedTree(const vector<vector<int>>& g, int root) : n(g.size()), par(n, -1), depth(n, 0), sz(n, 1) {
        order.reserve(n);
        order.push_back(root);
        par[root] = -1;
        for (int i = 0; i < (int)order.size(); i++) {
            int v = order[i];
            for (int u : g[v])
                if (u != par[v]) { par[u] = v; depth[u] = depth[v] + 1; order.push_back(u); }
        }
        for (int i = n - 1; i > 0; i--) sz[par[order[i]]] += sz[order[i]];   // bottom-up
    }
};
```
Uses: sum over all pairs of distances = Σ over non-root v of sz[v]·(n − sz[v]) (each edge is used by that many pairs; 1060E Sergey and Subway extends this by counting pairs at odd distance via depth parity). A vertex is a centroid iff every child subtree size and n − sz[v] are ≤ n/2. Leaves = vertices with degree 1 (careful: n = 1 and the root of a 2-vertex tree). Removing an edge (par[v], v) splits the tree into sizes sz[v] and n − sz[v].

## C++ template: diameter with two BFS
Diameter: BFS from any vertex finds a farthest vertex a; BFS from a finds the farthest vertex b; dist(a, b) is the diameter. Works for non-negative weighted trees too (use DFS/BFS accumulating weights, not plain hop count).
```cpp
// Returns {length, path of vertices} of one diameter of an unweighted tree.
pair<int, vector<int>> treeDiameter(const vector<vector<int>>& g) {
    int n = g.size();
    auto bfs = [&](int s, vector<int>& dist, vector<int>& par) {
        dist.assign(n, -1); par.assign(n, -1);
        queue<int> q; q.push(s); dist[s] = 0;
        int far = s;
        while (!q.empty()) {
            int v = q.front(); q.pop();
            if (dist[v] > dist[far]) far = v;
            for (int u : g[v]) if (dist[u] == -1) { dist[u] = dist[v] + 1; par[u] = v; q.push(u); }
        }
        return far;
    };
    vector<int> dist, par;
    int a = bfs(0, dist, par);
    int b = bfs(a, dist, par);
    vector<int> path;
    for (int v = b; v != -1; v = par[v]) path.push_back(v);
    return {dist[b], path};
}
```
Diameter facts: for every vertex v, the farthest vertex from v is one of the diameter endpoints, so eccentricity(v) = max(dist_a[v], dist_b[v]) with two extra BFS. The center(s) are the middle vertex/vertices of the diameter path; radius = ceil(diameter/2). Diameter of a weighted tree with negative weights or "max path sum" needs tree DP instead (best two downward chains at each vertex, 1083A The Fair Nut and the Best Path). Three vertices maximizing the union of paths (1294F): take the diameter endpoints, then the vertex farthest from the diameter path (multi-source BFS from all path vertices).

## C++ template: LCA with binary lifting
Binary lifting stores up[j][v] = the 2^j-th ancestor of v. LCA(u, v): lift the deeper vertex to the same depth, then lift both while their ancestors differ. O(n log n) preprocessing, O(log n) per query. Also gives k-th ancestor and path aggregates (max edge on path) by storing an extra table.
```cpp
struct LCA {
    int n, LOG;
    vector<vector<int>> up;
    vector<int> depth;
    LCA(const vector<vector<int>>& g, int root) : n(g.size()) {
        LOG = 1;
        while ((1 << LOG) < n) LOG++;
        up.assign(LOG, vector<int>(n, root));
        depth.assign(n, 0);
        vector<int> order = {root};
        vector<char> seen(n, 0);
        seen[root] = 1;
        for (int i = 0; i < (int)order.size(); i++) {
            int v = order[i];
            for (int u : g[v]) if (!seen[u]) {
                seen[u] = 1; up[0][u] = v; depth[u] = depth[v] + 1; order.push_back(u);
            }
        }
        for (int j = 1; j < LOG; j++)
            for (int v = 0; v < n; v++) up[j][v] = up[j - 1][up[j - 1][v]];   // root maps to itself
    }
    int kthAncestor(int v, int k) const {          // k <= depth[v]
        for (int j = 0; j < LOG; j++) if (k >> j & 1) v = up[j][v];
        return v;
    }
    int lca(int a, int b) const {
        if (depth[a] < depth[b]) swap(a, b);
        a = kthAncestor(a, depth[a] - depth[b]);
        if (a == b) return a;
        for (int j = LOG - 1; j >= 0; j--)
            if (up[j][a] != up[j][b]) { a = up[j][a]; b = up[j][b]; }
        return up[0][a];
    }
    int dist(int a, int b) const { return depth[a] + depth[b] - 2 * depth[lca(a, b)]; }
};
```
Distance queries: dist(u, v) = depth[u] + depth[v] − 2·depth[lca]. For weighted trees keep a separate `wdepth` (long long, sum of weights from root). Is w on the path u–v? iff dist(u, w) + dist(w, v) == dist(u, v). Common pair-of-paths question (832D Misha, Grisha and Underground): overlap of paths s–f and t–f = (dist(s,f) + dist(t,f) − dist(s,t))/2 + 1 vertices. Memory: LOG·n ints = 18 · 2·10^5 · 4 B ≈ 14 MB, fine.

## C++ template: Euler tour (tin/tout) for subtree queries
DFS entry/exit times flatten the tree so that the subtree of v is the contiguous range [tin[v], tout[v]) of the tour. Subtree sum/update becomes a range query on an array; ancestor test becomes an interval containment check.
```cpp
// Iterative Euler tour. Subtree of v = positions [tin[v], tout[v]). vertexAt[tin[v]] = v.
struct EulerTour {
    vector<int> tin, tout, vertexAt, par;
    EulerTour(const vector<vector<int>>& g, int root) {
        int n = g.size(), timer = 0;
        tin.assign(n, -1); tout.assign(n, 0); vertexAt.assign(n, 0); par.assign(n, -1);
        vector<int> it(n, 0), st = {root};
        tin[root] = timer; vertexAt[timer++] = root;
        while (!st.empty()) {
            int v = st.back();
            if (it[v] < (int)g[v].size()) {
                int u = g[v][it[v]++];
                if (u == par[v] || tin[u] != -1) continue;
                par[u] = v;
                tin[u] = timer; vertexAt[timer++] = u;
                st.push_back(u);
            } else { tout[v] = timer; st.pop_back(); }
        }
    }
    bool isAncestor(int u, int v) const { return tin[u] <= tin[v] && tout[v] <= tout[u]; }
};
```
Euler tour uses:
- Subtree sum with point updates: Fenwick over positions tin[v].
- Add to a whole subtree + point query: range add on [tin, tout) with a difference Fenwick.
- Path-to-root sums with updates: add +x at tin[v] and −x at tout[v]; prefix sum at tin[u] = sum over ancestors of u (including u).
- 1006E Military Problem: the k-th officer receiving the order from u is vertexAt[tin[u] + k − 1] if k ≤ subtree size (DFS visiting children in increasing index order).
- 1328E Tree Queries: replace each query vertex by its parent, then all must be ancestors of the deepest one — O(1) per check with tin/tout.
- Subtree with distinct-count queries → offline over the flattened array (sort by right end, Fenwick).

## C++ template: small-to-large merging (DSU on tree)
Small-to-large: each vertex owns a container (map/set) describing its subtree; to build the parent's container, keep the child's **largest** container and insert the smaller ones into it. Every element moves only when its container at least doubles, so each element moves O(log n) times: O(n log n) inserts, O(n log² n) with std::map.
```cpp
// For each vertex: number of distinct colors in its subtree.
vector<int> distinctColorsInSubtrees(const vector<vector<int>>& g, const vector<int>& color) {
    int n = g.size();
    vector<int> par(n, -1), order = {0};
    for (int i = 0; i < (int)order.size(); i++) {
        int v = order[i];
        for (int u : g[v]) if (u != par[v]) { par[u] = v; order.push_back(u); }
    }
    vector<set<int>*> bag(n, nullptr);
    vector<set<int>> storage(n);
    vector<int> ans(n);
    for (int i = n - 1; i >= 0; i--) {
        int v = order[i];
        bag[v] = &storage[v];
        bag[v]->insert(color[v]);
        for (int u : g[v]) {
            if (u == par[v]) continue;
            if (bag[u]->size() > bag[v]->size()) swap(bag[u], bag[v]);   // keep the larger one
            for (int c : *bag[u]) bag[v]->insert(c);
            bag[u]->clear();
        }
        ans[v] = bag[v]->size();
    }
    return ans;
}
```
Small-to-large uses: dominant/most frequent color sums per subtree (600E Lomsat gelral: map color → count plus count → sum of colors, or track max count and the sum of colors achieving it); merging sets of depths; answering "k-th smallest in subtree" with merged ordered structures. Swapping pointers (or `std::swap` of containers, which is O(1) for std containers) is the key; copying the big container kills the complexity. Alternative: the "sack" technique (heavy child kept, light subtrees re-added from the Euler tour) gives O(n log n) with plain arrays.

## Centroid decomposition (brief)
A centroid is a vertex whose removal leaves components of size ≤ n/2. Recursively: find the centroid, solve all paths passing through it, remove it, recurse into components. Depth of recursion is O(log n), and each vertex appears in O(log n) levels, so "process all paths through the centroid in O(size)" gives O(n log n) total. Every path in the tree passes through exactly one centroid that is the first removed vertex on it.
```cpp
// Builds the centroid tree: cpar[v] = parent of v in the centroid tree (-1 for the top).
struct CentroidDecomp {
    vector<vector<int>> g;
    vector<int> sz, cpar;
    vector<char> removed;
    explicit CentroidDecomp(const vector<vector<int>>& adj)
        : g(adj), sz(adj.size()), cpar(adj.size(), -1), removed(adj.size(), 0) { build(0, -1); }
    int calcSize(int v, int p) {
        sz[v] = 1;
        for (int u : g[v]) if (u != p && !removed[u]) sz[v] += calcSize(u, v);
        return sz[v];
    }
    int findCentroid(int v, int p, int total) {
        for (int u : g[v])
            if (u != p && !removed[u] && sz[u] * 2 > total) return findCentroid(u, v, total);
        return v;
    }
    void build(int v, int parentCentroid) {
        int c = findCentroid(v, -1, calcSize(v, -1));
        cpar[c] = parentCentroid;
        removed[c] = 1;
        // solve paths through c here: DFS from c over non-removed vertices
        for (int u : g[c]) if (!removed[u]) build(u, c);
    }
};
```
Centroid uses: count pairs at distance exactly k / ≤ k (O(n log n) or O(n log² n)); nearest marked vertex queries (342E Xenia and Tree: for each centroid ancestor c of v store best[c] = min dist to a marked vertex, update/query along cpar chain with LCA distances). Recursion depth in calcSize can reach n on the first call; fine on Codeforces, risky locally. Rated mostly 2100–2500.

## Tree path tricks
- **Difference on tree (path add, offline)**: to add x to every vertex on path u–v: diff[u] += x, diff[v] += x, diff[lca] −= x, diff[par(lca)] −= x; final value = subtree sum of diff. For edges (stored at the child): diff[u] += x, diff[v] += x, diff[lca] −= 2x.
- **Prefix from root**: pathSum(u, v) = pre[u] + pre[v] − 2·pre[lca] + val[lca] (vertex values) or without the last term for edge weights. Works with XOR as well (pre[u] ^ pre[v] for edge XOR).
- **Ancestor check**: tin/tout in O(1); "all query vertices lie on one root path" → sort by depth, check consecutive ancestor relations (1328E).
- **Max edge on path / k-th ancestor**: binary lifting tables with aggregate mx[j][v].
- **Path through a set of vertices**: the minimal subtree connecting k vertices sorted by tin has total length = (Σ dist(consecutive in tin order, cyclic)) / 2.
- **Leaves and degree arguments**: a tree with L leaves needs ceil(L/2) added edges to become 2-edge-connected; number of leaves ≥ max degree.
- **Two players / chase games on trees** (1404B Tree Tag): compare distances and the diameter, not simulations.
- **Rooted at 1, parent array p_i < i**: for i from n down to 2, push values to p_i — this is a reverse topological order for free.

## Pitfalls
- Recursion depth on path-shaped trees (n = 2·10^5 or 10^6). Use BFS order or iterative DFS.
- n = 1: no edges, diameter 0, LOG must still be ≥ 1, leaves logic breaks.
- Binary lifting with up[j][root] = −1 then indexing up[j−1][−1] → crash. Map the root to itself.
- Reading edges as 1-indexed and forgetting the shift.
- Weighted depth in int: path sums up to 2·10^5 · 10^9 need long long.
- Euler tour: using tout as inclusive in one place and exclusive in another.
- Small-to-large: iterating over the large container, or copying containers instead of swapping pointers.
- Multi-test: LOG and tables sized per test, not by a global maximum each time (memory/time blowup when T is large).
- Assuming input is a tree when the statement allows a forest or general graph.

## Classic Codeforces problems
- 1006E Military Problem (1600) — Euler tour order; answer is the (k−1)-th vertex after tin[u] if within the subtree size.
- 1083A The Fair Nut and the Best Path (1800) — tree DP combining the best two downward chains (max path sum with costs).
- 832D Misha, Grisha and Underground (1900) — LCA distances; overlap length of two paths to a common endpoint by a distance formula.
- 1328E Tree Queries (1900) — move each vertex to its parent, check all are ancestors of the deepest via tin/tout.
- 1294F Three Paths on a Tree (2000) — diameter endpoints plus the farthest vertex from the diameter path (multi-source BFS).
- 600E Lomsat gelral (2300) — small-to-large merging of color-count maps, tracking max frequency and sum of dominant colors.
