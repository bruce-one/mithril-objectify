'use strict';
Error.stackTraceLimit = Infinity

const vm = require('vm')
const t = require('babel-core').types
const parse = require('babylon').parse
const generate = require('babel-generator').default
const debug = require('debug')('mopt')
const { isM, isMithrilTrust, isJsonStringify } = require('./valid')

const m = require('mithril/render/hyperscript')
m.trust = require('mithril/render/trust')

const DODGY_MOPT_REPLACE = '__DODGY_MOPT_REPLACE__'

const UNDEFINED_REGEX = new RegExp(`"${DODGY_MOPT_REPLACE}"`, 'g')

function process(code) {
    return (new Function('m', `return (${code})`)(m)) // this `new Function` means the `instanceof Array` for attributes vs children works; the vm.runInNewContext doesn't do that :-s
    //return vm.runInNewContext(code, { m })
}

function shouldProcess(node) {
    return isM(node) || isMithrilTrust(node)
}

let objMatches = []
let jsonMatches = []
const COMPLEX_FUNCS = [
    function jsonStringify(path) {
        const node = JSON.parse(JSON.stringify(path.node))
        jsonMatches = []
        path.traverse(jsonVisitor)
        if(jsonMatches.length !== 0) {
            try {
                const processed = JSON.stringify(process(generate(path.node).code), (_, v) => v === void 0 ? DODGY_MOPT_REPLACE : v).replace(UNDEFINED_REGEX, 'undefined')
                const replaced = jsonMatches.reduce( (str, { key, original }) => str.replace(key, original), processed)
                path.replaceWithSourceString(`(${replaced})`)
            } catch(e) {
                path.stop()
                path.replaceWith(node)
            }
        }
    },
    function attributeIdentifiers(path) {
        if(!t.isObjectExpression(path.node.arguments[1])) return
        const node = JSON.parse(JSON.stringify(path.node))
        objMatches = []
        path.traverse(objVisitor)
        if(objMatches.length !== 0) {
            try {
                const processed = JSON.stringify(process(generate(path.node).code), (_, v) => v === void 0 ? DODGY_MOPT_REPLACE : v).replace(UNDEFINED_REGEX, 'undefined')
                const replaced = objMatches.reduce( (str, { key, original }) => str.replace(key, original), processed)
                path.replaceWithSourceString(`(${replaced})`)
            } catch(e) {
                path.stop()
                path.replaceWith(node)
            }
        }
    },
]
function tryToHandleComplex(path) {
    let result = null
    COMPLEX_FUNCS.find( (func) => {
        try {
            const funcRes = func(path)
            if(funcRes) {
                result = funcRes
                return true
            }
        } catch(e) {
            debug('Complex node exception %s', e.stack)
        }
    })
    return result
}

let i = 0
const jsonVisitor = {
    CallExpression: function(path) {
        if(isJsonStringify(path.node)) {
            const key = `"__DODGY_MOPT_REPLACE_JSON_${i++}__"`
            jsonMatches = jsonMatches.concat({ key, original: generate(path.node).code })
            path.replaceWithSourceString(key)
        }
        return
    }
}
const INTERNAL_ATTRS_KEY = '__DODGY_MOPT_REPLACE_ATTRS_KEY__'
const objVisitor = {
    ObjectExpression: function(path) {
        if(path.node.properties && path.node.properties.length === 1 && path.node.properties[0].key.value === INTERNAL_ATTRS_KEY) {
            debug('Processed')
            return
        }
        const key = `{"${INTERNAL_ATTRS_KEY}":"__DODGY_MOPT_REPLACE_ATTRS_${i++}__"}`
        objMatches = objMatches.concat({ key, original: generate(path.node).code })
        path.replaceWithSourceString(key)
    }
}

const visitor = {
    CallExpression: function(path) {
        if(shouldProcess(path.node)) {
            const { code } = generate(path.node)
            try {
                const replaced = JSON.stringify(process(code), (_, v) => v === void 0 ? DODGY_MOPT_REPLACE : v).replace(UNDEFINED_REGEX, 'undefined')
                path.replaceWithSourceString(`(${replaced})`)
            } catch(e) {
                const result = tryToHandleComplex(path)
                if(result) {
                    path.replaceWithSourceString(`(${result})`)
                } else {
                    debug('Failed to process node %j because of error %s', e.stack)
                }
            }
        }
        return
    }
}

module.exports = function() {
    return {
        visitor
    }
}
