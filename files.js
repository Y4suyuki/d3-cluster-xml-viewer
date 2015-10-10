function myFunction() {
    if (document.body.scrollTop || document.documentElement.scrollTop > 50) {
        document.getElementById('header').className = 'scrolled';
    } else {
        document.getElementById('header').className = '';
    }
}

function fileinfo(files) {
    for (var i=0; i < files.length; i++) {
        f = files[i];
        console.log(f.name,f.size,f.type,f.lastModified);
    }
};

function readfile(f) {
    var reader = new FileReader();
    reader.readAsText(f)
    reader.onload = function() {
        var text = reader.result;
        var out = document.getElementById('raw');
        var url = getBlobURL(f);
        out.innerHTML = '';
        out.appendChild(document.createTextNode(text));
        d3.select('svg').remove();
        d3.xml(url, callback);
    }
    reader.onerror = function(e) {
        console.log("Error", e);
    }
};

var getBlobURL = (window.URL && URL.createObjectURL.bind(URL)) || (window.webkitURL && webkitURL.createObjectURL.bind(webkitURL)) || window.createObjectURL;

function callback(data) {
    
    function xml2obj(xml, depth) {
        // convert xml data to javascript object
        // reference http://davidwalsh.name/convert-xml-json

        var obj = {};
        obj['name'] = xml.nodeName;
        obj['children'] = [];
        // add id to avoid collision
        obj['id'] = Math.floor(Math.random() * 1000000 + 1);
        if (xml.children.length > 0) {
            for (var i = 0; i < xml.children.length; i++) {
                obj['children'].push(xml2obj(xml.children[i], depth + 1))
            }
        }
        if (xml.nodeType==1) {
            return obj;
        } else {
            return obj.children[0];
        }
    }

        function obj2set(tree_lst) {
        // return set of name of nodes in all tree
        function obj2set_helper(tree_lst, acc) {
            acc = acc.concat(tree_lst.map(function(n) { return n.name; }))
            next_tree_lst = tree_lst.map(function(n) { return n.children ? n.children : [] }).reduce(function(x,y) { return x.concat(y); })
            if (next_tree_lst.length > 0) {
                return obj2set_helper(next_tree_lst, acc);
            } else {
                return acc;
            }
        }
        return obj2set_helper(tree_lst, [])
    }
    
    new_data = xml2obj(data, depth=0);
    console.log('new processed data');
    console.log(new_data);

    elem_lst = obj2set([new_data]);
    elem_set = {}
    var j = 0;
    for (var i = 0; i < elem_lst.length; i++) {
        if (!elem_set[elem_lst[i]]) {
            elem_set[elem_lst[i]] = j;
            j++;
        }
    }
    console.log('--- elem_set ---');
    console.log(elem_set);


    // fold children
    toggleChildren(new_data);

    var draw = chart(new_data, elem_set);
    draw();

}

// fold new_data
function toggle(d) {
    console.log('toggle');
    if (d.children) {
        d._children = d.children;
        d.children = null;
    } else {
        d.children = d._children;
        d._children = null;
    }
}

function toggleChildren(d) {
    if (d.children) {
        d.children.map(toggleChildren);
        d.children.map(toggle);
        return true;
    } else {
        return false;
    }
}

