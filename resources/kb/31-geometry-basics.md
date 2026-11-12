---
topic: Computational Geometry Basics (Integer Cross Product, Convex Hull, Manhattan Tricks)
tags: [geometry, math, sortings, implementation, number theory, data structures]
---
# Computational Geometry Basics (Integer Cross Product, Convex Hull, Manhattan Tricks)

## Recognize it
Signals for basic geometry on Codeforces and what to reach for:
- Points with **integer coordinates** and questions "collinear?", "left or right turn?", "do segments intersect?", "same line?" → integer cross product, no floating point at all.
- "Smallest convex polygon containing all points", "farthest pair", "points on the boundary of the convex shape" → convex hull (monotone chain), O(n log n).
- "Area of a polygon given its vertices", "lattice points inside/on a polygon" → shoelace formula (twice the area is an integer) + Pick's theorem.
- "Is the point inside the polygon", "is polygon B strictly inside convex polygon A" → ray casting for simple polygons, O(log n) binary search for convex ones.
- Manhattan distance |x1 − x2| + |y1 − y2| with "maximum distance", "farthest point", "all points within distance d" → rotate: u = x + y, v = x − y turns Manhattan into Chebyshev max(|du|, |dv|), whose coordinates are independent.
- Sum of Manhattan distances over pairs → coordinates are separable: solve x and y independently with sorting + prefix sums.
- Grid "king moves" distance max(|dx|, |dy|) → Chebyshev; rotate back to Manhattan if sums are needed.
- Many slopes/directions must be grouped ("count pairs of intersecting lines", "how many distinct lines") → normalize direction vectors with gcd and sign, use them as map keys.
- Angles, circles, rotations with real outputs → floating point is unavoidable; use `long double`, compare with eps, and keep geometry in integers as long as possible.

## Core idea
The **cross product** cross(a, b) = a.x·b.y − a.y·b.x is the signed area of the parallelogram spanned by a and b. For three points O, A, B, cross(A − O, B − O) > 0 means O → A → B turns **counterclockwise (left)**, < 0 clockwise (right), = 0 collinear. Nearly every predicate (orientation, segment intersection, convexity, point in polygon, hull construction, angular sorting) reduces to the sign of cross products, which is **exact with integers**.

The **dot product** dot(a, b) = a.x·b.x + a.y·b.y gives the sign of cos of the angle: > 0 acute, = 0 perpendicular, < 0 obtuse. Squared distance dot(d, d) compares distances exactly.

Magnitudes: coordinates up to 10^9 → differences up to 2·10^9 → a cross product up to 8·10^18, which still fits in signed 64-bit (max ≈ 9.22·10^18), but only just. Any further product or sum of such terms (shoelace sums, comparing two cross products by multiplication) needs `__int128`.

**Avoid floating point:** compare slopes dy1/dx1 vs dy2/dx2 via cross products; compare fractions a/b < c/d as a·d < c·b with positive denominators; compare distances via squared distances; represent a direction as (dx/g, dy/g) with g = gcd(|dx|, |dy|) and a fixed sign; represent a line through two lattice points as (normalized direction, cross(direction, point)) to test equality of lines.

