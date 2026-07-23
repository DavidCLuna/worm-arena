// Spatial hash grid: particiona el mundo en celdas para consultas de proximidad O(1)
class SpatialHash {
  constructor(cellSize = 100) {
    this.cell = cellSize;
    this.map = new Map(); // "cx,cy" -> [items]
  }
  clear() { this.map.clear(); }
  _key(cx, cy) { return cx + ',' + cy; }
  insert(x, y, item) {
    const cx = Math.floor(x / this.cell), cy = Math.floor(y / this.cell);
    const k = this._key(cx, cy);
    let arr = this.map.get(k);
    if (!arr) { arr = []; this.map.set(k, arr); }
    arr.push(item);
  }
  // Devuelve items en las celdas que cubren el círculo (x,y,r)
  query(x, y, r, out) {
    out = out || [];
    const c = this.cell;
    const x0 = Math.floor((x - r) / c), x1 = Math.floor((x + r) / c);
    const y0 = Math.floor((y - r) / c), y1 = Math.floor((y + r) / c);
    for (let cx = x0; cx <= x1; cx++) {
      for (let cy = y0; cy <= y1; cy++) {
        const arr = this.map.get(this._key(cx, cy));
        if (arr) for (let i = 0; i < arr.length; i++) out.push(arr[i]);
      }
    }
    return out;
  }
}
module.exports = SpatialHash;
