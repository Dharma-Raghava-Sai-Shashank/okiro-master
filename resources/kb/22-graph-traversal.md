---
topic: Graph Traversal (BFS, DFS, Topological Sort)
tags: [graphs, dfs and similar, shortest paths, dsu, dp, implementation]
---
# Graph Traversal (BFS, DFS, Topological Sort)

## Recognize it
Signals that a Codeforces problem is solved by plain graph traversal (BFS/DFS/topological sort):
- "Minimum number of moves / steps / operations" where every move costs the same → BFS on unweighted graph (or grid).
- Several starting points and "distance to the nearest X" for every cell/vertex → multi-source BFS (all sources in the queue at distance 0).
- Moves cost 0 or 1 (free moves vs paid moves, "number of walls to break", "number of direction changes") → 0-1 BFS with a deque.
- Grid of '.' and '#' with n·m ≤ 10^6 → grid BFS/DFS with direction arrays.
- "How many groups / islands / connected parts" → connected components (DFS, BFS or DSU).
- "Split into two groups so that every edge goes between groups", "2-color", odd cycle detection → bipartite check.
- "Is there a cycle", "order the tasks respecting dependencies", "is the alphabet order consistent" → cycle detection and topological sort.
- "Longest/most-valuable path" in a directed graph that is guaranteed (or checked) to be acyclic → DP on DAG in topological order.
- n, m ≤ 2·10^5: anything O(n + m) passes; recursion depth up to n can crash locally, so prefer iterative traversals.

## Core idea and adjacency lists
Store graphs as adjacency lists: `vector<vector<int>> g(n)`; for weighted graphs `vector<vector<pair<int,int>>>` (neighbor, weight) or edge-index lists `g[v]` holding edge ids into arrays `eu, ev, ew` (useful when edges must be marked used, deleted, or oriented). Read 1-indexed input and subtract 1 immediately, or allocate n+1.

BFS explores vertices in increasing distance from the source(s) using a FIFO queue; the first time a vertex is popped/visited, its distance is final, because all edges have equal cost. DFS goes deep first; it gives parent/child structure, entry/exit times, and back edges (cycles). Both are O(n + m).

Undirected edges are added twice. For directed graphs keep a reversed copy `rg` when you need "who can reach v" (run BFS from targets on the reversed graph). Multi-test inputs: build a fresh `g(n)` per test; never clear a global max-size array each test.

Edge-list vs matrix: adjacency matrix only when n ≤ ~2000 and the graph is dense (or for Floyd–Warshall). Implicit graphs (grids, states, numbers) do not need stored edges: generate neighbors on the fly.

## C++ template: BFS shortest path (single and multi-source)
```cpp
// Unweighted shortest paths from all sources at once. dist = -1 if unreachable.
// par[v] = previous vertex on one shortest path (for reconstruction).
pair<vector<int>, vector<int>> bfs(const vector<vector<int>>& g, const vector<int>& sources) {
    int n = g.size();
    vector<int> dist(n, -1), par(n, -1);
    queue<int> q;
    for (int s : sources) if (dist[s] == -1) { dist[s] = 0; q.push(s); }
    while (!q.empty()) {
        int v = q.front(); q.pop();
        for (int u : g[v])
            if (dist[u] == -1) {               // mark when PUSHING, not when popping
                dist[u] = dist[v] + 1;
                par[u] = v;
                q.push(u);
            }
    }
    return {dist, par};
}

// Path from a source to t using par (empty if unreachable).
vector<int> restorePath(const vector<int>& dist, const vector<int>& par, int t) {
    if (dist[t] == -1) return {};
    vector<int> path;
    for (int v = t; v != -1; v = par[v]) path.push_back(v);
    reverse(path.begin(), path.end());
    return path;
}
```
Multi-source BFS: putting every source in the queue with distance 0 equals adding a virtual super-source connected to all of them; dist[v] becomes the distance to the nearest source in O(n + m). To know *which* source is nearest, propagate an `owner[v]` label together with dist. "Distance from every vertex to the nearest vertex of type X" when edges are directed: BFS from all X vertices on the reversed graph (1272E Nearest Opposite Parity: edges i → i ± a_i, reversed, sources = vertices of the opposite parity).

