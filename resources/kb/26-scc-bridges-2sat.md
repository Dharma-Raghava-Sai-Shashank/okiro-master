---
topic: SCC, Bridges, Articulation Points and 2-SAT
tags: [graphs, dfs and similar, 2-sat, trees, dsu, dp]
---
# SCC, Bridges, Articulation Points and 2-SAT

## Recognize it
Signals for strongly connected components (SCC), bridges/articulation points, or 2-SAT:
- Directed graph and "u and v can reach each other", "groups of mutually reachable vertices", "minimum cost to protect/cover every vertex reachable both ways" → SCC.
- Directed graph with cycles but you want DP over paths ("max sum of values collected, revisiting allowed") → condense SCCs into a DAG, DP on the DAG.
- "Minimum number of edges to add so every vertex is reachable from s" / "make the graph strongly connected" → count sources/sinks in the condensation DAG.
- Undirected graph and "edge whose removal disconnects", "critical roads", "must-pass edges between s and t" → bridges. "Vertex whose removal disconnects" → articulation points (cut vertices).
- "Orient every edge so the graph becomes strongly connected" → possible iff the graph is connected and has no bridges (118E Bertown roads).
- "Maximum number of bridges on a path" → contract 2-edge-connected components to a bridge tree, then diameter (1000E We Need More Bosses).
- Boolean choices per item (switch on/off, pick option A or B, orient left/right) with constraints on **pairs** ("not both", "at least one", "exactly one", "equal") → 2-SAT. Constraints on triples are NP-hard in general; look for structure instead.

## Core idea: SCC and the condensation DAG
An SCC is a maximal set of vertices where every pair is mutually reachable. Contracting each SCC to one vertex gives the **condensation**, which is always a DAG. Many directed-graph problems become: (1) compute SCCs, (2) build the DAG with aggregated weights per component (sum, min, count of min), (3) DP or counting on the DAG.

Kosaraju's algorithm: DFS on the original graph to get vertices in order of finishing time; then process vertices in **decreasing** finish time on the **reversed** graph; each search from an unassigned vertex collects exactly one SCC. Components come out numbered in topological order of the condensation (component 0 is a source component). Tarjan's algorithm does one DFS with lowlink values and outputs SCCs in **reverse** topological order. Both are O(n + m).

