'use strict';
Error.stackTraceLimit = Infinity

const vm = require('vm')
const t = require('babel-core').types
const parse = require('babylon').parse
const generate = require('babel-generator').default
const _debug = require('debug')
const debug = _debug('mopt')
const debugErrors = _debug('mopt:errors')
const { isM, isMithrilTrust, isJsonStringify } = require('./valid')
const literalToAst = require('./literal-to-ast')

const m = require('mithril/render/hyperscript')
m.trust = require('mithril/render/trust')

let activeComplexRules

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
const INTERNAL_LITERALS = { // babel/babylon has more literals than this...
    StringLiteral: (i) => `"__DODGY_MOPT_REPLACE_StringLiteral_${i}__"`,
    NumericLiteral: (i) => String(i).repeat(2) + String( Math.floor(Math.random() * 1e5) ), // Dodgy...
}

const SURROUNDING_REGEXP = /(^{|}$)/g

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
                const base = `"${INTERNAL_ATTRS_KEY}":"__DODGY_MOPT_REPLACE_ATTRS_${replacementId++}__"`
                const key = `{${base}}` // extra {} to make a full obj
                const completeRegex = new RegExp(key)
                const partialRegex = new RegExp(base)
                matches = matches.concat({ key, completeRegex, partialRegex, type: 'attributeIdentifiers', original: generate(path.node).code })
                path.replaceWithSourceString(key)
                debug('replaced object with %s', key)
            }
        },
        transform: function attributeIdentifiers(processed) {
            const objMatches = matches.filter( ({ type }) => type === 'attributeIdentifiers')
            if(objMatches.length !== 0) {
                const replaced = objMatches.reduce( (str, { completeRegex, partialRegex, original }) => completeRegex.test(str)
                    ? str.replace(completeRegex, original) // we're the while object `{"fakeKey":"fakeVal"}`
                    : str.replace(partialRegex, original.replace(SURROUNDING_REGEXP, '')) // we're only part of the object `{"fakeKey":"fakeVal", x: y, ...}`
                , processed)
                return replaced
            }
        },
    }, {
        visitor: {
            ConditionalExpression: function(path) {
                const type1 = path.node.consequent.type
                const type2 = path.node.alternate.type
                const replacementTmpl = INTERNAL_LITERALS[type1]
                if(type1 === type2 && replacementTmpl) {
                    debug('replace conditional %s', type1)
                    const key = replacementTmpl(replacementId++)
                    matches = matches.concat({ key, type: 'conditionalExpression', original: generate(path.node).code })
                    path.replaceWithSourceString( key )
                }
            }
        },
        transform: function conditionalExpression(processed) {
            const condMatches = matches.filter( ({ type }) => type === 'conditionalExpression')
            if(condMatches.length !== 0) {
                const replaced = condMatches.reduce( (str, { key, original }) => str.replace(key, original), processed)
                return replaced
            }
        }
    }
]

const UPPERCASE_REGEX = /[A-Z]/

function componentVisitor(path) {
    const tag = path.node.arguments[0]
    if(t.isIdentifier(tag) && UPPERCASE_REGEX.test(tag.name[0])) {
        const key = `{"view":"DODGY_MOPT_REPLACE_COMPONENT_${replacementId++}__"}`
        matches = matches.concat({ key, type: 'component', original: tag.name })
        path.replaceWith(t.callExpression(path.node.callee, [ t.identifier(key) ].concat(path.node.arguments.slice(1))))
    }
}
function componentReplacer(processed) {
    const componentMatches = matches.filter( ({ type }) => type === 'component')
    if(componentMatches.length !== 0) {
        const replaced = componentMatches.reduce( (str, { key, original }) => str.replace(key, original), processed)
        return replaced
    }
    return processed
}

function tryToHandleComplex(path) {
    debug('processing complex rules')
    const node = JSON.parse(JSON.stringify(path.node))
    matches = []
    componentVisitor(path) // TODO unclean...
    activeComplexRules.forEach( ({ visitor }) => path.traverse(visitor) )
    try {
        const processed = JSON.stringify(process(generate(path.node).code), (_, v) => v === void 0 ? DODGY_MOPT_REPLACE : v).replace(UNDEFINED_REGEX, 'undefined')
        return activeComplexRules.reduce( (code, { transform }) => {
            const updatedCode = transform(code)
            if(updatedCode && updatedCode !== code) {
                path.replaceWithSourceString(`(${updatedCode})`)
                return updatedCode
            }
            return code
        }, componentReplacer(processed))
    } catch(e) {
        debugErrors('Complex node exception (ignoring) %s', e.stack)
        node.moptProcessed = true // TODO there's probably a more proper way to do this
        path.replaceWith(node)
        return null
    }
}

function tryAndReplace(path, processed) {
    const { code } = generate(literalToAst(processed))
    debug(`replacing node with (${code})`)
    path.replaceWithSourceString( code )
}

const visitor = {
    CallExpression: function(path) {
        if(path.node.moptProcessed) return
        if(shouldProcess(path.node)) {
            const { code } = generate(path.node)
            try {
                tryAndReplace(path, process(code))
            } catch(e) {
                const result = tryToHandleComplex(path)
                if(result) {
                    debug(`replacing node with (${result})`)
                    path.replaceWithSourceString(`(${result})`)
                } else {
                    debugErrors('Failed to process node %j because of error %s', e.stack)
                }
            }
        }
        return
    }
}

module.exports = function() {
    activeComplexRules = COMPLEX_RULES
    return {
        visitor
    }
}