## C++ template: 0-1 BFS
0-1 BFS finds shortest paths when every edge weight is 0 or 1 in O(n + m): pop from the front of a deque, push 0-edges to the front and 1-edges to the back. The deque always contains at most two distinct distances, in sorted order.
```cpp
// g[v] = list of (u, w) with w in {0, 1}.
vector<int> zeroOneBfs(const vector<vector<pair<int, int>>>& g, int s) {
    const int INF = INT_MAX;
    vector<int> dist(g.size(), INF);
    deque<int> dq;
    dist[s] = 0;
    dq.push_back(s);
    while (!dq.empty()) {
        int v = dq.front(); dq.pop_front();
        for (auto [u, w] : g[v]) {
            if (dist[v] + w < dist[u]) {       // relax like Dijkstra; a vertex may be pushed twice
                dist[u] = dist[v] + w;
                if (w == 0) dq.push_front(u); else dq.push_back(u);
            }
        }
    }
    return dist;
}
```
Typical 0-1 BFS models: grid where moving into '.' is free and breaking '#' costs 1; arrows on cells where following the arrow costs 0 and changing it costs 1; "minimum number of reversed edges to reach n" (original edge cost 0, reversed copy cost 1). 1063B Labyrinth uses the deque idea with "vertical moves free, left/right moves counted" and limits on left and right moves separately: going up/down is cost 0, and minimizing left moves also fixes right moves because right − left = column offset.

## C++ template: grid BFS/DFS with directions
```cpp
const int DR[4] = {-1, 1, 0, 0}, DC[4] = {0, 0, -1, 1};   // up, down, left, right
// 8 directions: add {-1,-1},{-1,1},{1,-1},{1,1}. Knight: (+-1,+-2),(+-2,+-1).

// Distance from (sr, sc) to every cell, '#' = wall. -1 = unreachable.
vector<vector<int>> gridBfs(const vector<string>& a, int sr, int sc) {
    int n = a.size(), m = a[0].size();
    vector<vector<int>> d(n, vector<int>(m, -1));
    queue<pair<int, int>> q;
    d[sr][sc] = 0;
    q.push({sr, sc});
    while (!q.empty()) {
        auto [r, c] = q.front(); q.pop();
        for (int k = 0; k < 4; k++) {
            int nr = r + DR[k], nc = c + DC[k];
            if (nr < 0 || nr >= n || nc < 0 || nc >= m) continue;
            if (a[nr][nc] == '#' || d[nr][nc] != -1) continue;
            d[nr][nc] = d[r][c] + 1;
            q.push({nr, nc});
        }
    }
    return d;
}

// Count connected regions of '.' cells (iterative flood fill, no recursion).
int countRegions(const vector<string>& a) {
    int n = a.size(), m = a[0].size(), regions = 0;
    vector<vector<char>> seen(n, vector<char>(m, 0));
    for (int i = 0; i < n; i++)
        for (int j = 0; j < m; j++) {
            if (a[i][j] == '#' || seen[i][j]) continue;
            regions++;
            vector<pair<int, int>> st = {{i, j}};
            seen[i][j] = 1;
            while (!st.empty()) {
                auto [r, c] = st.back(); st.pop_back();
                for (int k = 0; k < 4; k++) {
                    int nr = r + DR[k], nc = c + DC[k];
                    if (nr < 0 || nr >= n || nc < 0 || nc >= m) continue;
                    if (a[nr][nc] == '#' || seen[nr][nc]) continue;
                    seen[nr][nc] = 1;
                    st.push_back({nr, nc});
                }
            }
        }
    return regions;
}
```
Grid notes: flatten a cell to id = r·m + c to reuse graph code. When n·m ≤ 10^6 but n or m alone can be 10^6, use `vector<string>` and flattened vectors, not fixed 2D arrays. Grid modification tricks: block every neighbor of a "bad" cell before BFS (1365D Solve The Maze), or run BFS from the exit backwards to get distances from all cells at once.

## Connected components and bipartite check
Connected components: loop over all vertices; each unvisited vertex starts a new BFS/DFS and gets a new component id. Store `comp[v]`, component sizes, and per-component aggregates (edge count = sum of degrees / 2, min value, whether it contains a special vertex). DSU gives the same partition and also works online as edges arrive.

