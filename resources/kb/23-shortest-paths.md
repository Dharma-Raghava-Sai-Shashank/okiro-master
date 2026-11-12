---
topic: Shortest Paths (Dijkstra, Bellman-Ford, Floyd-Warshall, state graphs)
tags: [graphs, shortest paths, dp, greedy, brute force]
---
# Shortest Paths (Dijkstra, Bellman-Ford, Floyd-Warshall, state graphs)

## Recognize it
Signals for weighted shortest path algorithms on Codeforces:
- Edge weights differ and are non-negative, n, m ≤ 2·10^5 → Dijkstra, O((n + m) log n). Weights all equal → plain BFS; weights in {0, 1} → 0-1 BFS.
- Negative edge weights, "arbitrarily small", "infinitely profitable loop", n·m ≤ ~10^7 → Bellman–Ford (detect negative cycles).
- n ≤ 400–500 and queries "distance between any pair", or vertices added/removed one by one → Floyd–Warshall O(n³).
- The cost of a move depends on something besides the current vertex (current speed, bike in hand, number of coupons used, parity, previous vertex, time modulo k) → shortest path on a **state graph** (vertex, extra state).
- "Print the path" → keep parent pointers. "How many shortest paths" → count while relaxing. "Which edges lie on some/every shortest path" → distances from both ends.
- "Remove as many edges as possible keeping all distances from 1 unchanged" → shortest path tree (1076D Edge Deletion).
- Distances up to 2·10^5 edges × 10^9 weight = 2·10^14 → long long is mandatory.

## C++ template: Dijkstra with lazy deletion
Dijkstra: repeatedly finalize the unvisited vertex with the smallest tentative distance; correct only for non-negative weights. With a binary heap and lazy deletion (push duplicates, skip stale entries), O((n + m) log m).
```cpp
using ll = long long;
const ll INF = LLONG_MAX / 4;

// g[v] = list of (u, w). Returns dist (INF if unreachable) and parent for path restoration.
pair<vector<ll>, vector<int>> dijkstra(const vector<vector<pair<int, ll>>>& g,
                                       const vector<int>& sources) {
    int n = g.size();
    vector<ll> dist(n, INF);
    vector<int> par(n, -1);
    priority_queue<pair<ll, int>, vector<pair<ll, int>>, greater<pair<ll, int>>> pq;
    for (int s : sources) { dist[s] = 0; pq.push({0, s}); }
    while (!pq.empty()) {
        auto [d, v] = pq.top(); pq.pop();
        if (d != dist[v]) continue;                 // stale entry: skip (lazy deletion)
        for (auto [u, w] : g[v]) {
            if (d + w < dist[u]) {
                dist[u] = d + w;
                par[u] = v;
                pq.push({dist[u], u});
            }
        }
    }
    return {dist, par};
}

vector<int> restorePath(const vector<int>& par, int t) {   // call only if dist[t] < INF
    vector<int> path;
    for (int v = t; v != -1; v = par[v]) path.push_back(v);
    reverse(path.begin(), path.end());
    return path;
}
```
Dijkstra notes: multi-source = push all sources with distance 0. Dense graph with n ≤ 5000 and m ≈ n²: the O(n²) array version (pick min by scanning) beats the heap. Distances to a fixed target t in a directed graph: run Dijkstra from t on the reversed graph. `if (d != dist[v]) continue;` is essential: without it the algorithm stays correct but can become O(m · deg) on adversarial tests (a known hack on 20C Dijkstra?).

## Counting shortest paths and edges on shortest paths
Counting shortest paths: process vertices in increasing distance (Dijkstra pop order, BFS order). When relaxation strictly improves dist[u], set cnt[u] = cnt[v]; when it ties, add cnt[u] += cnt[v]. With lazy deletion, only relax from non-stale pops so each vertex contributes once.
```cpp
// Number of shortest paths from s to every vertex modulo MOD (non-negative weights).
vector<long long> countShortestPaths(const vector<vector<pair<int, long long>>>& g, int s,
                                     long long MOD) {
    int n = g.size();
    const long long INF = LLONG_MAX / 4;
    vector<long long> dist(n, INF), cnt(n, 0);
    priority_queue<pair<long long, int>, vector<pair<long long, int>>,
                   greater<pair<long long, int>>> pq;
    dist[s] = 0; cnt[s] = 1; pq.push({0, s});
    while (!pq.empty()) {
        auto [d, v] = pq.top(); pq.pop();
        if (d != dist[v]) continue;
        for (auto [u, w] : g[v]) {
            if (d + w < dist[u]) { dist[u] = d + w; cnt[u] = cnt[v]; pq.push({dist[u], u}); }
            else if (d + w == dist[u]) cnt[u] = (cnt[u] + cnt[v]) % MOD;
        }
    }
    return cnt;
}
```
Zero-weight edges break this counting (paths of equal length can be discovered after v is popped, and zero-weight cycles give infinitely many paths); for w ≥ 1 it is correct.

