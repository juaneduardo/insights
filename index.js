var  _ = require("underscore"),
    d3 = require("d3")(),
    Tooltip = require("./tooltip");

var UNSELECTED_COLOR = "transparent"; //"#EFEFEF";
var DEFAULT_PATH_STROKE_WIDTH = .3;
var SELECTED_PATH_STROKE_WIDTH = 1.5;
var DEFAULT_CIRCLE_STROKE = "#FFF";
var ZOOM_SCALE_EXTENT = [0.2, 2.3];

var TOOLTIP_TEMPLATE = "<div>word: {{text}}</div> <div>count: {{count}}</div>";
var BASE_ELEMENT_CLASS = "insights-graph";
var DEFAULT_WIDTH = 1200;
var DEFAULT_HEIGHT = 700; 
var DEFAULT_COLLISION_ALPHA = .5;
var DEFAULT_FORCE_ALPHA_LIMIT = 0.007;
var DEFAULT_SIZE_ATTR = "size";  // where to find size info

function Graph(el, nodes, links, options) {
    options = options || {};

    this.el = el;
    this.links = links;
    this.nodes = nodes;
    this.onRendered = options.onRendered ||function() {};
    this.onReset = options.onReset || function() {};
    this.width = options.width || DEFAULT_WIDTH;
    this.height = options.height ||DEFAULT_HEIGHT;
    this.color = d3.scale.category20();
    this.collisionAlpha = options.collisionAlpha || DEFAULT_COLLISION_ALPHA;
    this.scaleExtent = options.scaleExtent || ZOOM_SCALE_EXTENT;
    this.sizeAttr = options.sizeAttr || DEFAULT_SIZE_ATTR;
    
    if (options.initialScale) {
        this.initialScale = options.initialScale;
    }

    this.max = {};
    this.min = {};

    this.adjacentNodes = {};
    this.processData();
    this.processScales();
    this.init();

    this.tooltip = new Tooltip({
        template: options.tooltipTemplate ||TOOLTIP_TEMPLATE
    }); 

    this.render();
}

Graph.version = "0.3";