Facts used constantly:
- Minimum edges to add to make a directed graph strongly connected = max(#source components, #sink components), or 0 if there is only one SCC.
- Minimum number of new edges from s so that all vertices are reachable from s (999E Reachability from the Capital): number of source components in the condensation other than the one containing s (after considering only components not reachable from s).
- Vertex cover "cheapest guard per SCC" (427C Checkposts): total = Σ min cost per SCC; ways = Π (count of vertices achieving the min) mod p.

## C++ template: SCC (iterative Kosaraju) and condensation
```cpp
// comp[v] = SCC id; ids are in topological order of the condensation DAG
// (edges between components go from smaller id to larger id).
struct SCC {
    int n, cnt = 0;
    vector<int> comp;
    SCC(const vector<vector<int>>& g) : n(g.size()), comp(g.size(), -1) {
        vector<vector<int>> rg(n);
        for (int v = 0; v < n; v++) for (int u : g[v]) rg[u].push_back(v);
        vector<int> order, it(n, 0);
        vector<char> vis(n, 0);
        order.reserve(n);
        for (int s = 0; s < n; s++) {               // pass 1: finishing order, iterative
            if (vis[s]) continue;
            vector<int> st = {s};
            vis[s] = 1;
            while (!st.empty()) {
                int v = st.back();
                if (it[v] < (int)g[v].size()) {
                    int u = g[v][it[v]++];
                    if (!vis[u]) { vis[u] = 1; st.push_back(u); }
                } else { order.push_back(v); st.pop_back(); }
            }
        }
        for (int i = n - 1; i >= 0; i--) {          // pass 2: reversed graph, decreasing finish
            int s = order[i];
            if (comp[s] != -1) continue;
            vector<int> st = {s};
            comp[s] = cnt;
            while (!st.empty()) {
                int v = st.back(); st.pop_back();
                for (int u : rg[v]) if (comp[u] == -1) { comp[u] = cnt; st.push_back(u); }
            }
            cnt++;
        }
    }
    // Condensation DAG adjacency (may contain duplicate edges; dedupe if needed).
    vector<vector<int>> dag(const vector<vector<int>>& g) const {
        vector<vector<int>> d(cnt);
        for (int v = 0; v < n; v++)
            for (int u : g[v]) if (comp[v] != comp[u]) d[comp[v]].push_back(comp[u]);
        return d;
    }
};
// DP on the condensation: since ids are topological, iterate c from cnt-1 down to 0
// for "best path starting in c", or from 0 up for "best path ending in c".
```
Condensation DP example: max total value collected on a walk starting anywhere: val[c] = Σ values in SCC c; best[c] = val[c] + max(0, max best[d] over DAG edges c → d), iterate c descending. In-degree/out-degree of components: count only edges with comp[v] != comp[u].

## C++ template: bridges and articulation points (lowlink)
DFS assigns tin[v]; low[v] = minimum tin reachable from v's subtree using tree edges downward and at most one back edge. Tree edge (p → v) is a **bridge** iff low[v] > tin[p]. Vertex p is an **articulation point** iff (p is not the root and some child v has low[v] ≥ tin[p]) or (p is the root and has ≥ 2 DFS children). Skip the parent **edge id** (not the parent vertex) so parallel edges are handled correctly.
```cpp
// Undirected graph given as edge list. g[v] = (neighbor, edge id).
struct BridgesCuts {
    int n, timer = 0;
    vector<vector<pair<int, int>>> g;
    vector<int> tin, low;
    vector<char> isBridge, isCut;
    BridgesCuts(int n_, const vector<pair<int, int>>& edges)
        : n(n_), g(n_), tin(n_, -1), low(n_, 0), isBridge(edges.size(), 0), isCut(n_, 0) {
        for (int i = 0; i < (int)edges.size(); i++) {
            g[edges[i].first].push_back({edges[i].second, i});
            g[edges[i].second].push_back({edges[i].first, i});
        }
        for (int v = 0; v < n; v++) if (tin[v] == -1) dfs(v, -1);
    }
    void dfs(int v, int parentEdge) {               // recursive: fine on Codeforces (big stack)
        tin[v] = low[v] = timer++;
        int children = 0;
        for (auto [u, id] : g[v]) {
            if (id == parentEdge) continue;
            if (tin[u] != -1) { low[v] = min(low[v], tin[u]); continue; }   // back edge
            dfs(u, id);
            low[v] = min(low[v], low[u]);
            if (low[u] > tin[v]) isBridge[id] = 1;
            if (parentEdge != -1 && low[u] >= tin[v]) isCut[v] = 1;
            children++;
        }
        if (parentEdge == -1 && children >= 2) isCut[v] = 1;
    }
};
```
Recursion depth equals the DFS depth (up to n). Codeforces gives a large stack, so this passes for n = 2·10^5; locally run with a raised stack limit (`ulimit -s unlimited` on Linux; macOS caps it, so test small or compile with a bigger thread stack).

## Bridge tree and 2-edge-connected components
Removing all bridges splits an undirected graph into **2-edge-connected components** (inside each, every edge lies on a cycle). Contracting each component gives the **bridge tree** (a forest if the graph is disconnected); its edges are exactly the bridges.

How to build: after finding bridges, BFS/DFS over non-bridge edges to label components, then for each bridge add a tree edge between the labels of its endpoints.

Uses:
- **Max number of bridges on any s–t path** = diameter of the bridge tree (1000E We Need More Bosses).
- **Must-pass edges between s and t** = bridges on the bridge-tree path between comp[s] and comp[t].
- **Item on some edge, can you collect it and continue** (652E Pursuit For Artifacts): inside a 2-edge-connected component you can traverse any edge and still leave; walk the bridge-tree path and check flags on components and bridges.
- **Strong orientation** (118E Bertown roads, 949C-style reasoning): if there are no bridges, orient tree edges downward (parent → child) and back edges upward (descendant → ancestor) in DFS order; the result is strongly connected.
- **Minimum edges to add to make the graph 2-edge-connected** = ceil(leaves of the bridge tree / 2) (for a connected graph with at least one bridge).

Vertex analog: **biconnected components** (blocks) and the block-cut tree, built from articulation points with an edge stack; rarer below 2200.

## C++ template: 2-SAT
2-SAT: n boolean variables, clauses (a ∨ b) on literals. Build the implication graph with 2n vertices (x and ¬x): clause (a ∨ b) adds ¬a → b and ¬b → a. Satisfiable iff no variable has x and ¬x in the same SCC. Assignment: with SCC ids in topological order (Kosaraju), set x = true iff comp[x] > comp[¬x] (x's component comes later in topological order).
```cpp
struct TwoSat {
    int n;
    vector<vector<int>> g;
    vector<char> value;
    explicit TwoSat(int n_) : n(n_), g(2 * n_) {}
    static int lit(int x, bool isTrue) { return 2 * x + (isTrue ? 0 : 1); }  // vertex id
    // Clause (x == vx) OR (y == vy)
    void either(int x, bool vx, int y, bool vy) {
        int a = lit(x, vx), b = lit(y, vy);
        g[a ^ 1].push_back(b);                   // not a -> b
        g[b ^ 1].push_back(a);                   // not b -> a
    }
    void implies(int x, bool vx, int y, bool vy) { either(x, !vx, y, vy); }   // (x==vx) -> (y==vy)
    void setValue(int x, bool v) { either(x, v, x, v); }                       // force x == v
    void exactlyOne(int x, bool vx, int y, bool vy) { either(x, vx, y, vy); either(x, !vx, y, !vy); }
    void equal(int x, int y) { either(x, false, y, true); either(x, true, y, false); }
    bool solve() {                               // iterative Kosaraju on 2n vertices
        int N = 2 * n, cnt = 0;
        vector<vector<int>> rg(N);
        for (int v = 0; v < N; v++) for (int u : g[v]) rg[u].push_back(v);
        vector<int> order, it(N, 0), comp(N, -1);
        vector<char> vis(N, 0);
        for (int s = 0; s < N; s++) {
            if (vis[s]) continue;
            vector<int> st = {s}; vis[s] = 1;
            while (!st.empty()) {
                int v = st.back();
                if (it[v] < (int)g[v].size()) { int u = g[v][it[v]++]; if (!vis[u]) { vis[u] = 1; st.push_back(u); } }
                else { order.push_back(v); st.pop_back(); }
            }
        }
        for (int i = N - 1; i >= 0; i--) {
            int s = order[i];
            if (comp[s] != -1) continue;
            vector<int> st = {s}; comp[s] = cnt;
            while (!st.empty()) {
                int v = st.back(); st.pop_back();
                for (int u : rg[v]) if (comp[u] == -1) { comp[u] = cnt; st.push_back(u); }
            }
            cnt++;
        }
        value.assign(n, 0);
        for (int x = 0; x < n; x++) {
            if (comp[2 * x] == comp[2 * x + 1]) return false;
            value[x] = comp[2 * x] > comp[2 * x + 1];
        }
        return true;
    }
};
```
2-SAT modeling: "door i controlled by switches a and b; door must end unlocked" → r_i = 1 means a ⊕ b = 0 (equal), r_i = 0 means a ⊕ b = 1 (exactly one) (776D The Door Problem; also solvable with parity DSU). "Each item chooses option A or B; conflicting options can't both be chosen" → either(i, notA, j, notB). Binary search + 2-SAT when constraints depend on a threshold ("maximize the minimum distance between chosen points").

## Pitfalls
- Kosaraju pass 2 must use the **reversed** graph and **decreasing** finish order; mixing either gives wrong components.
- Assuming Tarjan's ids are topological: Tarjan outputs reverse topological order. For 2-SAT with Tarjan, x = true iff comp[x] < comp[¬x]. Know which algorithm you use.
- Recursive Tarjan/bridge DFS depth on 10^5–10^6 vertices locally; iterative versions or Codeforces stack.
- Bridges with parallel edges: skipping the parent vertex instead of the parent edge id wrongly marks a doubled edge as a bridge.
- Articulation point root rule (≥ 2 DFS children) forgotten.
- Condensation DAG edges counted with duplicates when computing in/out degree (fine for "is zero", wrong for counts of distinct neighbors).
- Counting "ways" in 427C needs mod 10^9+7 and the count of vertices achieving the minimum per SCC.
- 2-SAT literal encoding mismatch (2x vs 2x+1 for true/false) between clause-adding and reading the answer.
- Disconnected undirected graphs: run the bridge DFS from every unvisited vertex.

## Classic Codeforces problems
- 427C Checkposts (1700) — per SCC take the minimum cost; multiply the counts of minimum-cost vertices modulo 10^9+7.
- 949C Data Center Maintenance (1900) — edges between hours that become equal after a shift; answer is the smallest sink SCC of the condensation.
- 999E Reachability from the Capital (2000) — condense; count source components not containing (or reachable from) the capital.
- 118E Bertown roads (2000) — any bridge means impossible; otherwise orient DFS tree edges down and back edges up.
- 776D The Door Problem (2000) — each door gives an equal / not-equal constraint on two switches: 2-SAT or parity DSU.
- 1000E We Need More Bosses (2100) — contract 2-edge-connected components into the bridge tree; answer is its diameter.
