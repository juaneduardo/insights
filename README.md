Insights.js
===========

An interactive force graph written with d3. 

<img src="http://ignacioola.github.com/insights/img/1.png" />

Demo [here](http://ignacioola.github.com/insights/examples/basic.html)

## Installation

### With component.js

Insights can be installed with [component.js](https://github.com/component/component).

    $ component install ignacioola/insights

### Without component.js

Add the `insights.standalone.js` and `insights.standalone.css` files located under `build/` to your webpage.

## Usage
```javascript
var Insights = require("insights");
```

## Example Data

```javascript
var nodes = [
    {
        id: 1,
        text: "apple",
        size: 9,
        cluster: 5
    },
    {
        id: 2,
        text: "google",
        size: 7,
        cluster: 2
    },
    {
        id: 3,
        text: "microsoft",
        size: 5,
        cluster: 1
    }
];

var links = [
    [ 1, 2 ], // [ source.id, target.id ]
    [ 2, 3 ],
    [ 1, 3 ]
];
```

## How to use it ?

```javascript
var el = document.getElementById("container");
var graph = new Insights(el, nodes, links).render();
```

## Adding a an event handler

```javascript
graph.on("rendered", function() {
    // hide loader, ...
});
```

## Events

* `rendered`: when the graph has finished rendering.
* `no match`: when a filter is applied and no matching nodes where found.
* `node:click`: when a node is clicked.
* `node:mouseover`: when the mouse is over a node.
* `node:mouseout`: when the mouse goes out from a node.

## Filtering
The filter function decides which nodes are visible and which are not. Always after applying filters the graph must be updated by calling `update()`.
```javascript
graph.filters({...}).update();
```

To return to the graph initial state, you can call `reset()`.
```javascript
graph.reset();
```

### Filter by id
```javascript
graph.filter({ id: 1 });
```

### Filter by partial text match 
```javascript
graph.filter({ text: "micro" });
```

### Filter by size
```javascript

// filter by a range of values

graph.filter({ size: [1, 15] });

// filter greater than.. 

graph.filter({ size: [1, null] });

// filter lower than..

graph.filter({ size: [null, 15] });
```

### Filter by clusters
```javascript
graph.filter({ cluster: 1})

//  or multi-cluster filter...

graph.filter({ cluster: [1, 2, 3] })
```

### Filtering by more than one value
```javascript
graph.filter({ text: "app", size: [1, 15], cluster: 0 })
```

### Custom filters
```javascript
graph.filter(function(node) {
  if (node.text == "something") {
    return true;
  } else {
    return false;
  }
})
```

## Focusing

With `.focus()` you can decide which node and it's relations get highlighted.

### Focusing by id
```javascript
graph.focus(1);

//  or

graph.focus({ id: 1 });
```

### Focusing by exact text match
```javascript
graph.focus({ text: "Apple" })
```
This will focus the graph on the first node that matches exactly the given text.

## Method chaining
You can apply filters even in the focused state.
```javascript
graph.focus({ id: 1 })
     .filter({ size: [ 50, 100 ] })
     .zoom(.2)
     .update()
```

## Adding a tooltip

Using mustache synthax:

```javascript
graph.tooltip("<div>name: {{text}}</div><div>count: {{count}}</div>")
```

## API 

### Insights(el, nodes, links, options)

Creates a new graph on the `el` element with the given nodes and links. Available options include:

* `width`: the graph width.
* `height`: the graph height.
* `collisionAlpha`: used when trying to solve collisions to determine how far from each other to position nodes. Defaults to `0.5`. 
* `initialScale`: the chart's initial scale.
* `tooltip`: adds a tooltip with the passed template if a string if passed. If you pass a truthy value, that's not a string it uses the default template.
* `colors`: an object containing the colors for each cluster. For example: `{ "0": "blue", "1": "#FF0000" } `.
    

### .attr(str, fn)

Sets an accessor function for the desired node's attribute's value.

### .filter(fn|obj)

Selects all the nodes that for which `fn` result evaluates to `true` or if an object passed by all of it's values.
    
### .focus(fn|obj|id)

Focuses the graph on the first node that matches the passed parameters.

### .reset()

It returns the graph to it's original state.

### .tooltip(template:str)

Adds a tooltip with the given template to the `node:mouseover` event.
    
### .zoomIn()

Zooms in the graph.
    
### .zoomOut()

Zooms out the graph.
    
### .zoom(scale)

Zooms the graph to the given `scale`.
    
### .center(id)
    
Centers the graph. If there's a selected node it will be centered around it, if not it will center the graph on the mass center. If a node's id is passed, it centers the graph on it.
    
### .getClusters()

Returns an object with the available clusters.

## Used in

* [#8N Analysis](http://blog.zenzey.com/reports/8N)

## Licence

MIT
