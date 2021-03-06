"use strict";

var valid = require("./valid");

function getClass(api, path) {
    var t    = api.types,
        node = path.node,
        type = "className";
    
    if(node.arguments[1] && t.isObjectExpression(node.arguments[1])) {
        // TODO: REWRITE
        node.arguments[1].properties.some(function(property) {
            var key = property.key.name || property.key.value;

            if(key === "class") {
                type = "class";

                return true;
            }
            
            return false;
        });
    }

    return type;
}

function parseSelector(state) {
    var t    = state.types,
        node = state.path.node,
        css  = [],
        src  = node.arguments[0];
    
    // Simple binary expressions like "foo" + "bar" can be statically handled
    // It'd be weird to write it, but you never know
    if(t.isBinaryExpression(src) && src.operator === "+") {
        src = src.left.value + src.right.value;
    } else {
        src = src.value;
    }
    
    if(!src) {
        return;
    }
    
    src.match(/(?:(^|#|\.)([^#\.\[\]]+))|(\[.+?\])/g).forEach(function(match) {
        var lead = match.charAt(0),
            parts;

        if(lead === "#") {
            state.attrs.id = t.stringLiteral(match.slice(1));

            return;
        }

        if(lead === ".") {
            css.push(match.slice(1));

            return;
        }

        if(lead === "[") {
            parts = match.match(/\[(.+?)(?:=("|'|)(.*?)\2)?\]/);
            state.attrs[parts[1]] = t.stringLiteral(parts[3] || "");
            
            return;
        }

        state.tag = match;
    });
    
    if(css.length > 0) {
        state.attrs[state.key] = t.stringLiteral(css.join(" "));
    }
}

function parseAttrs(state) {
    var t = state.types,
        v = state.valid,

        existing = state.attrs[state.key];
    
    state.path.node.arguments[1].properties.forEach(function(property) {
        var key = property.key.name || property.key.value;
        
        // Combining class strings is a little trickier
        if(key === state.key && existing && existing.value.length) {
            // Ignore empty strings
            if(t.isStringLiteral(property.value) && property.value.value === "") {
                return;
            }
            
            // Literals get merged as a string
            if(v.isValueLiteral(property.value)) {
                state.attrs[state.key] = t.stringLiteral(`${existing.value} ${property.value.value}`);
                
                return;
            }
            
            // Non-literals get combined w/ a "+"
            state.attrs[state.key] = t.binaryExpression("+", t.stringLiteral(`${existing.value} `), property.value);

            return;
        }

        state.attrs[key] = property.value;
    });
}

function transform(api, path) {
    var state = Object.assign({}, api, {
            path  : path,
            tag   : "div",
            attrs : {},
            nodes : [],
            start : 1,
            key   : getClass(api, path)
        }),
        
        t = state.types,
        v = state.valid;

    parseSelector(state);
    
    // Is the second argument an object? Then it's attrs and they need to be parsed
    if(t.isObjectExpression(path.node.arguments[1])) {
        parseAttrs(state);

        state.start = 2;
    }
    
    // Make sure children is accurately sized
    if(path.node.arguments.length > state.start) {
        state.nodes = path.node.arguments.slice(state.start);
    }
    
    // Modify children based on contents
    if(state.nodes.length === 1) {
        if(t.isArrayExpression(state.nodes[0])) {
            // Make sure we don't end up w/ [ [ ... ] ]
            state.nodes = t.arrayExpression(state.nodes[0].elements);
        } else if(v.isArrayExpression(state.nodes[0])) {
            // Array expressions that return arrays get unwrapped
            state.nodes = state.nodes[0];
        } else {
            // Otherwise wrap it in an array
            state.nodes = t.arrayExpression(state.nodes);
        }
    } else {
        state.nodes = t.arrayExpression(state.nodes);
    }
    
    return state;
}

module.exports = function(api) {
    var t = api.types,
        v = valid(api);
    
    return {
        visitor : {
            CallExpression : function(path) {
                var state;
                
                if(!v.mithril(path.node)) {
                    return;
                }

                state = transform({
                    types : t,
                    valid : v
                }, path);
                    
                path.replaceWith(t.objectExpression([
                    t.objectProperty(t.identifier("tag"), t.stringLiteral(state.tag)),
                    t.objectProperty(t.identifier("attrs"), t.objectExpression(Object.keys(state.attrs).map(function(key) {
                        return t.objectProperty(
                            t.isValidIdentifier(key) ? t.identifier(key) : t.stringLiteral(key),
                            state.attrs[key]
                        );
                    }))),
                    t.objectProperty(t.identifier("children"), state.nodes)
                ]));
            }
        }
    };
};
