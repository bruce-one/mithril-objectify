"use strict";

var vm    = require("vm"),
    babel = require("babel-core"),

    plugin = require("../../");

module.exports = function(source, _, pluginOpts = {}) {
    var result = babel.transform(source, {
            plugins : [
                [ plugin, pluginOpts ]
            ]
        });

    // wrap w/ vm so it returns an object
    return vm.runInThisContext(result.code);
};