Edge classification with two runs: let ds = distances from s, dt = distances to t (reverse graph if directed), D = ds[t]. Edge (u, v, w) lies on some shortest s–t path iff ds[u] + w + dt[v] == D. It lies on **every** shortest path iff additionally cnt_s[u] · cnt_t[v] ≡ cnt_s[t] (compare modulo one or two random large primes, as in 567E President and Roads), or equivalently it is a bridge of the shortest-path DAG. Shortest path tree: for each v ≠ s keep one incoming edge with ds[u] + w == ds[v]; keeping these n − 1 edges preserves all distances (1076D Edge Deletion keeps the first k such edges in Dijkstra order).

## C++ template: Bellman-Ford and negative cycles
Bellman–Ford relaxes all edges n − 1 times; if an n-th pass still improves something, a negative cycle is reachable. O(n·m). Works with negative weights. For "is there any negative cycle anywhere", initialize all distances to 0 (equivalent to a virtual source connected to everything).
```cpp
struct Edge { int u, v; long long w; };

// Returns {dist, cycle}. cycle is empty if no negative cycle reachable from s.
// Pass s = -1 to detect any negative cycle in the graph (all dist start at 0).
pair<vector<long long>, vector<int>> bellmanFord(int n, const vector<Edge>& edges, int s) {
    const long long INF = LLONG_MAX / 4;
    vector<long long> dist(n, s == -1 ? 0 : INF);
    vector<int> par(n, -1);
    if (s != -1) dist[s] = 0;
    int last = -1;
    for (int it = 0; it < n; it++) {
        last = -1;
        for (const Edge& e : edges)
            if (dist[e.u] < INF && dist[e.u] + e.w < dist[e.v]) {
                dist[e.v] = max(-INF, dist[e.u] + e.w);   // clamp to avoid overflow drift
                par[e.v] = e.u;
                last = e.v;
            }
        if (last == -1) break;                             // converged early
    }
    vector<int> cycle;
    if (last != -1) {                                      // improved in n-th pass
        int v = last;
        for (int i = 0; i < n; i++) v = par[v];            // step back n times: now on the cycle
        int x = v;
        do { cycle.push_back(x); x = par[x]; } while (x != v);
        reverse(cycle.begin(), cycle.end());              // now in edge direction
    }
    return {dist, cycle};
}
```
Uses: "maximize profit" = shortest path with negated weights; "can the answer be infinitely large" = positive cycle on a path from s to t. For that, a vertex affected by a negative cycle counts only if it is reachable from s **and** can reach t: after n − 1 passes, run one more pass and mark vertices that still relax, then propagate marks forward with BFS and check t (or check reachability of t from marked vertices). Difference constraints x_v − x_u ≤ w are an edge u → v of weight w; infeasible iff negative cycle.

## C++ template: Floyd-Warshall
Floyd–Warshall computes all-pairs shortest paths in O(n³) by allowing intermediate vertices 0..k one at a time: d[i][j] = min(d[i][j], d[i][k] + d[k][j]). Works with negative edges; a negative cycle shows up as d[i][i] < 0.
```cpp
// d: n x n matrix, d[i][i] = 0, d[i][j] = edge weight or INF. Modified in place.
void floydWarshall(vector<vector<long long>>& d) {
    const long long INF = LLONG_MAX / 4;
    int n = d.size();
    for (int k = 0; k < n; k++)                 // k MUST be the outermost loop
        for (int i = 0; i < n; i++) {
            if (d[i][k] >= INF) continue;
            for (int j = 0; j < n; j++)
                if (d[k][j] < INF && d[i][k] + d[k][j] < d[i][j])
                    d[i][j] = d[i][k] + d[k][j];
        }
}
// Transitive closure with bitsets (n <= ~2000): for k: for i: if (reach[i][k]) reach[i] |= reach[k];
```
Floyd–Warshall tricks:
- **Adding vertices incrementally**: after processing k, d holds shortest paths using only intermediate vertices among the first k+1 processed. Reverse a deletion sequence and add vertices one at a time; after adding vertex k, the answer restricted to added vertices is available (295B Greg and Graph).
- **Adding one edge (a, b, w) to a solved matrix** in O(n²): d[i][j] = min(d[i][j], d[i][a] + w + d[b][j], d[i][b] + w + d[a][j]) for undirected.
- **Small "graph over digits / states"** (1202B You Are Given a Decimal String...: 10 digits, for every pair (x, y) of counter increments compute the minimum steps between digits with Floyd or BFS, then sum over adjacent pairs of the string).
- Memory: n = 500 → 250k long longs, fine; n = 5000 → too slow anyway (1.25·10^11).
- Path reconstruction: store nxt[i][j] (first hop), update nxt[i][j] = nxt[i][k] on improvement.