function chart(data, elem_set) {
    
    // initial parameters
    var margin = {'top': 20, 'right': 300, 'bottom': 60, 'left': 20};
    var width = screen.width;
    var height = screen.height;
    var node_radius = 10;
    var node_fill_color = function(d) {
        // change color in each different element groups
        return color_scale(elem_set[d.name]);
    }
    var nodestroke = function(d) {
        return color_scale(elem_set[d.name]);
    }
    var line_stroke_width = 1.5;
    var line_stroke = '#555';
    var duration_ms = 750;
    var color_scale = d3.scale.category20();

    var nodeFill = function(d) {
        return d._children === undefined || d._children === null || d._children.length == 0 ? 'white' : node_fill_color(d);
    }

    var nodeCursor = function(d) {
        if (d.children !== undefined && d.children !== null && d.children.length > 0) {
            return 'pointer';
        } else if (d._children === undefined || d._children === null || d._children.length == 0 ) {
            return 'default';
        } else {
            return 'pointer';
        }
    }

    function draw() {
        var cluster = d3.layout.cluster();
        var svg = d3.select('#output').append('svg')
            .style('width', '100%')
            .attr('height', height)
            .append('g')
            .attr('transform', 'translate(' + margin.left + ', ' + margin.top + ')');

        // Obj{x:float, y:float} -> String
        var diagonal = d3.svg.diagonal()
            .projection(function(d) {
                return [d.y, d.x];
            });

        // initialise cluster size (height, width)
        cluster.size([height - margin.top - margin.bottom, width - margin.left - margin.right]);


        // init render
        var nodes = cluster.nodes(new_data);
        var links = cluster.links(nodes);
        
        console.log('--- nodes ---');
        console.log(nodes);
        console.log('--- links ---');
        console.log(links);

        var link = svg.selectAll('.link')
            .data(links)
            .enter()
            .append('path')
            .attr('stroke-width', line_stroke_width)
            .attr('class', 'link')
            .attr('d', diagonal)
            .attr('stroke', line_stroke)
            .attr('opacity', .2);


        var node = svg.selectAll('.node')
            .data(nodes)
            .enter()
            .append('g')
            .attr('class', 'node')
            .style('cursor', nodeCursor)
            .attr('transform', function(d) {
                return 'translate(' + d.y + ',' + d.x + ')';
            })
            .on('click', function(d) {
                toggle(d);
                update(d);
            });
        

        node.append('circle')
            .attr('r', node_radius)
            .attr('fill', nodeFill)
            .attr('stroke', nodestroke)
            .attr('stroke-width', 3);
        
        nodes.forEach(function(d) {
            d.x0 = d.x;
            d.y0 = d.y;
        });

        node.append('text')
            .attr('x', node_radius)
            .attr('y', -node_radius)
            .text(function(d) { return d.name });

        function update(source) {
            nodes = cluster.nodes(data);
            links = cluster.links(nodes);
            
            var link = svg.selectAll('.link')
                .data(links, function(d) { return d.target.name + d.target.id; }); 
            // set key for identification
            
            link.enter().insert('path')
                .attr('class', 'link')
                .attr('d', function(d) {
                    var o = {x: source.x0, y:source.y0};
                    return diagonal({source: o, target: o});
                })
                .attr('stroke-width', line_stroke_width)
                .attr('stroke', line_stroke)
                .attr('opacity', .2)
                .transition()
                .attr('d', diagonal);

            link.transition().duration(duration_ms)
                .attr('d', diagonal);

            link.exit().transition().duration(duration_ms)
                .attr('d', function(d) {
                    var o = { x: source.x, y: source.y};
                    return diagonal({source: o, target: o});
                }).remove();

            var node = svg.selectAll('.node')
                .data(nodes, function(d) { return d.name + d.id; }); // set key for identification

            var nodeEnter = node.enter().append('g')
                .attr('class', 'node')
                .attr('transform', 'translate(' + source.y0 + ',' + source.x0 + ')')
                .on('click', function(d) {
                    toggle(d);
                    update(d);
                });

            nodeEnter.append('circle')
                .attr('r', node_radius)
                .attr('stroke', nodestroke)
                .attr('fill', nodeFill)
                .attr('stroke-width', 3);

            nodeEnter.append('text')
                .attr('x', node_radius)
                .attr('y', -node_radius)
                .text(function(d) { return d.name });

            var nodeUpdate = node.transition()
                .duration(duration_ms)
                .attr('transform', function(d) {
                    return 'translate(' + d.y + ',' + d.x + ')';
                })
                .style('cursor', nodeCursor);

            nodeUpdate.select('circle').attr('fill', nodeFill);

            var nodeExit = node.exit().transition().duration(duration_ms)
                .attr('transform', 'translate(' + source.y + ',' + source.x + ')')
                .remove();

            // remember position nodes came from
            nodes.forEach(function(d) {
                d.x0 = d.x;
                d.y0 = d.y;
            });
        }
    }

    return draw;
}