Graph.prototype = {
    constructor: Graph,

    processData: function() {
        var self = this;
        var nodesHash = {};
        var maxSize = 0;
        var maxWeight = 0;
        var adjacents= {}
        var linksList = [];
        var clusters = {};

        this.nodes.forEach(function(n) {
            maxSize = Math.max(maxSize, self.getSize(n));
            n.name = n.id;
            nodesHash[n.id] = nodesHash[n.id] || n;

            if (n.cluster != null) {
                // caching cluster data
                clusters[n.cluster] = self.color(n.cluster);
            }
        });

        // Compute the distinct nodes from the links.
        this.links.forEach(function(link) {
            var source = nodesHash[link[0]],
                target = nodesHash[link[1]];

            if (!source ||!target) return;
            
            if (!(link[0] in adjacents)) {
                adjacents[link[0]]= {};
                adjacents[link[0]][link[0]]= true;
            } 
            if (!(link[1] in adjacents)) {
                adjacents[link[1]]= {};
                adjacents[link[1]][link[1]]= true;
            }
            adjacents[link[0]][link[1]]=true;
            adjacents[link[1]][link[0]]= true;

            linksList.push({
                source: source,
                target: target
            });
        });

        this.linksList = linksList;
        this.adjacents = adjacents;
        this.nodesHash = nodesHash;

        this.max.size = maxSize;
        this.clusters = clusters;
    },

    processScales: function() {
        this.radiusScale = d3.scale.sqrt().domain([1, this.max.size]).range([6, 40]);
        this.titleScale = d3.scale.log().domain([1, this.max.size]).range([0, 1]);
    },

    processCenterCoords: function() {
        var self = this;
        var xMass=0, yMass=0, totalSize=0;

        this.d3Nodes.each(function(d) { 
            var size = self.getSize(d);
            xMass += d.x * size;
            yMass += d.y * size;
            totalSize += size;
        });

        this.xCenter = xMass / totalSize;
        this.yCenter = yMass / totalSize;
    },

    init: function() {
        var self = this;
        
        this._zoom = d3.behavior.zoom().translate([0,0]);

        if (this.initialScale) {
            this._zoom = this._zoom.scale(this.initialScale);
        }

        this.$el = this.getElement();

        this.svg = this.$el
            .attr("class", this.$el.attr("class") + " " + BASE_ELEMENT_CLASS) 
            .append("svg")
                .attr("width", this.width)
                .attr("height", this.height)
                .attr("pointer-events", "all")
                .call(this._zoom.on("zoom", _(this.onZoom).bind(this))
                               .scaleExtent(this.scaleExtent))

        this.baseGroup = this.svg.append('svg:g')
                              .style('display','none');

        this.$el.on("click", function() { self._reset() });
    },

    onZoom: function() {
        var zoom = this._zoom;
        var trans = this.getTranslation();
        var scale = this.getScale();

        //var x = trans[0] - scale*(this.xCenter - this.width / 2 );
        //var y = trans[1] - scale*(this.yCenter - this.height / 2);
        this.baseGroup.attr("transform", "translate(" + trans + ")" + " scale(" + scale + ")");

        this.displayTitle();
    },

    zoom: function(scale) {
        var trans = this.getTranslation();
        var zoom = this._zoom;

        zoom.scale(scale);

        this.baseGroup.transition().duration(500).attr('transform', 
            'translate(' + zoom.translate() + ') scale(' + zoom.scale() + ')');

        this.displayTitle();
    },

    zoomIn: function() {
        var scale = this.getScale();
        var k = Math.pow(2, Math.floor(Math.log(scale) / Math.LN2) + 1);

        k = Math.min(k, this.scaleExtent[1]);
            
        this.zoom(k);
    },

    zoomOut: function() {
        var scale = this.getScale();
        var k = Math.pow(2, Math.ceil(Math.log(scale) / Math.LN2) - 1);

        k = Math.max(k, this.scaleExtent[0]);
            
        this.zoom(k);
    },

    isTitleDisplayable: function(d) {
        var scale = this.getScale();
        var res = this.titleScale(this.getSize(d) || 1);

        return (scale * res > .8 || scale > 2.2 );
    },

    displayTitle: function() {
        var self = this;
        var scale = this.getScale();
        var adjacentNodes = this.adjacentNodes;
        var selectedNode = this.selectedNode;
        var hasSelection = !!this.selectedNode;
        var isThereMatch = this.isThereMatch();

        this.d3TitleNodes.style("display", function(d) {
            var isDisplayable = self.isTitleDisplayable(d);

            if (isDisplayable && self.isSelected(d)) {
                if (isThereMatch && !isMatched(d)) {
                    return "none";
                } else {
                    return "";
                }
            }

            if (hasSelection && !adjacentNodes[d.id]) {
                return "none"
            }

            if (isThereMatch && !isMatched(d)) {
                return "none";
            }

            if (isDisplayable) {
                return "";
            } else {
                return "none";
            }
        });
    },

    pathStroke: function(d) {
        var source = d.source,
        target = d.target;

        if (this.getSize(target) > this.getSize(source)) {
            return this.getClusterColor(target.cluster);
        } else {
            return this.getClusterColor(source.cluster);
        }
    },


    render: function() {
        var self = this;
        var nodesHash = {};
        var nodes = this.nodes;

        function circleFill(d) { return self.getClusterColor(d.cluster); }
        function circleRadius(d) { return self.radiusScale(self.getSize(d) ||1); }

        var force = this.force = d3.layout.force()
            .nodes(d3.values(this.nodesHash)) // lo pasa de {a:1, b:2} a [1, 2]
            .links(this.linksList)
            .size([this.width, this.height])
            .linkDistance(60)
            .linkStrength(1)
            .gravity(0.2)
            .charge(-240)
            .on("tick", tick)
            .start();

        var path = this.d3Path = this.baseGroup.append("svg:g").selectAll("path")
            .data(force.links())
            .enter().append("svg:path")
            .attr("stroke", _(this.pathStroke).bind(this))
            .attr("stroke-width", DEFAULT_PATH_STROKE_WIDTH)
            .attr("fill", "none");
            //.attr("marker-end", function(d) { return "url(#" + d.type + ")"; }); // QUE ES ESTO??
        
        var node = this.d3Nodes = this.baseGroup.selectAll(".node")
            .data(force.nodes())
            .enter().append("g")
            .attr("class", "node")
            .on("mouseover", onMouseOver)
            .on("mouseout", onMouseOut)
            .on("click", _(this.onCircleClick).bind(this));
            //.call(force.drag)

        var circle = this.d3Circles = node.append("circle")
            .style("fill", circleFill)
            .attr("r", circleRadius)

        var titleNodes = this.d3TitleNodes = node.append("text")
            .attr("text-anchor", "middle")
            .attr("dy", ".35em")
            .style("display", "none")
            .text(function(d) { return d.text; });

        function tick(e) {
            if (force.alpha() < DEFAULT_FORCE_ALPHA_LIMIT) {
                self.handleCollisions();

                // to prevent the chart from moving after
                force.stop();

                self.positionNodes();
                self.generateLinks();

                self.processCenterCoords();

                // showing canvas after finished rendering
                self.show();

                self.onZoom();
                self.onRendered();
            }
        }

        function onMouseOver(d) {
            var selectedNode = self.selectedNode;

            if (self.selectedNode && !self.isSelected(d) && !self.isAdjacent(d)) {
                return;
            }

            if (self.isThereMatch() && !isMatched(d)) {
                return;
            }

            var offset = { 
                    left: currentMousePos.x + 10, 
                    top: currentMousePos.y + 10 
                };

            self.tooltip.show(offset, d);
        }

        function onMouseOut(d) {
            self.tooltip.hide();
        }
    },

    show: function() {
        this.baseGroup.style('display','block')
    },

    hide: function() {
        this.baseGroup.style('display','none')
    },

    handleCollisions: function() {
        var nodes = this.nodes,
            q = d3.geom.quadtree(nodes),
            i = 0,
            n = nodes.length;

        while (++i < n) {
            q.visit(this.collide(nodes[i], this.collisionAlpha));
        }
    },

    // Updates the position of the nodes
    positionNodes: function() {
        this.d3Nodes.attr("transform", function(d) { 
            return "translate(" + d.x + "," + d.y + ")"; 
        });
    },

    // Updates the position of the links
    generateLinks: function() {
        // curve line between nodes
        this.d3Path.attr("d", function(d) {
            var dx = d.target.x - d.source.x,
            dy = d.target.y - d.source.y,
            dr = Math.sqrt(dx * dx + dy * dy);
            return "M" + d.source.x + "," + d.source.y + "A" + dr + "," + dr + " 0 0,1 " + d.target.x + "," + d.target.y;
        });
    },

    onCircleClick: function(d) {
        var self = this;
        var circle = this.d3Circles;
        var path = this.d3Path;
        var adjacentNodes;


        if (self.selectedNode && !self.isSelected(d) && !self.isAdjacent(d)) {
            return;
        }

        if (self.isThereMatch() && !isMatched(d)) {
            return;
        }

        d3.event.preventDefault();
        d3.event.stopPropagation();

        this.selectNode(d);
        this.draw();
    },

    selectNode: function(d) {
        // In this case we want no match data, just the clicked circle data
        if (this.isThereMatch()) {
            this._reset();
        }

        this.selectedNode = d;


        if (this.adjacents[d.id]) {
            this.adjacentNodes = this.adjacents[d.id];
        }

    },

    isSelected: function(node) {
        return this.selectedNode && this.selectedNode.id === node.id;
    },

    isAdjacent: function(node) {
        return !!this.adjacentNodes[node.id]
    },

    isThereMatch: function() {
        return this.matching;
    },

    draw: function() {
        var self = this;
        var circle = this.d3Circles;
        var path = this.d3Path;
        var titles = this.d3TitleNodes;
        var adjacentNodes = this.adjacentNodes || {};
        var selectedNode = this.selectedNode;
        var isThereMatch = this.isThereMatch();

        circle.style('fill', function(e) {
            if (selectedNode) {
                if (self.isAdjacent(e)) {
                    if (isThereMatch && isMatched(e) ||!isThereMatch) {
                        return self.getClusterColor(e.cluster);
                    } else {
                        return UNSELECTED_COLOR;
                    }
                } else {
                    return UNSELECTED_COLOR;
                }
            } else if (isThereMatch && isMatched(e)) {
                return self.getClusterColor(e.cluster);
            } else {
                return UNSELECTED_COLOR;
            }
        }).style("stroke", function(e) {
            if (selectedNode) {
                if (self.isSelected(e)) {
                    if (isThereMatch && isMatched(e) ||!isThereMatch) {
                        return d3.rgb(self.getClusterColor(e.cluster)).darker();
                    } else {
                        return UNSELECTED_COLOR;
                    }
                } else if (self.isAdjacent(e)) {
                    if (isThereMatch && isMatched(e) ||!isThereMatch) {
                        return DEFAULT_CIRCLE_STROKE;
                    } else {
                        return UNSELECTED_COLOR;
                    }
                } else {
                    return UNSELECTED_COLOR;
                }
            } else if (isThereMatch && isMatched(e)) {
                return DEFAULT_CIRCLE_STROKE;
            } else {
                return UNSELECTED_COLOR;
            }
        });

        path.attr("stroke", function(e) {
            if (selectedNode) {
                if (self.isSelected(e.source) || self.isSelected(e.target)) {
                    if (isThereMatch && isMatched(e.source) && isMatched(e.target) ||!isThereMatch) {
                        return self.pathStroke(e);
                    } else {
                        return UNSELECTED_COLOR;
                    }
                } else {
                    return UNSELECTED_COLOR;
                }
            } else if (isThereMatch && isMatched(e.source) && isMatched(e.target)) {
                return self.pathStroke(e);
            } else {
                return UNSELECTED_COLOR;
            }
        }).attr("stroke-width", function(e) {
                if (self.isSelected(e.source) || self.isSelected(e.target)) {
                    return SELECTED_PATH_STROKE_WIDTH;
                } else {
                    return DEFAULT_PATH_STROKE_WIDTH;
                }
            });

        this.displayTitle();
    },

    reset: function() {
        var self = this;
        var circle = this.d3Circles;
        var path = this.d3Path;

        this.adjacentNodes = {};
        delete this.selectedNode;
        delete this.matching;

        circle.style('fill', function(e) {
                // reseting selection
                delete e._matched; 
                return self.getClusterColor(e.cluster);
            }).style("stroke", function(e) {
                return DEFAULT_CIRCLE_STROKE;
            });

        path.attr("stroke-width", function(e, i) {
                return DEFAULT_PATH_STROKE_WIDTH;
            })
        .attr("stroke", function(e, i) {
                return self.pathStroke(e);
            });

        this.displayTitle();

    },

    _reset: function(preventTrigger) {
        this.reset();

        if (!preventTrigger) {
            this.onReset();
        }

    },

    setMatchs: function(fn) {
        this.matching = true;
        this.d3Nodes.each(function(e) {
            e._matched = fn(e);
        });
    },

    selectBy: function(fn) {
        this.setMatchs(fn);
        this.draw();
    },

    selectByTextExact: function(text) {
        var matchText = text.toLowerCase();

        var n;
        this.d3Nodes.each(function(d) {
            if (d.text.toLowerCase() == matchText) 
                n = d;
        });

        if (n) {
            this.selectNode(n);
            this.draw();
        }

    },

    // rename to selectByTextPartial
    selectByText: function(text) {
        var matchText = text.toLowerCase();

        this.selectBy(function(e) {
            var nodeText = (e.text || "").toLowerCase();
            return !!(~nodeText.indexOf(matchText));
        });
    },

    selectByCluster: function(cluster) {
        this.selectBy(function(e) {
            var c = e.cluster;

            if (c != null) {
                c = c.toString()
            }

            // if an array is passed
            if (typeof cluster == "object" && cluster.indexOf) {
                return ~cluster.indexOf(c);
            }

            // if a value is passed
            return c == cluster;
        });
    },

    /**
     * Hace que los nodos no se peguen.
     */
    collide: function(node, alpha) {
        var self = this,
            r = node.radius + 16,
            nx1 = node.x - r,
            nx2 = node.x + r,
            ny1 = node.y - r,
            ny2 = node.y + r;

        return function(quad, x1, y1, x2, y2) {
            if (quad.point && (quad.point !== node)) {
                var x = node.x - quad.point.x,
                y = node.y - quad.point.y,
                l = Math.sqrt(x * x + y * y),
                r= self.radiusScale(self.getSize(quad.point) ||1)*2;
                if (l < r) {
                    l = (l - r) / l * alpha;
                    node.x -= x *= l;
                    node.y -= y *= l;
                    quad.point.x += x;
                    quad.point.y += y;
                }
            }
            return x1 > nx2
            || x2 < nx1
            || y1 > ny2
            || y2 < ny1;
        }
    },

    getScale: function() {
        return this._zoom.scale();
    },

    getTranslation: function() {
        return this._zoom.translate();
    },

    getElement: function() {
        return d3.select(this.el);
    },

    getSize: function(d) {
        return d[this.sizeAttr] || 0;
    },

    getClusters: function() {
        return this.clusters;
    },

    getClusterColor: function(cluster) {
        return this.clusters[cluster];
    }
}

var currentMousePos = { x: -1, y: -1 };
d3.select(window).on("mousemove", function(d) {
    var ev = d3.event;
    currentMousePos.x = ev.pageX;
    currentMousePos.y = ev.pageY;
});

// helpers 
function isMatched(d) {
    return hasMatchData(d) && d._matched;
}

function hasMatchData(d) {
    return d._matched != null;
}

module.exports = Graph;