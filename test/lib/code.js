"use strict";

var babel  = require("babel-core"),
    assign = require("lodash.assign"),

    plugin = require("../../");

module.exports = function(source, options, pluginOpts) {
    var result = babel.transform(source, assign({
            compact : true,
            plugins : [
                [ plugin, pluginOpts ]
            ]
        }, options || {}));

    return result.code;
};
