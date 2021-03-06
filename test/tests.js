"use strict";

var assert = require("assert"),

    m    = require("mithril"),

    run    = require("./lib/run"),
    code   = require("./lib/code");

describe("mithril-objectify", function() {
    it("Empty selector", function() {
        assert.deepEqual(
            run('m("")'),
            m("")
        );
    });

    it("Selector w/ id", function() {
        assert.deepEqual(
            run('m("#fooga")'),
            m("#fooga")
        );
    });
    
    it("should support hyphenated attributes in the selector (issue #35)", function() {
        assert.deepEqual(
            run('m(".fooga[wooga-booga=1]")'),
            m(".fooga[wooga-booga=1]")
        );
    });
    
    describe("Selector w/ BinaryExpression", function() {
        it("should convert simple literal addition", function() {
            assert.equal(
                code('m("input" + ".pure-u")'),
                '({tag:"input",attrs:{className:"pure-u"},children:[]});'
            );
            
            assert.equal(
                code('m("input.a" + 3)'),
                '({tag:"input",attrs:{className:"a3"},children:[]});'
            );
            
            assert.equal(
                code('m("input." + true)'),
                '({tag:"input",attrs:{className:"true"},children:[]});'
            );
        });
        
        it("should not convert other operators", function() {
            assert.equal(
                code('m("input" - 2)'),
                'm("input"-2);'
            );
            
            assert.equal(
                code("m(3 * 2)"),
                "m(3*2);"
            );
        });
        
        it("should not convert more than 2 values", function() {
            assert.equal(
                code('m("input" + ".pure-u" + ".pure-u-1-2")'),
                'm("input"+".pure-u"+".pure-u-1-2");'
            );
        });
        
        it("should not convert non-literal values", function() {
            assert.equal(
                code('m("input" + identifier)'),
                'm("input"+identifier);'
            );
        });
    });
    
    it("should support selector attributes w/o a value", function() {
        assert.deepEqual(
            run('m("div[fooga]")'),
            m("div[fooga]")
        );
    });

    describe("Attributes", function() {
        it("should support dynamic attribute property values", function() {
            assert.deepEqual(
                run('m("input.fooga", { class : true ? "true" : "false" })'),
                m("input.fooga", { class : true ? "true" : "false" }) // eslint-disable-line
            );
        });

        it("should support hyphenated attribute properties (issue #35)", function() {
            assert.deepEqual(
                run('m(".fooga", { "wooga-booga" : 1 })'),
                m(".fooga", { "wooga-booga" : 1 })
            );
        });

        it("should use non-string attribute values correctly", function() {
            assert.deepEqual(
                run('m("div", { fooga : 0 })'),
                m("div", { fooga : 0 })
            );
            
            assert.deepEqual(
                run('m("div", { fooga : false })'),
                m("div", { fooga : false })
            );
            
            assert.deepEqual(
                run('m("div", { fooga : null })'),
                m("div", { fooga : null })
            );
            
            assert.deepEqual(
                run('m("div", { fooga : undefined })'),
                m("div", { fooga : undefined })
            );
        });

        it("should support quoted attribute properties (issue #6)", function() {
            /* eslint quote-props:0 */
            assert.deepEqual(
                run('m("div", { "fooga" : 0 })'),
                m("div", { "fooga" : 0 })
            );
        });

        it("should support attributes and non-string children", function() {
            assert.equal(
                code('m("div", { }, FOOGA)'),
                '({tag:"div",attrs:{},children:[FOOGA]});'
            );
        });
    });

    describe("String children", function() {
        it("should support one", function() {
            assert.deepEqual(
                run('m("div", "fooga")'),
                m("div", "fooga")
            );
        });
        
        it("should support expressions", function() {
            assert.equal(
                code('m("div", "fooga" + "wooga")'),
                '({tag:"div",attrs:{},children:["fooga"+"wooga"]});'
            );
        });
        
        it("should support String.prototype methods", function() {
            assert.equal(
                code('m("div", "fooga".replace("f", "g"))'),
                '({tag:"div",attrs:{},children:["fooga".replace("f","g")]});'
            );
            
            assert.equal(
                code('m("div", "fooga"["replace"]("f", "g"))'),
                '({tag:"div",attrs:{},children:["fooga"["replace"]("f","g")]});'
            );
        });
    });

    describe("Array.prototype comprehension", function() {
        it("should unwrap Array.prototype children that retrun an array", function() {
            assert.deepEqual(
                code('m("div", [ 1, 2 ].map(function(val) { return val; }))'),
                '({tag:"div",attrs:{},children:[1,2].map(function(val){return val;})});'
            );

            assert.deepEqual(
                code('m("div", [ 1, 2 ].filter(function(val) { return val === 1; }))'),
                '({tag:"div",attrs:{},children:[1,2].filter(function(val){return val===1;})});'
            );

            assert.deepEqual(
                code('m("div", [ 1, 2 ].sort())'),
                '({tag:"div",attrs:{},children:[1,2].sort()});'
            );
            
            assert.equal(
                code('m("div", [ 1, 2 ].join(""))'),
                '({tag:"div",attrs:{},children:[1,2].join("")});'
            );
            
            // Yes this looks insane, but it's still valid
            assert.equal(
                code('m("div", [ 1, 2 ]["join"](""))'),
                '({tag:"div",attrs:{},children:[1,2]["join"]("")});'
            );
        });
        
        it("shouldn't unwrap Array.prototype children when they don't return an array", function() {
            assert.equal(
                code('m("div", [ 1, 2 ].forEach(function(val) { return val === 1 }))'),
                'm("div",[1,2].forEach(function(val){return val===1;}));'
            );
            
            assert.equal(
                code('m("div", [ 1, 2 ].some(function(val) { return val === 1 }))'),
                'm("div",[1,2].some(function(val){return val===1;}));'
            );
        });
    });

    describe("Conditional expression children", function() {
        it("should convert when all entries are literals", function() {
            assert.equal(
                code('m("div", foo ? "bar" : "baz")'),
                '({tag:"div",attrs:{},children:[foo?"bar":"baz"]});'
            );
        });
        
        it("should not convert when entries are not literals", function() {
            // Can't convert this, dunno what `bar` is
            assert.equal(
                code('m("div", foo ? bar : "baz")'),
                'm("div",foo?bar:"baz");'
            );
            
            // Can't convert this, unable to merge args w/ conditional results
            assert.equal(
                code('m("div", foo ? { class : options.class } : null)'),
                'm("div",foo?{class:options.class}:null);'
            );
        });
    });

    it("m.trust children", function() {
        assert.equal(
            code('m("div", m.trust("<div>"))'),
            '({tag:"div",attrs:{},children:[m.trust("<div>")]});'
        );
    });

    it("m.component children", function() {
        assert.equal(
            code('m("div", m.component(fooga))'),
            '({tag:"div",attrs:{},children:[m.component(fooga)]});'
        );
    });

    it("Nested m()", function() {
        assert.deepEqual(
            run('m("div", m("div"))'),
            m("div", m("div"))
        );
        
        assert.deepEqual(
            run('m("div", m("div", m("div")), m("div"))'),
            m("div", m("div", m("div")), m("div"))
        );
    });

    describe("JSON function children", function() {
        it("should know that JSON.stringify is safe", function() {
            assert.equal(
                code('m("div", JSON.stringify({}))'),
                '({tag:"div",attrs:{},children:[JSON.stringify({})]});'
            );
        });
        
        it("shouldn't transform JSON.parse since it may not be safe", function() {
            assert.equal(
                code('m("div", JSON.parse({}))'),
                'm("div",JSON.parse({}));'
            );
        });
    });

    it("should not transform unsafe invocations", function() {
        // Ensure that the selector must be literal
        assert.equal(
            code('m(".fooga" + dynamic)'),
            'm(".fooga"+dynamic);'
        );
        
        // Identifiers can't be resolved at compile time, so ignore
        assert.equal(
            code('m(".fooga", identifier)'),
            'm(".fooga",identifier);'
        );
    });
    
    it("should output correct source maps", function() {
        assert.equal(
            code('m(".fooga")', { sourceMaps : "inline" }),
            '({tag:"div",attrs:{className:"fooga"},children:[]});\n' +
            "//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbInVua25vd24iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEiLCJmaWxlIjoidW5rbm93biIsInNvdXJjZXNDb250ZW50IjpbIm0oXCIuZm9vZ2FcIikiXX0="
        );
    });
});