## C++ template: points, orientation, segment intersection, polar sort
```cpp
struct P { long long x, y; };
P operator-(P a, P b) { return {a.x - b.x, a.y - b.y}; }
P operator+(P a, P b) { return {a.x + b.x, a.y + b.y}; }
bool operator==(P a, P b) { return a.x == b.x && a.y == b.y; }
bool operator<(P a, P b) { return a.x < b.x || (a.x == b.x && a.y < b.y); }
long long cross(P a, P b) { return a.x * b.y - a.y * b.x; }
long long cross(P o, P a, P b) { return cross(a - o, b - o); }      // > 0: o->a->b is a left turn
long long dot(P a, P b) { return a.x * b.x + a.y * b.y; }
int orient(P o, P a, P b) { long long c = cross(o, a, b); return (c > 0) - (c < 0); }

bool onSegment(P a, P b, P p) {                     // p on closed segment [a, b]
    return cross(a, b, p) == 0 && min(a.x, b.x) <= p.x && p.x <= max(a.x, b.x)
                               && min(a.y, b.y) <= p.y && p.y <= max(a.y, b.y);
}
bool segmentsIntersect(P a, P b, P c, P d) {       // closed segments, touching counts
    int d1 = orient(a, b, c), d2 = orient(a, b, d), d3 = orient(c, d, a), d4 = orient(c, d, b);
    if (d1 * d2 < 0 && d3 * d4 < 0) return true;   // proper crossing
    return onSegment(a, b, c) || onSegment(a, b, d) || onSegment(c, d, a) || onSegment(c, d, b);
}

// Sort direction vectors (non-zero) by polar angle in [0, 2*pi), exact.
bool lowerHalf(P a) { return a.y < 0 || (a.y == 0 && a.x < 0); }
void polarSort(vector<P>& v) {
    sort(v.begin(), v.end(), [](P a, P b) {
        if (lowerHalf(a) != lowerHalf(b)) return lowerHalf(a) < lowerHalf(b);
        return cross(a, b) > 0;                    // same half: a before b if b is counterclockwise of a
    });
}

// Canonical direction of a line through two distinct lattice points (for grouping parallel lines).
pair<long long, long long> direction(P a, P b) {
    long long dx = b.x - a.x, dy = b.y - a.y, g = gcd(llabs(dx), llabs(dy));
    dx /= g; dy /= g;
    if (dx < 0 || (dx == 0 && dy < 0)) { dx = -dx; dy = -dy; }
    return {dx, dy};
}
```
Same line test: points a, b, c collinear iff cross(a, b, c) == 0. Two lines with the same canonical direction (dx, dy) are equal iff cross((dx, dy), point) is equal for one point of each (it is the line's constant c in dy·x − dx·y = −c). Counting pairs of intersecting lines: total pairs minus pairs with the same direction, after removing duplicate lines (1163C2 Power Transmission (Hard Edition)). "All points on at most two lines" (961D Pair Of Lines): among the first three points two must share a line; try each of the 3 pairs as the first line, check that the leftover points are collinear.

## C++ template: convex hull (monotone chain)
```cpp
// Returns hull vertices in counterclockwise order, starting from the lowest-leftmost point,
// without collinear points on edges. For <= 2 distinct points returns them as is.
vector<P> convexHull(vector<P> pts) {
    sort(pts.begin(), pts.end());
    pts.erase(unique(pts.begin(), pts.end()), pts.end());
    int n = pts.size();
    if (n <= 2) return pts;
    vector<P> h(2 * n);
    int k = 0;
    for (int i = 0; i < n; i++) {                              // lower hull, left to right
        while (k >= 2 && cross(h[k - 2], h[k - 1], pts[i]) <= 0) k--;
        h[k++] = pts[i];
    }
    for (int i = n - 2, lower = k + 1; i >= 0; i--) {          // upper hull, right to left
        while (k >= lower && cross(h[k - 2], h[k - 1], pts[i]) <= 0) k--;
        h[k++] = pts[i];
    }
    h.resize(k - 1);                                           // last point repeats the first
    return h;
}
```
How it works: sorted by x (then y), the lower hull keeps only left turns; any point causing a right turn or a straight line (cross ≤ 0) makes the previous point redundant. The upper hull is the same scan backwards. `lower = k + 1` prevents popping points of the finished lower hull. Change both `<= 0` to `< 0` to **keep collinear boundary points** (then all-collinear input needs special care: it returns points twice). If all points are collinear the result is the two extreme points. O(n log n) for the sort, O(n) for the scan.

Hull applications: farthest pair (rotating calipers over hull vertices, or O(h²) for small hulls); a polygon given in order is convex iff all consecutive cross products have the same sign; "is B strictly inside A" (166B Polygons) → every vertex of B strictly inside convex A, via O(log n) point-in-convex-polygon, or build the hull of A ∪ B with collinear points kept and check that no vertex of B appears on it; minimal perimeter fence = hull perimeter (floating sqrt only at the end).

## C++ template: shoelace area and point in polygon
```cpp
// Twice the signed area: > 0 if vertices are counterclockwise. Exact for integer coordinates.
__int128 area2(const vector<P>& poly) {
    __int128 s = 0;
    int n = poly.size();
    for (int i = 0; i < n; i++) s += (__int128)poly[i].x * poly[(i + 1) % n].y
                                   - (__int128)poly[i].y * poly[(i + 1) % n].x;
    return s;
}
// Lattice points on segment [a, b] including both ends: gcd(|dx|, |dy|) + 1.
// Pick's theorem for a simple lattice polygon: 2A = 2I + B - 2, where B = sum over edges of gcd(|dx|, |dy|).

// Ray casting for a simple polygon (any orientation): 0 outside, 1 strictly inside, 2 on boundary.
int pointInPolygon(const vector<P>& poly, P p) {
    int n = poly.size();
    bool inside = false;
    for (int i = 0; i < n; i++) {
        P a = poly[i], b = poly[(i + 1) % n];
        if (onSegment(a, b, p)) return 2;
        if ((a.y > p.y) != (b.y > p.y)) {          // edge crosses the horizontal line through p
            long long c = cross(a, b, p);          // > 0: p is left of the directed edge a -> b
            if ((c > 0) == (b.y > a.y)) inside = !inside;   // crossing lies to the right of p
        }
    }
    return inside ? 1 : 0;
}
```
Why the ray test is exact: for an upward edge, "p is left of the edge" is the same as "the edge crosses the ray going right from p"; for a downward edge it flips. The half-open rule `(a.y > p.y) != (b.y > p.y)` counts a vertex exactly once when the ray passes through it. O(n) per query.

Point in **convex** polygon in O(log n) (counterclockwise, vertex 0 as pivot): reject if p is right of edge 0→1 or left of edge 0→(n−1); binary search the fan wedge (0, i, i+1) containing p by the sign of cross(v0, vi, p); then p is inside iff it is left of (or on, for non-strict) edge vi → vi+1. Integer area tricks: a triangle with lattice vertices has twice-area integer, so "area = n·m/k" is achievable iff 2·n·m is divisible by k, then split the factors with gcd into the legs of a right triangle at the origin (1030D Vasya and Triangle).

## Manhattan and Chebyshev distance: the 45-degree rotation
With u = x + y and v = x − y: |x1 − x2| + |y1 − y2| = max(|u1 − u2|, |v1 − v2|). So Manhattan distance becomes Chebyshev distance in (u, v) coordinates, where the two axes are independent. Conversely, Chebyshev max(|dx|, |dy|) = (|du| + |dv|) / 2 with the same u, v, which turns "king move" distances into separable Manhattan sums.
```cpp
// Maximum Manhattan distance from a query point to a fixed set, O(1) per query after O(n).
struct FarthestManhattan {
    long long mxU = LLONG_MIN, mnU = LLONG_MAX, mxV = LLONG_MIN, mnV = LLONG_MAX;
    void add(long long x, long long y) {
        mxU = max(mxU, x + y); mnU = min(mnU, x + y);
        mxV = max(mxV, x - y); mnV = min(mnV, x - y);
    }
    long long query(long long x, long long y) const {   // requires at least one added point
        return max({mxU - (x + y), (x + y) - mnU, mxV - (x - y), (x - y) - mnV});
    }
};
// Diameter of a point set in Manhattan metric: max(mxU - mnU, mxV - mnV).

// Sum of Manhattan distances over all pairs: separable per coordinate.
long long sumPairwise1D(vector<long long> xs) {
    sort(xs.begin(), xs.end());
    long long res = 0, pre = 0;
    for (int i = 0; i < (int)xs.size(); i++) { res += xs[i] * i - pre; pre += xs[i]; }
    return res;
}
// total = sumPairwise1D(all x) + sumPairwise1D(all y)
```
Uses: 1689D Lena and Matrix (cell minimizing the maximum Manhattan distance to black cells: evaluate every cell with FarthestManhattan in O(1)); 1648A Weird Sum (per colour, sum of pairwise Manhattan distances = separable 1D sums); points within Manhattan distance d of p form a diamond, which becomes an axis-aligned square in (u, v), so 2D range counting / sweeps apply. Optimal meeting point in Manhattan metric: any median in x and any median in y independently (1486B Eastern Exhibition: count of integer medians per axis, multiply).

## Variations and tricks
- **Exact angle comparison:** compare angles of vectors with half-plane + cross (polar sort above) instead of `atan2`. Sweeping around a point → polar sort the other points, two pointers over the doubled array.
- **Collinear triples / lines through many points:** for each anchor point, normalize directions to all others with gcd, count equal directions in a map: O(n² log n).
- **Parallel lines covering all points** (849B Tell Your World, points (i, y_i)): the common slope is determined by two of the first three points; try the three slopes, group points by the line constant y·dx − x·dy, need exactly two groups.
- **Rectangles:** axis-aligned intersection is [max of lefts, min of rights] × [max of bottoms, min of tops], empty if either side is negative. Union area of a few rectangles via inclusion–exclusion.
- **Circles:** compare squared distance with (r1 ± r2)² for intersection/containment, all in integers.
- **Floating point when required:** `long double`, `acosl/atan2l`, eps around 1e−9 relative to coordinate scale; print with `setprecision(10) << fixed`. Avoid `sqrt` in comparisons; compare squares.
- **Rotation by 90 degrees:** (x, y) → (−y, x); reflection over y = x: (x, y) → (y, x). Squares from two adjacent vertices: add the rotated edge vector.
- **Bounding by convexity:** a function of a point that is convex (sum of distances) can be minimized by ternary search per coordinate; in Manhattan metric use medians instead.

## Pitfalls
- Using `double` for orientation tests on 10^9 coordinates: products need ~63 bits, doubles have 53, giving wrong signs.
- Overflow in cross products when |coordinates| go beyond about 1.07·10^9 (the worst case 2·(2.14·10^9)² passes LLONG_MAX) or when multiplying two cross products; switch to `__int128`.
- Shoelace sums of many 10^18 terms overflow long long; accumulate in `__int128`, and remember the formula gives twice the area (divide at the end or print .5).
- Convex hull with duplicate points: deduplicate first; otherwise zero-length edges break the cross tests.
- Wrong strictness in the hull (`< 0` vs `<= 0`) when the problem asks whether boundary points count.
- Polar sort with `atan2` on integer vectors: equal angles may compare unequal due to rounding.
- Direction normalization without fixing the sign: (1, 2) and (−1, −2) counted as different directions.
- Point in polygon forgetting the boundary case; problems often say "strictly inside".
- Manhattan rotation: u, v are not divided by 2, so distances in (u, v) are Chebyshev in the rotated, scaled grid; converting back requires (u + v) / 2 to be an integer (same parity of u and v).

## Classic Codeforces problems
- 849B Tell Your World (1600) — try the slopes defined by pairs among the first three points; group the rest by line constant with cross products.
- 1648A Weird Sum (1400) — Manhattan distance is separable: per colour, sorted x and y with prefix sums.
- 1030D Vasya and Triangle (1800) — twice the area must be an integer: need 2nm divisible by k, then distribute factors with gcd.
- 1689D Lena and Matrix (1900) — rotate to u = x + y, v = x − y; the farthest black cell from any cell is O(1) via four extremes.
- 961D Pair Of Lines (2000) — two of the first three points lie on one of the lines; try each pair, check the rest are collinear with cross products.
- 166B Polygons (2100) — every vertex of B must be strictly inside convex A: O(log n) point-in-convex-polygon or a hull test.
