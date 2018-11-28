"use strict";

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } }

function _createClass(Constructor, protoProps, staticProps) { if (protoProps) _defineProperties(Constructor.prototype, protoProps); if (staticProps) _defineProperties(Constructor, staticProps); return Constructor; }

var RapidNeighborJoining = function () {
  var RNJ =
  /*#__PURE__*/
  function () {
    function RNJ(D, taxa) {
      var copyDistanceMatrix = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : false;
      var taxonIdAccessor = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : function (d) {
        return d.name;
      };

      _classCallCheck(this, RNJ);

      if (taxa.length != D.length) {
        console.error("Row/column size of the distance matrix does not agree with the size of taxa matrix");
        return;
      }

      var N = this.N = taxa.length;
      this.cN = this.N;

      if (copyDistanceMatrix) {
        this.D = new Array(N);

        for (var i = 0; i < N; i++) {
          this.D[i] = arrayCopy(D[i]);
        }
      } else {
        this.D = D;
      }

      this.taxa = taxa;
      this.labelToTaxon = {};
      this.currIndexToLabel = new Array(N);
      this.rowChange = new Array(N);
      this.newRow = new Array(N);
      this.labelToNode = new Array(2 * N);
      this.nextIndex = N;
      this.initializeSI();
      this.removedIndices = new Set();
      this.indicesLeft = new Set();

      for (var _i = 0; _i < N; _i++) {
        this.currIndexToLabel[_i] = _i;
        this.indicesLeft.add(_i);
      }

      this.rowSumMax = 0;
      this.PNewick = "";
      this.taxonIdAccessor = taxonIdAccessor;
      return this;
    }

    _createClass(RNJ, [{
      key: "initializeSI",
      value: function initializeSI() {
        var N = this.N;
        this.I = new Array(N);
        this.S = new Array(N);

        for (var i = 0; i < N; i++) {
          var sortedRow = sortWithIndices(this.D[i], i, true);
          this.S[i] = sortedRow;
          this.I[i] = sortedRow.sortIndices;
        }
      }
    }, {
      key: "search",
      value: function search() {
        var qMin = Infinity,
            D = this.D,
            cN = this.cN,
            n2 = cN - 2,
            S = this.S,
            I = this.I,
            rowSums = this.rowSums,
            removedColumns = this.removedIndices,
            uMax = this.rowSumMax,
            q,
            minI = -1,
            minJ = -1,
            c2; // initial guess for qMin

        for (var r = 0; r < this.N; r++) {
          if (removedColumns.has(r)) continue;
          c2 = I[r][0];
          if (removedColumns.has(c2)) continue;
          q = D[r][c2] * n2 - rowSums[r] - rowSums[c2];

          if (q < qMin) {
            qMin = q;
            minI = r;
            minJ = c2;
          }
        }

        for (var _r = 0; _r < this.N; _r++) {
          if (removedColumns.has(_r)) continue;

          for (var c = 0; c < S[_r].length; c++) {
            c2 = I[_r][c];
            if (removedColumns.has(c2)) continue;
            if (S[_r][c] * n2 - rowSums[_r] - uMax > qMin) break;
            q = D[_r][c2] * n2 - rowSums[_r] - rowSums[c2];

            if (q < qMin) {
              qMin = q;
              minI = _r;
              minJ = c2;
            }
          }
        }

        return {
          minI: minI,
          minJ: minJ
        };
      }
    }, {
      key: "run",
      value: function run() {
        var minI,
            minJ,
            d1,
            d2,
            l1,
            l2,
            node1,
            node2,
            node3,
            self = this;

        function setUpNode(label, distance) {
          var node;

          if (label < self.N) {
            node = new PhyloNode(self.taxa[label], distance);
            self.labelToNode[label] = node;
          } else {
            node = self.labelToNode[label];
            node.setLength(distance);
          }

          return node;
        }

        this.rowSums = sumRows(this.D);

        for (var i = 0; i < this.cN; i++) {
          if (this.rowSums[i] > this.rowSumMax) this.rowSumMax = this.rowSums[i];
        }

        while (this.cN > 2) {
          //if (this.cN % 100 == 0 ) console.log(this.cN);
          var _this$search = this.search();

          minI = _this$search.minI;
          minJ = _this$search.minJ;
          d1 = 0.5 * this.D[minI][minJ] + (this.rowSums[minI] - this.rowSums[minJ]) / (2 * this.cN - 4);
          d2 = this.D[minI][minJ] - d1;
          l1 = this.currIndexToLabel[minI];
          l2 = this.currIndexToLabel[minJ];
          node1 = setUpNode(l1, d1);
          node2 = setUpNode(l2, d2);
          node3 = new PhyloNode(null, null, node1, node2);
          this.recalculateDistanceMatrix(minI, minJ);
          var sorted = sortWithIndices(this.D[minJ], minJ, true);
          this.S[minJ] = sorted;
          this.I[minJ] = sorted.sortIndices;
          this.S[minI] = this.I[minI] = [];
          this.cN--;
          this.labelToNode[this.nextIndex] = node3;
          this.currIndexToLabel[minI] = -1;
          this.currIndexToLabel[minJ] = this.nextIndex++;
        }

        var left = this.indicesLeft.values();
        minI = left.next().value;
        minJ = left.next().value;
        l1 = this.currIndexToLabel[minI];
        l2 = this.currIndexToLabel[minJ];
        d1 = d2 = this.D[minI][minJ] / 2;
        node1 = setUpNode(l1, d1);
        node2 = setUpNode(l2, d2);
        this.P = new PhyloNode(null, null, node1, node2);
      }
    }, {
      key: "recalculateDistanceMatrix",
      value: function recalculateDistanceMatrix(joinedIndex1, joinedIndex2) {
        var D = this.D,
            n = D.length,
            sum = 0,
            aux,
            aux2,
            removedIndices = this.removedIndices,
            rowSums = this.rowSums,
            newRow = this.newRow,
            rowChange = this.rowChange,
            newMax = 0;
        removedIndices.add(joinedIndex1);

        for (var i = 0; i < n; i++) {
          if (removedIndices.has(i)) continue;
          aux = D[joinedIndex1][i] + D[joinedIndex2][i];
          aux2 = D[joinedIndex1][joinedIndex2];
          newRow[i] = 0.5 * (aux - aux2);
          sum += newRow[i];
          rowChange[i] = -0.5 * (aux + aux2);
        }

        for (var _i2 = 0; _i2 < n; _i2++) {
          D[joinedIndex1][_i2] = -1;
          D[_i2][joinedIndex1] = -1;
          if (removedIndices.has(_i2)) continue;
          D[joinedIndex2][_i2] = newRow[_i2];
          D[_i2][joinedIndex2] = newRow[_i2];
          rowSums[_i2] += rowChange[_i2];
          if (rowSums[_i2] > newMax) newMax = rowSums[_i2];
        }

        rowSums[joinedIndex1] = 0;
        rowSums[joinedIndex2] = sum;
        if (sum > newMax) newMax = sum;
        this.rowSumMax = newMax;
        this.indicesLeft.delete(joinedIndex1);
      }
    }, {
      key: "createNewickTree",
      value: function createNewickTree(node) {
        if (node.taxon) {
          // leaf node
          this.PNewick += this.taxonIdAccessor(node.taxon);
        } else {
          // node with children
          this.PNewick += "(";

          for (var i = 0; i < node.children.length; i++) {
            this.createNewickTree(node.children[i]);
            if (i < node.children.length - 1) this.PNewick += ",";
          }

          this.PNewick += ")";
        }

        if (node.length) {
          this.PNewick += ":".concat(node.length);
        }
      }
    }, {
      key: "getAsObject",
      value: function getAsObject() {
        return this.P;
      }
    }, {
      key: "getAsNewick",
      value: function getAsNewick() {
        this.PNewick = "";
        this.createNewickTree(this.P);
        this.PNewick += ";";
        return this.PNewick;
      }
    }]);

    return RNJ;
  }();

  var PhyloNode =
  /*#__PURE__*/
  function () {
    function PhyloNode() {
      var taxon = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : null;
      var length = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : null;
      var child1 = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : null;
      var child2 = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : null;

      _classCallCheck(this, PhyloNode);

      this.taxon = taxon;
      this.length = length;
      this.children = [];
      if (child1 !== null) this.children.push(child1);
      if (child2 !== null) this.children.push(child2);
    }

    _createClass(PhyloNode, [{
      key: "setLength",
      value: function setLength(length) {
        this.length = length;
      }
    }]);

    return PhyloNode;
  }();

  function arrayCopy(a) {
    var b = new Array(a.length),
        i = a.length;

    while (i--) {
      b[i] = a[i];
    }

    return b;
  }

  function sumRows(a) {
    var sum,
        n = a.length,
        sums = new Array(n);

    for (var i = 0; i < n; i++) {
      sum = 0;

      for (var j = 0; j < n; j++) {
        if (a[i][j] === undefined) continue;
        sum += a[i][j];
      }

      sums[i] = sum;
    }

    return sums;
  }

  function sortWithIndices(toSort) {
    var skip = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : -1;
    var n = toSort.length;
    var indexCopy = new Array(n);
    var valueCopy = new Array(n);
    var i2 = 0;

    for (var i = 0; i < n; i++) {
      if (toSort[i] === -1 || i === skip) continue;
      indexCopy[i2] = i;
      valueCopy[i2++] = toSort[i];
    }

    indexCopy.length = i2;
    valueCopy.length = i2;
    indexCopy.sort(function (a, b) {
      return toSort[a] - toSort[b];
    });
    valueCopy.sortIndices = indexCopy;

    for (var j = 0; j < i2; j++) {
      valueCopy[j] = toSort[indexCopy[j]];
    }

    return valueCopy;
  }

  return RNJ;
}();