Component properties used in problems: a component is a simple cycle iff every vertex has degree 2 (977E Cyclic Components); a component is a tree iff edges = vertices − 1; number of edges to add to connect everything = components − 1.

Bipartite check: 2-color with BFS; a conflict edge (both ends same color) means an odd cycle exists, so the graph is not bipartite. Trees are always bipartite: the coloring is depth parity. In a bipartite connected component, the two color classes are fixed up to swapping, so "choose a side" decisions are per component (often knapsack over components).
```cpp
// Returns color (0/1) per vertex, or empty vector if some component has an odd cycle.
vector<int> bipartiteColoring(const vector<vector<int>>& g) {
    int n = g.size();
    vector<int> col(n, -1);
    for (int s = 0; s < n; s++) {
        if (col[s] != -1) continue;
        col[s] = 0;
        queue<int> q; q.push(s);
        while (!q.empty()) {
            int v = q.front(); q.pop();
            for (int u : g[v]) {
                if (col[u] == -1) { col[u] = col[v] ^ 1; q.push(u); }
                else if (col[u] == col[v]) return {};
            }
        }
    }
    return col;
}
```
Counting edges that can be added to a tree keeping it bipartite (862B): cnt0 · cnt1 − (n − 1).

## Cycle detection (directed with colors, undirected)
**Directed graph**: three colors per vertex: 0 = unvisited, 1 = on the current DFS stack, 2 = finished. An edge to a color-1 vertex is a back edge, which means a directed cycle. Kahn's algorithm is an alternative: if topological sort processes fewer than n vertices, a cycle exists (it does not tell you the cycle, the color method can).

**Undirected graph**: a cycle exists iff, during DFS, you see an already visited vertex that is not the parent of the current vertex (with multi-edges, compare edge ids instead of parent vertex). Or with DSU: an edge whose endpoints are already in the same set closes a cycle. Or by counting: a component with edges ≥ vertices has a cycle.
```cpp
// Directed cycle detection, iterative. Returns the vertices of one cycle in order, or {}.
vector<int> findDirectedCycle(const vector<vector<int>>& g) {
    int n = g.size();
    vector<int> color(n, 0), par(n, -1), it(n, 0);
    for (int s = 0; s < n; s++) {
        if (color[s]) continue;
        vector<int> st = {s};
        color[s] = 1;
        while (!st.empty()) {
            int v = st.back();
            if (it[v] < (int)g[v].size()) {
                int u = g[v][it[v]++];
                if (color[u] == 0) { color[u] = 1; par[u] = v; st.push_back(u); }
                else if (color[u] == 1) {               // back edge v -> u: cycle u..v
                    vector<int> cyc;
                    for (int x = v; x != u; x = par[x]) cyc.push_back(x);
                    cyc.push_back(u);
                    reverse(cyc.begin(), cyc.end());
                    return cyc;
                }
            } else { color[v] = 2; st.pop_back(); }
        }
    }
    return {};
}
```
Functional graphs (each vertex has exactly one outgoing edge) need no general DFS: walk from each unvisited vertex until you hit a visited vertex; see graph-modeling notes.

## C++ template: topological sort (Kahn) and DP on DAG
Kahn's algorithm repeatedly removes vertices with in-degree 0. The output order puts every edge u → v with u before v. If the output has fewer than n vertices, the graph has a cycle. Using a min-heap instead of a queue gives the lexicographically smallest topological order.
```cpp
// Returns a topological order, or empty vector if there is a cycle.
vector<int> topoSort(const vector<vector<int>>& g) {
    int n = g.size();
    vector<int> indeg(n, 0), order;
    for (int v = 0; v < n; v++) for (int u : g[v]) indeg[u]++;
    queue<int> q;                                   // priority_queue<int,vector<int>,greater<int>> for lexicographic
    for (int v = 0; v < n; v++) if (indeg[v] == 0) q.push(v);
    while (!q.empty()) {
        int v = q.front(); q.pop();
        order.push_back(v);
        for (int u : g[v]) if (--indeg[u] == 0) q.push(u);
    }
    if ((int)order.size() < n) return {};
    return order;
}

// Longest path (number of edges) ending at each vertex in a DAG.
vector<int> longestPathDag(const vector<vector<int>>& g) {
    vector<int> order = topoSort(g), best(g.size(), 0);
    for (int v : order)
        for (int u : g[v]) best[u] = max(best[u], best[v] + 1);   // push in topo order
    return best;
}
```
DP on DAG: any recurrence over a DAG is evaluated in topological order (push forward) or reverse topological order (pull from successors). Examples: number of paths from s to t mod p, longest path, 919D Substring (dp[v][c] = max count of letter c on a path ending at v; −1 if there is a cycle), minimum completion time of tasks with dependencies (critical path). Building the DAG from comparisons: 510C Fox And Names compares adjacent names, the first differing letter gives an edge; a name followed by its own proper prefix is impossible.

