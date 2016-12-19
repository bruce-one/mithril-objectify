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
    debug('executing %s', code)
    return (new Function('m', `return (${code})`)(m)) // this `new Function` means the `instanceof Array` for attributes vs children works; the vm.runInNewContext doesn't do that :-s
    //return vm.runInNewContext(code, { m })
}

function shouldProcess(node) {
    return isM(node) || isMithrilTrust(node)
}

let replacementId = 0
let matches = []
const INTERNAL_ATTRS_KEY = '__DODGY_MOPT_REPLACE_ATTRS_KEY__'
const COMPLEX_RULES = [
    {
        visitor: {
            CallExpression: function(path) {
                if(isJsonStringify(path.node)) {
                    const key = `"__DODGY_MOPT_REPLACE_JSON_${replacementId++}__"`
                    matches = matches.concat({ key, type: 'jsonStringify', original: generate(path.node).code })
                    path.replaceWithSourceString(key)
                    debug('replaced JSON.stringify with %s', key)
                }
                return
            }
        },
        transform: function jsonStringify(processed) {
            const jsonMatches = matches.filter( ({ type }) => type === 'jsonStringify')
            if(jsonMatches.length !== 0) {
                const replaced = jsonMatches.reduce( (str, { key, original }) => str.replace(key, original), processed)
                return `(${replaced})`
            }
        },
    }, {
        visitor: {
            ObjectExpression: function(path) {
                if(path.node.properties && path.node.properties.length === 1 && path.node.properties[0].key.value === INTERNAL_ATTRS_KEY) {
                    debug('already processed object attrs')
                    return
                }
                const key = `{"${INTERNAL_ATTRS_KEY}":"__DODGY_MOPT_REPLACE_ATTRS_${replacementId++}__"}`
                matches = matches.concat({ key, type: 'attributeIdentifiers', original: generate(path.node).code })
                path.replaceWithSourceString(key)
                debug('replaced object with %s', key)
            }
        },
        transform: function attributeIdentifiers(processed) {
            const objMatches = matches.filter( ({ type }) => type === 'attributeIdentifiers')
            if(objMatches.length !== 0) {
                const replaced = objMatches.reduce( (str, { key, original }) => str.replace(key, original), processed)
                return replaced
            }
        },
    }
]
function tryToHandleComplex(path) {
    const node = JSON.parse(JSON.stringify(path.node))
    matches = []
    COMPLEX_RULES.forEach( ({ visitor }) => path.traverse(visitor) )
    try {
        const processed = JSON.stringify(process(generate(path.node).code), (_, v) => v === void 0 ? DODGY_MOPT_REPLACE : v).replace(UNDEFINED_REGEX, 'undefined')
        return COMPLEX_RULES.reduce( (code, { transform }) => {
            const updatedCode = transform(code)
            if(updatedCode && updatedCode !== code) {
                path.replaceWithSourceString(`(${updatedCode})`)
                return updatedCode
            }
            return code
        }, processed)
    } catch(e) {
        debug('Complex node exception %s', e.stack)
        path.stop()
        path.replaceWith(node)
        return null
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