## C++ template: shortest path with states (layered graph)
When the cost of the next move depends on more than the current vertex, make the extra information part of the vertex: node = (v, s). Run Dijkstra/BFS on this product graph with n·S states. Typical extra states: number of free coupons used (≤ k), current vehicle/speed (1915G Bicycles: speed factor of the best bike picked up so far, s ≤ 1000), parity of steps, previous vertex (forbidden triples, 59E Shortest Path uses state = edge (prev, cur)), time mod k, whether a special action was used (1473E Minimum Path: flags "max edge removed" and "min edge doubled").
```cpp
// Dijkstra over (vertex, used) where up to K edges may be traversed for free.
// g[v] = (u, w). Answer = min over used of dist[t][used].
vector<vector<long long>> dijkstraWithCoupons(const vector<vector<pair<int, long long>>>& g,
                                              int s, int K) {
    int n = g.size();
    const long long INF = LLONG_MAX / 4;
    vector<vector<long long>> dist(n, vector<long long>(K + 1, INF));
    using T = tuple<long long, int, int>;                 // (dist, vertex, used)
    priority_queue<T, vector<T>, greater<T>> pq;
    dist[s][0] = 0;
    pq.push({0, s, 0});
    while (!pq.empty()) {
        auto [d, v, k] = pq.top(); pq.pop();
        if (d != dist[v][k]) continue;
        for (auto [u, w] : g[v]) {
            if (d + w < dist[u][k]) { dist[u][k] = d + w; pq.push({dist[u][k], u, k}); }
            if (k < K && d < dist[u][k + 1]) { dist[u][k + 1] = d; pq.push({d, u, k + 1}); }
        }
    }
    return dist;
}
```
State-graph checklist: (1) list what the future cost depends on; (2) bound the number of states (n·S ≤ ~10^7 for Dijkstra); (3) transitions inside one layer (normal edges) and between layers (special actions); (4) answer = min over the allowed final states. If the extra state only ever increases (coupons used, flags set), layers form a DAG of layers and the graph never needs negative edges.

## Variations and tricks
- **Virtual vertices**: connect a super-source to many vertices (multi-source), or add one vertex per "group/color/station" with edges of weight 0 in and w out to avoid O(k²) edges inside a group.
- **Edge weight depends on arrival time** but is non-decreasing to arrive later (FIFO property): Dijkstra still works, compute the departure time at relaxation.
- **Minimize max edge on a path (bottleneck)**: Dijkstra with max instead of sum, or MST (path in the minimum spanning tree), or binary search + BFS.
- **Second shortest path**: keep two distances per vertex (best and second best strictly greater) in Dijkstra.
- **K-th smallest pairwise distance with small k** (1196F K-th Path): only the k lightest edges matter, so run Floyd on at most 2k vertices.
- **Removing one edge, query distance** (1433G Reducing Delivery Cost): precompute all-pairs Dijkstra (n ≤ 1000), then for each candidate zero edge (a, b), each route cost is min(d[x][y], d[x][a] + d[b][y], d[x][b] + d[a][y]).
- **Shortest paths in a DAG** (even with negative weights): one pass in topological order, O(n + m).
- **Johnson's reweighting** (rare on CF): Bellman–Ford potentials, then Dijkstra from each vertex.
- **Many queries with tiny graphs or grids**: precompute BFS from every special cell.

## Pitfalls
- `int` distances: 2·10^5 × 10^9 overflows. Use long long and INF = LLONG_MAX/4 so INF + w never overflows.
- Missing the stale-entry check `if (d != dist[v]) continue;` → TLE on anti-Dijkstra tests.
- `priority_queue<pair<ll,int>>` without `greater` is a max-heap: pops the largest distance first (or push negated distances consistently).
- Dijkstra with negative edges silently gives wrong answers; use Bellman–Ford or reweight.
- Undirected edges added only once.
- Floyd–Warshall with k as an inner loop is wrong; INF + INF overflow when INF = LLONG_MAX.
- Bellman–Ford: comparing with an unreachable dist (INF + negative w looks like an improvement); always check dist[u] < INF.
- State graphs: forgetting to include the state in the visited/dist check (using dist[v] instead of dist[v][s]).
- Counting shortest paths with zero-weight edges.
- Memory for n·S states: 2·10^5 × 20 long longs = 32 MB, fine; × 1000 is not.

## Classic Codeforces problems
- 20C Dijkstra? (1900) — textbook Dijkstra with parent restoration on 10^5 vertices; long long and the stale check matter.
- 295B Greg and Graph (1700) — reverse the deletion order, add vertices one at a time as Floyd–Warshall intermediate vertices.
- 1076D Edge Deletion (1800) — keep the parent edges of the first k finalized vertices of Dijkstra's shortest path tree.
- 1915G Bicycles (1800) — Dijkstra on state (city, slowness of the best bike held so far).
- 59E Shortest Path (2000) — BFS over states (previous vertex, current vertex) to avoid forbidden triples.
- 1433G Reducing Delivery Cost (2100) — all-pairs Dijkstra, then try every edge as the zero-cost edge in O(k) per edge.