## Iterative DFS to avoid stack overflow
Recursive DFS with depth 2·10^5 usually passes on Codeforces (large stack), but crashes locally (8 MB default) and in some judges; deep recursion with big frames (vectors in locals) can crash anywhere. Use an explicit stack that stores (vertex, next edge index) so that post-order work happens exactly when a vertex is finished.
```cpp
// Iterative DFS computing parent, entry order (tin), exit order (tout), and post-order.
struct IterDfs {
    vector<int> par, tin, tout, post;
    void run(const vector<vector<int>>& g, int root) {
        int n = g.size(), timer = 0;
        par.assign(n, -1); tin.assign(n, -1); tout.assign(n, -1); post.clear();
        vector<int> it(n, 0), st = {root};
        tin[root] = timer++;
        while (!st.empty()) {
            int v = st.back();
            if (it[v] < (int)g[v].size()) {
                int u = g[v][it[v]++];
                if (tin[u] != -1) continue;       // visited (also skips the parent edge)
                par[u] = v;
                tin[u] = timer++;
                st.push_back(u);                  // pre-order work for u goes here
            } else {
                tout[v] = timer;                  // subtree of v = tin range [tin[v], tout[v])
                post.push_back(v);                // post-order work for v goes here
                st.pop_back();
            }
        }
    }
};
```
For trees, an even simpler pattern: compute a BFS order once; process it forward for top-down values (depth, parent) and backward for bottom-up values (subtree size, DP). A plain "push all neighbors" stack is fine for reachability but does not give correct post-order or DFS-tree semantics.

## Pitfalls
- Marking visited when popping instead of when pushing in BFS: vertices enter the queue many times, O(m) memory blowup and wrong parents.
- Forgetting to reset per test case, or resetting global arrays of size maxN for each of 10^4 tests.
- 1-indexed input stored in 0-indexed vectors without subtracting 1 → out-of-bounds.
- Disconnected graphs: running BFS/DFS only from vertex 0 when the property must hold for every component.
- 0-1 BFS: marking visited on first push is wrong (a later 0-edge can improve it); compare distances like Dijkstra.
- Grid bounds checks in the wrong order (`a[nr][nc]` before checking `nr >= 0`).
- Undirected cycle detection with parent-vertex check fails with multi-edges between the same pair; use edge ids.
- Topological sort on a graph that may contain a cycle: always check order.size() == n.
- Recursion depth: path graph with n = 10^6 crashes recursive DFS even on Codeforces; use iterative.
- Using `int` distances multiplied or summed over many steps — fine for BFS (≤ n), but switch to long long for weighted variants.

## Classic Codeforces problems
- 862B Mahmoud and Ehab and the bipartiteness (1300) — 2-color the tree; answer cnt0·cnt1 − (n−1), needs long long.
- 977E Cyclic Components (1500) — a component is a cycle iff all its vertices have degree exactly 2.
- 510C Fox And Names (1600) — build letter-order edges from adjacent names, topological sort, detect cycle and prefix conflict.
- 919D Substring (1700) — DP on DAG over 26 letters in topological order; a cycle means infinite answer (−1).
- 1063B Labyrinth (1800) — 0-1 BFS where vertical moves are free; minimizing left moves also bounds right moves.
- 1272E Nearest Opposite Parity (1900) — reverse the jump edges and run multi-source BFS from all opposite-parity positions.
