"use strict";

var assert = require("assert"),

    m     = require("mithril/render/hyperscript"),

    run    = require("./lib/run"),
    code   = require("./lib/code");

function parse(expected) {
    return (new Function(`return ${expected}`)())
}

describe("mithril-objectify", function() {
    it("Dynamic classes", function() {
        assert.deepEqual(
            run('m("input.fooga", { class : true ? "true" : "false" })'),
            m("input.fooga", { class : true ? "true" : "false" }) // eslint-disable-line
        );
    });

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

    it("Selector w/ attribute w/ no value", function() {
        assert.deepEqual(
            run('m("div[fooga]")'),
            m("div[fooga]")
        );
    });

    it("Non-string attr values", function() {
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

    it("Non-string attr values (identifiers)", function() {
        assert.equal(
            code('m("div", { fooga : unknown })'),
            '({"tag":"div","key":undefined,"attrs":{fooga:unknown},"children":[],"text":undefined,"dom":undefined,"domSize":undefined,"state":{},"events":undefined,"instance":undefined,"skip":false});'
        );
    });

    it("Non-string attr values (functions)", function() {
        assert.equal(
            code('m("div", { fooga : () => { return x } })'),
            '({"tag":"div","key":undefined,"attrs":{fooga:()=>{return x;}},"children":[],"text":undefined,"dom":undefined,"domSize":undefined,"state":{},"events":undefined,"instance":undefined,"skip":false});'
        );
    });

    it("Non-string attr values with inline syntax (identifiers)", function() { // TODO this isn't very exhaustive...
        assert.equal(
            code('m("div[a=b]", { fooga : unknown })'),
            '({"tag":"div","key":undefined,"attrs":{fooga:unknown,"a":"b"},"children":[],"text":undefined,"dom":undefined,"domSize":undefined,"state":{},"events":undefined,"instance":undefined,"skip":false});'
        );

        assert.equal(
            code('m("div[a=b][c=d]", { fooga : unknown })'),
            '({"tag":"div","key":undefined,"attrs":{fooga:unknown,"a":"b","c":"d"},"children":[],"text":undefined,"dom":undefined,"domSize":undefined,"state":{},"events":undefined,"instance":undefined,"skip":false});'
        );
    });

    it("Quoted properties (issue #6)", function() {
        /* eslint quote-props:0 */
        assert.deepEqual(
            run('m("div", { "fooga" : 0 })'),
            m("div", { "fooga" : 0 })
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

    it("nested m() with identifiers", function() {
        assert.equal(
            code('m("tr", m("th", "Name"), m("td", obj.name))'),
            'm("tr",{"tag":"th","key":undefined,"attrs":undefined,"children":undefined,"text":"Name","dom":undefined,"domSize":undefined,"state":{},"events":undefined,"instance":undefined,"skip":false},m("td",obj.name));'
        );

        assert.equal(
            code('m("tr", m("th", JSON.stringify(unknown)), m("td", obj.name))'),
            'm("tr",{"tag":"th","key":undefined,"attrs":undefined,"children":undefined,"text":JSON.stringify(unknown),"dom":undefined,"domSize":undefined,"state":{},"events":undefined,"instance":undefined,"skip":false},m("td",obj.name));'
        );
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

        assert.equal(
            code('m(".fooga", { class: "x" }, identifier)'),
            'm(".fooga",{class:"x"},identifier);'
        );
    });

    it.skip("should output correct source maps", function() {
        assert.equal(
            code('m(".fooga")', { sourceMaps : "inline" }),
            '({tag:"div",attrs:{className:"fooga"},children:[],dom:undefined,domSize:undefined,events:undefined,key:undefined,state:{},text:undefined});\n' +
            "//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbInVua25vd24iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEiLCJmaWxlIjoidW5rbm93biIsInNvdXJjZXNDb250ZW50IjpbIm0oXCIuZm9vZ2FcIikiXX0="
        );
    });

    describe("hyphenated attributes (issue #35)", function() {
        it("should support hyphenated attributes in the selector", function() {
            assert.deepEqual(
                run('m(".fooga[wooga-booga=1]")'),
                m(".fooga[wooga-booga=1]")
            );
        });

        it("should support hyphenated attributes as an attribute", function() {
            assert.deepEqual(
                run('m(".fooga", { "wooga-booga" : 1 })'),
                m(".fooga", { "wooga-booga" : 1 })
            );
        });
    });

    describe("Selector w/ BinaryExpression", function() {
        it("should convert simple literal addition", function() {
            assert.deepEqual(
                run('m("input" + ".pure-u")'),
                parse('({tag:"input",attrs:{className:"pure-u"},children:[],dom:undefined,domSize:undefined,events:undefined,key:undefined,state:{},text:undefined,skip:false,instance:undefined});')
            );

            assert.deepEqual(
                run('m("input.a" + 3)'),
                parse('({tag:"input",attrs:{className:"a3"},children:[],dom:undefined,domSize:undefined,events:undefined,key:undefined,state:{},text:undefined,skip:false,instance:undefined});')
            );

            assert.deepEqual(
                run('m("input." + true)'),
                parse('({tag:"input",attrs:{className:"true"},children:[],dom:undefined,domSize:undefined,events:undefined,key:undefined,state:{},text:undefined,skip:false,instance:undefined});')
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

        it("should convert more than 2 values", function() {
            assert.deepEqual(
                run('m("input" + ".pure-u" + ".pure-u-1-2")'),
                parse('({"tag":"input","key":undefined,"attrs":{"className":"pure-u pure-u-1-2"},"children":[],"text":undefined,"dom":undefined,"domSize":undefined,"state":{},"events":undefined,"instance":undefined,"skip":false});')
            );
        });

        it("should not convert non-literal values", function() {
            assert.equal(
                code('m("input" + identifier)'),
                'm("input"+identifier);'
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
            assert.deepEqual(
                run('m("div", "fooga" + "wooga")'),
                parse('({"tag":"div","key":undefined,"attrs":undefined,"children":undefined,"text":"foogawooga","dom":undefined,"domSize":undefined,"state":{},"events":undefined,"instance":undefined,"skip":false});')
            );
        });

        it("should support String.prototype methods", function() {
            assert.deepEqual(
                run('m("div", "fooga".replace("f", "g"))'),
                parse('({tag:"div",attrs:undefined,children:undefined,dom:undefined,domSize:undefined,events:undefined,key:undefined,state:{},text:"googa",instance:undefined,skip:false});')
            );

            assert.deepEqual(
                run('m("div", "fooga"["replace"]("f", "g"))'),
                parse('({tag:"div",attrs:undefined,children:undefined,dom:undefined,domSize:undefined,events:undefined,key:undefined,state:{},text:"googa",instance:undefined,skip:false});')
            );
        });
    });

    describe("Array.prototype comprehension", function() {
        it("should unwrap Array.prototype children that return an array", function() {
            assert.equal(
                code('m("div", [ 1, 2 ].map(function(val) { return val; }))'),
                '({"tag":"div","key":undefined,"attrs":undefined,"children":[{"tag":"#","key":undefined,"attrs":undefined,"children":1,"text":undefined,"dom":undefined,"domSize":undefined,"state":{},"events":undefined,"instance":undefined,"skip":false},{"tag":"#","key":undefined,"attrs":undefined,"children":2,"text":undefined,"dom":undefined,"domSize":undefined,"state":{},"events":undefined,"instance":undefined,"skip":false}],"text":undefined,"dom":undefined,"domSize":undefined,"state":{},"events":undefined,"instance":undefined,"skip":false});'
            );

            assert.deepEqual(
                code('m("div", [ 1, 2 ].filter(function(val) { return val === 1; }))'),
                '({"tag":"div","key":undefined,"attrs":undefined,"children":undefined,"text":1,"dom":undefined,"domSize":undefined,"state":{},"events":undefined,"instance":undefined,"skip":false});'
            );

            assert.deepEqual(
                code('m("div", [ 1, 2 ].filter(function(val) { return val === x; }))'),
                'm("div",[1,2].filter(function(val){return val===x;}));'
            );

            assert.deepEqual(
                code('m("div", [ 1, 2 ].sort())'),
                '({"tag":"div","key":undefined,"attrs":undefined,"children":[{"tag":"#","key":undefined,"attrs":undefined,"children":1,"text":undefined,"dom":undefined,"domSize":undefined,"state":{},"events":undefined,"instance":undefined,"skip":false},{"tag":"#","key":undefined,"attrs":undefined,"children":2,"text":undefined,"dom":undefined,"domSize":undefined,"state":{},"events":undefined,"instance":undefined,"skip":false}],"text":undefined,"dom":undefined,"domSize":undefined,"state":{},"events":undefined,"instance":undefined,"skip":false});'
            );
            assert.deepEqual(
                code('m("div", [ 1, x ].sort())'),
                'm("div",[1,x].sort());'
            );
        });

        it("should support Array.prototype comprehensions when there are multiple children", function() {
            assert.deepEqual(
                code('m("div", [ 1, 2 ], [ 3, 4 ].map(function(val) { return val; }))'),
                '({"tag":"div","key":undefined,"attrs":undefined,"children":[{"tag":"[","key":undefined,"attrs":undefined,"children":[{"tag":"#","key":undefined,"attrs":undefined,"children":1,"text":undefined,"dom":undefined,"domSize":undefined,"state":{},"events":undefined,"instance":undefined,"skip":false},{"tag":"#","key":undefined,"attrs":undefined,"children":2,"text":undefined,"dom":undefined,"domSize":undefined,"state":{},"events":undefined,"instance":undefined,"skip":false}],"text":undefined,"dom":undefined,"domSize":undefined,"state":{},"events":undefined,"instance":undefined,"skip":false},{"tag":"[","key":undefined,"attrs":undefined,"children":[{"tag":"#","key":undefined,"attrs":undefined,"children":3,"text":undefined,"dom":undefined,"domSize":undefined,"state":{},"events":undefined,"instance":undefined,"skip":false},{"tag":"#","key":undefined,"attrs":undefined,"children":4,"text":undefined,"dom":undefined,"domSize":undefined,"state":{},"events":undefined,"instance":undefined,"skip":false}],"text":undefined,"dom":undefined,"domSize":undefined,"state":{},"events":undefined,"instance":undefined,"skip":false}],"text":undefined,"dom":undefined,"domSize":undefined,"state":{},"events":undefined,"instance":undefined,"skip":false});'
            );
            assert.deepEqual(
                code('m("div", [ x, 2 ], [ 3, 4 ].map(function(val) { return val; }))'),
                'm("div",[x,2],[3,4].map(function(val){return val;}));'
            );
        });

        it("should handle Array.prototype methods that return a string", function() {
            assert.deepEqual(
                run('m("div", [ 1, 2 ].join(""))'),
                parse('({"tag":"div","key":undefined,"attrs":undefined,"children":undefined,"text":"12","dom":undefined,"domSize":undefined,"state":{},"events":undefined,"instance":undefined,"skip":false});')
            );
            assert.deepEqual(
                code('m("div", [ 1, x ].join(""))'),
                'm("div",[1,x].join(""));'
            );

            // Yes this looks insane, but it's still valid
            assert.deepEqual(
                run('m("div", [ 1, 2 ]["join"](""))'),
                parse('({"tag":"div","key":undefined,"attrs":undefined,"children":undefined,"text":"12","dom":undefined,"domSize":undefined,"state":{},"events":undefined,"instance":undefined,"skip":false});')
            );

            assert.equal(
                code('m("div", [x,2]["join"](""))'),
                'm("div",[x,2]["join"](""));'
            );
        });

        it("shouldn't unwrap Array.prototype children when they don't return an array", function() {
            assert.deepEqual(
                run('m("div", [ 1, 2 ].forEach(function(val) { return val === 1 }))'),
                parse('({"tag":"div","key":undefined,"attrs":undefined,"children":[],"text":undefined,"dom":undefined,"domSize":undefined,"state":{},"events":undefined,"instance":undefined,"skip":false});')
            );

            assert.equal(
                code('m("div", [ x, 2 ].forEach(function(val) { return val === 1 }))'),
                'm("div",[x,2].forEach(function(val){return val===1;}));'
            );

            assert.deepEqual(
                run('m("div", [ 1, 2 ].some(function(val) { return val === 1 }))'),
                parse('({"tag":"div","key":undefined,"attrs":undefined,"children":undefined,"text":true,"dom":undefined,"domSize":undefined,"state":{},"events":undefined,"instance":undefined,"skip":false});')
            );

            assert.equal(
                code('m("div", [ x, 2 ].some(function(val) { return val === 1 }))'),
                'm("div",[x,2].some(function(val){return val===1;}));'
            );
        });

        it("shouldn't attempt to transform array.prototype methods on unknown targets", function() {
            assert.equal(
                code('m("div", a.map(function(val) { return val; }))'),
                'm("div",a.map(function(val){return val;}));'
            );
        });

        it("shouldn't attempt to transform array.prototype methods on unknown targets with attributes", function() {
            assert.equal(
                code('m("div", {class:"x"}, a.map(function(val) { return val; }))'),
                'm("div",{class:"x"},a.map(function(val){return val;}));'
            );
        });
    });

    describe("Conditional expression children", function() {
        it("should convert when all entries are literals", function() {
            assert.equal(
                code('m("div", foo ? "bar" : "baz")'),
                '({"tag":"div","key":undefined,"attrs":undefined,"children":undefined,"text":foo?"bar":"baz","dom":undefined,"domSize":undefined,"state":{},"events":undefined,"instance":undefined,"skip":false});'
            );

            assert.equal(
                code('m("div", foo ? 1 : 2)'),
                '({"tag":"div","key":undefined,"attrs":undefined,"children":undefined,"text":foo?1:2,"dom":undefined,"domSize":undefined,"state":{},"events":undefined,"instance":undefined,"skip":false});'
            );

            assert.equal(
                code('m("div", foo ? 1 : 2, 2)'),
                '({"tag":"div","key":undefined,"attrs":undefined,"children":[{"tag":"#","key":undefined,"attrs":undefined,"children":foo?1:2,"text":undefined,"dom":undefined,"domSize":undefined,"state":{},"events":undefined,"instance":undefined,"skip":false},{"tag":"#","key":undefined,"attrs":undefined,"children":2,"text":undefined,"dom":undefined,"domSize":undefined,"state":{},"events":undefined,"instance":undefined,"skip":false}],"text":undefined,"dom":undefined,"domSize":undefined,"state":{},"events":undefined,"instance":undefined,"skip":false});'
            );
        });

        it("should not convert when entries are not literals", function() {
            // Can't convert this, dunno what `bar` is
            assert.equal(
                code('m("div", foo ? bar : "baz")'),
                'm("div",foo?bar:"baz");'
            );

            assert.equal( // TODO this could probably not it's an object? (`attrs:foo?{class:options.class}:null`)
                code('m("div", foo ? { class : options.class } : null)'),
                'm("div",foo?{class:options.class}:null);'
            );
        });
    });

    describe("JSON function children", function() {
        it("should know that JSON.stringify is safe", function() {
            assert.deepEqual(
                run('m("div", JSON.stringify({}))'),
                parse('({tag:"div",attrs:undefined,children:undefined,dom:undefined,domSize:undefined,events:undefined,key:undefined,text:"{}",state:{},skip:false,instance:undefined});')
            );
        });

        it("should know that JSON.stringify is safe with identifiers", function() {
            assert.equal(
                code('m("div", JSON.stringify(unknown))'),
                '({"tag":"div","key":undefined,"attrs":undefined,"children":undefined,"text":JSON.stringify(unknown),"dom":undefined,"domSize":undefined,"state":{},"events":undefined,"instance":undefined,"skip":false});'
            );
        })
        it("should know that JSON.stringify is safe with identifiers (nested)", function() {
            assert.equal(
                code('m("pre", m("code", JSON.stringify(unknown)))'),
                '({"tag":"pre","key":undefined,"attrs":undefined,"children":[{"tag":"code","key":undefined,"attrs":undefined,"children":undefined,"text":JSON.stringify(unknown),"dom":undefined,"domSize":undefined,"state":{},"events":undefined,"instance":undefined,"skip":false}],"text":undefined,"dom":undefined,"domSize":undefined,"state":{},"events":undefined,"instance":undefined,"skip":false});'
            );
        });

        it("should know that JSON.stringify is safe with identifiers, but fail gracefully with unknown identifiers", function() {
            assert.equal(
                code('m("div", JSON.stringify(unknown), x)'),
                'm("div",JSON.stringify(unknown),x);'
            );
        });

        it("should transform JSON.parse when possible", function() {
            assert.deepEqual(
                run('m("div", JSON.parse("{}"))'),
                parse('({"tag":"div","key":undefined,"attrs":undefined,"children":[],"text":undefined,"dom":undefined,"domSize":undefined,"state":{},"events":undefined,"instance":undefined,"skip":false});')
            );

            assert.deepEqual(
                run('m("div", JSON.parse(`{"a": 1}`))'),
                parse('({"tag":"div","key":undefined,"attrs":{"a":1},"children":[],"text":undefined,"dom":undefined,"domSize":undefined,"state":{},"events":undefined,"instance":undefined,"skip":false});')
            );
            assert.deepEqual(
                run('m("div", JSON.parse(`["str"]`))'),
                parse('({"tag":"div","key":undefined,"attrs":undefined,"children":undefined,"text":"str","dom":undefined,"domSize":undefined,"state":{},"events":undefined,"instance":undefined,"skip":false});')
            );
            assert.deepEqual(
                run('m("div", JSON.parse("[1, 2]"))'),
                parse('({"tag":"div","key":undefined,"attrs":undefined,"children":[{"tag":"#","key":undefined,"attrs":undefined,"children":1,"text":undefined,"dom":undefined,"domSize":undefined,"state":{},"events":undefined,"instance":undefined,"skip":false},{"tag":"#","key":undefined,"attrs":undefined,"children":2,"text":undefined,"dom":undefined,"domSize":undefined,"state":{},"events":undefined,"instance":undefined,"skip":false}],"text":undefined,"dom":undefined,"domSize":undefined,"state":{},"events":undefined,"instance":undefined,"skip":false});')
            );
            assert.equal(
                code('m("div", JSON.parse(unknown))'),
                'm("div",JSON.parse(unknown));'
            );
        });
    });

    describe("Multiple rules", function() {
        it("Non-string attr identifiers with JSON.stringify", function() {
            assert.equal(
                code('m("div", { fooga : unknown }, JSON.stringify(unknownJson))'),
                '({"tag":"div","key":undefined,"attrs":{fooga:unknown},"children":undefined,"text":JSON.stringify(unknownJson),"dom":undefined,"domSize":undefined,"state":{},"events":undefined,"instance":undefined,"skip":false});'
            );
        });

        it("Non-string attr identifiers with JSON.stringify (nested)", function() {
            assert.equal(
                code('m("pre", m("code", { fooga : unknown }, JSON.stringify(unknownJson)))'),
                '({"tag":"pre","key":undefined,"attrs":undefined,"children":[{"tag":"code","key":undefined,"attrs":{fooga:unknown},"children":undefined,"text":JSON.stringify(unknownJson),"dom":undefined,"domSize":undefined,"state":{},"events":undefined,"instance":undefined,"skip":false}],"text":undefined,"dom":undefined,"domSize":undefined,"state":{},"events":undefined,"instance":undefined,"skip":false});'
            );
        });
    });
    describe('components', function() {
        it('should handle simple component tags', function() {
            assert.equal(
                code('m(Component)'),
                '({"tag":Component,"key":undefined,"attrs":{},"children":[],"text":undefined,"dom":undefined,"domSize":undefined,"state":{},"events":undefined,"instance":undefined,"skip":false});'
            );
        });
        it('should handle component tags with other arguments', function() {
            assert.equal(
                code('m(Component, {x: 1})'),
                '({"tag":Component,"key":undefined,"attrs":{x:1},"children":[],"text":undefined,"dom":undefined,"domSize":undefined,"state":{},"events":undefined,"instance":undefined,"skip":false});'
            );
            assert.equal(
                code('m(Component, m("div"))'),
                '({"tag":Component,"key":undefined,"attrs":{},"children":[{"tag":"div","key":undefined,"attrs":undefined,"children":[],"text":undefined,"dom":undefined,"domSize":undefined,"state":{},"events":undefined,"instance":undefined,"skip":false}],"text":undefined,"dom":undefined,"domSize":undefined,"state":{},"events":undefined,"instance":undefined,"skip":false});'
            );
            assert.equal(
                code('m(Component, {x: 1}, m("div"))'),
                '({"tag":Component,"key":undefined,"attrs":{x:1},"children":[{"tag":"div","key":undefined,"attrs":undefined,"children":[],"text":undefined,"dom":undefined,"domSize":undefined,"state":{},"events":undefined,"instance":undefined,"skip":false}],"text":undefined,"dom":undefined,"domSize":undefined,"state":{},"events":undefined,"instance":undefined,"skip":false});'
            );
            assert.equal(
                code('m(Component, {x: 1}, m("div", {y: 2}))'),
                '({"tag":Component,"key":undefined,"attrs":{x:1},"children":[{"tag":"div","key":undefined,"attrs":{y:2},"children":[],"text":undefined,"dom":undefined,"domSize":undefined,"state":{},"events":undefined,"instance":undefined,"skip":false}],"text":undefined,"dom":undefined,"domSize":undefined,"state":{},"events":undefined,"instance":undefined,"skip":false});'
            );
            assert.equal( // TODO we could remove key from attrs
                code('m(Component, {key: 0, x: 1}, m("div", {y: 2}))'),
                '({"tag":Component,"key":0,"attrs":{key:0,x:1},"children":[{"tag":"div","key":undefined,"attrs":{y:2},"children":[],"text":undefined,"dom":undefined,"domSize":undefined,"state":{},"events":undefined,"instance":undefined,"skip":false}],"text":undefined,"dom":undefined,"domSize":undefined,"state":{},"events":undefined,"instance":undefined,"skip":false});'
            );
            assert.equal( // TODO we could remove key from attrs
                code('m(Component, {key: 0, x: 1}, m("div", {key: id, y: 2}))'),
                '({"tag":Component,"key":0,"attrs":{key:0,x:1},"children":[{"tag":"div","key":id,"attrs":{key:id,y:2},"children":[],"text":undefined,"dom":undefined,"domSize":undefined,"state":{},"events":undefined,"instance":undefined,"skip":false}],"text":undefined,"dom":undefined,"domSize":undefined,"state":{},"events":undefined,"instance":undefined,"skip":false});'
            );
        });
    })
    it('should assume Object.assign({}...) returns attrs (if told to)', function() { // NOTE: this isn't safe... (Mithril will handle { tag: "x"... } differently :-s
        const opts = { assignNeverComponent: true }
        assert.equal( // check this is disabled by default
            code('m("span", Object.assign({}, x))'),
            'm("span",Object.assign({},x));'
        )
        assert.equal( // check this is disabled
            code('m("span", Object.assign({}, x))', null, { assignNeverComponent: false }),
            'm("span",Object.assign({},x));'
        )

        assert.equal(
            code('m("span", Object.assign({}, x))', null, opts),
            '(function(__mopt_attrs__){return{"tag":"span","key":__mopt_attrs__.key,"attrs":__mopt_attrs__,"children":[],"text":undefined,"dom":undefined,"domSize":undefined,"state":{},"events":undefined,"instance":undefined,"skip":false};})(Object.assign({},x));'
        );

        assert.equal( // can't do it if we don't know if it's an object
            code('m("span", Object.assign(x, y))', null, opts),
            'm("span",Object.assign(x,y));'
        );

        assert.equal(
            code('m("span[x=y]", Object.assign({}, x), "a")', null, opts),
            '(function(__mopt_attrs__){return{"tag":"span","key":__mopt_attrs__.key,"attrs":__mopt_attrs__,"children":undefined,"text":"a","dom":undefined,"domSize":undefined,"state":{},"events":undefined,"instance":undefined,"skip":false};})(Object.assign({},x,{"x":"y"}));'
        );
        assert.equal(
            code('m("span[x=y][m=n]", Object.assign({}, x), "a")', null, opts),
            '(function(__mopt_attrs__){return{"tag":"span","key":__mopt_attrs__.key,"attrs":__mopt_attrs__,"children":undefined,"text":"a","dom":undefined,"domSize":undefined,"state":{},"events":undefined,"instance":undefined,"skip":false};})(Object.assign({},x,{"x":"y","m":"n"}));'
        );

        assert.equal(
            code('m("span", Object.assign({}, x), "a")', null, opts),
            '(function(__mopt_attrs__){return{"tag":"span","key":__mopt_attrs__.key,"attrs":__mopt_attrs__,"children":undefined,"text":"a","dom":undefined,"domSize":undefined,"state":{},"events":undefined,"instance":undefined,"skip":false};})(Object.assign({},x));'
        );

        assert.equal(
            code('m("span", Object.assign({}, x, {key: 1}), "a")', null, opts),
            '(function(__mopt_attrs__){return{"tag":"span","key":__mopt_attrs__.key,"attrs":__mopt_attrs__,"children":undefined,"text":"a","dom":undefined,"domSize":undefined,"state":{},"events":undefined,"instance":undefined,"skip":false};})(Object.assign({},x,{key:1}));'
        );
    })
});
