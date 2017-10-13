'use strict';
Error.stackTraceLimit = Infinity

const vm = require('vm')
const t = require('babel-core').types
const parse = require('babylon').parse
const babelGenerate = require('babel-generator').default
const _debug = require('debug')
const debug = _debug('mopt')
const debugErrors = _debug('mopt:errors')
const { isM, isMithrilTrust, isJsonStringify, isObjectAssign } = require('./valid')
const literalToAst = require('./literal-to-ast')

const m = require('mithril/render/hyperscript')
m.trust = require('mithril/render/trust')

let activeComplexRules, activeTopLevelComplexRules

const DODGY_MOPT = /__DODGY_MOPT/
const DODGY_MOPT_REPLACE = '__DODGY_MOPT_REPLACE__'

const UNDEFINED_REGEX = new RegExp(`"${DODGY_MOPT_REPLACE}"`, 'g')

function generate(code) {
    return babelGenerate(code, { compact: true }) // makes it easier to match
}

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
                if(path.node.properties && path.node.properties.length > 0 && path.node.properties[0].key && path.node.properties[0].key.value === INTERNAL_ATTRS_KEY) {
                    debug('already processed object attrs')
                    return
                }
                const base = `"${INTERNAL_ATTRS_KEY}":"__DODGY_MOPT_REPLACE_ATTRS_${replacementId}__","key":"__DODGY_MOPT_REPLACE_KEY_${replacementId}__"`
                const key = `{${base}}` // extra {} to make a full obj
                const baseRegex = base.replace(':', ': *')
                const completeRegex = new RegExp(`{${baseRegex}}`)
                const partialRegex = new RegExp(baseRegex)
                const mKeyNode = path.node.properties.find( (n) => n.type === 'ObjectProperty' && n.key.name === 'key')
                matches = matches.concat({
                    key
                    , completeRegex
                    , partialRegex
                    , type: 'attributeIdentifiers'
                    , original: generate(path.node).code
                    , mKeyOriginal: mKeyNode ? generate(mKeyNode.value).code : 'undefined'
                    , mKeyRegex: new RegExp(`"__DODGY_MOPT_REPLACE_KEY_${replacementId}__"`)
                })
                path.replaceWithSourceString(key)
                replacementId++
                debug('replaced object with %s', key)
            }
        },
        transform: function attributeIdentifiers(processed) {
            const objMatches = matches.filter( ({ type }) => type === 'attributeIdentifiers')
            if(objMatches.length !== 0) {
                const replaced = objMatches.reduce( (str, { completeRegex, partialRegex, original, mKeyOriginal, mKeyRegex }) => completeRegex.test(str)
                    ? str.replace(completeRegex, original).replace(mKeyRegex, mKeyOriginal) // we're the while object `{"fakeKey":"fakeVal"}`
                    : str.replace(partialRegex, original.replace(SURROUNDING_REGEXP, '')).replace(mKeyRegex, mKeyOriginal) // we're only part of the object `{"fakeKey":"fakeVal", x: y, ...}`
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

const TOP_LEVEL = [
    {
        visitor: function componentVisitor(path) {
            const tag = path.node.arguments[0]
            if(t.isIdentifier(tag) && UPPERCASE_REGEX.test(tag.name[0])) {
                const base = `"view":"DODGY_MOPT_REPLACE_COMPONENT_${replacementId++}__"`
                const key = `{${base}}`
                const regex = new RegExp(`{\\s*${base.replace(':', ': *')}\\s*}`)
                matches = matches.concat({ key, regex, type: 'component', original: tag.name })
                path.replaceWith(t.callExpression(path.node.callee, [ t.identifier(key) ].concat(path.node.arguments.slice(1))))
            }
        }
        , transform: function componentReplacer(processed) {
            const componentMatches = matches.filter( ({ type }) => type === 'component')
            if(componentMatches.length !== 0) {
                const replaced = componentMatches.reduce( (str, { regex, original }) => str.replace(regex, original), processed)
                return replaced
            }
            return processed
        }
    }
    , {
        visitor: function objAssignVisitor(path, { opts: { assignNeverComponent } }) {
            if(assignNeverComponent !== true ) return
            const tag = generate(path.node.arguments[0]).code
            const attrs = path.node.arguments[1]
            if(isObjectAssign(attrs) && t.isObjectExpression(attrs.arguments[0])) { // TODO
                debug('processing Object.assign')
                const base = `"${INTERNAL_ATTRS_KEY}":"__DODGY_MOPT_REPLACE_ATTRS_${replacementId}__","key":"__DODGY_MOPT_REPLACE_KEY_${replacementId}__"`
                const key = `{${base}}`
                const regex = new RegExp(`{\\s*${base.replace(':', ': *')}\\s*}`)
                matches = matches.concat({ key, regex, tag, base, type: 'objAssign', original: generate(attrs).code, mKeyRegex: new RegExp(`"__DODGY_MOPT_REPLACE_KEY_${replacementId}__"`) })
                path.replaceWith(t.callExpression(path.node.callee, [ path.node.arguments[0] ].concat([ t.identifier(key) ]).concat(path.node.arguments.slice(2))))
                replacementId++
            }
        }
        , transform: function objAssignReplacer(processed) {
            const objAssignMatches = matches.filter( ({ type }) => type === 'objAssign')
            if(objAssignMatches.length !== 0) {
                const replaced = objAssignMatches.reduce( (str, { tag, base, regex, original, mKeyRegex }) => {
                    let replacedAttrs = str.replace(regex, '__mopt_attrs__')
                    let attrs = original
                    if(replacedAttrs === str) {
                        attrs = str.replace(new RegExp(`^.*{\\s*${base.replace(':', ': *')},([^}]*)}.*$`), `${original.slice(0, original.length - 1)},{$1})`)
                        replacedAttrs = str.replace(new RegExp(`{\\s*${base.replace(':', ': *')},([^}]*)}`), '__mopt_attrs__')
                    }
                    const strReplace = replacedAttrs.replace(mKeyRegex, '__mopt_attrs__.key')
                    if(DODGY_MOPT.test(strReplace)) {
                        debug('Object.assign replacement failed: "%s"', strReplace)
                        throw new Error('Object.assign replacement failed.')
                    }
                    return `(function(__mopt_attrs__){return ${strReplace}})(${attrs})`
                }, processed)
                return replaced
            }
            return processed
        }
    }
]

function runPass(path, processed) {
    return activeComplexRules.reduce( (code, { transform }) => {
        const updatedCode = transform(code)
        if(updatedCode && updatedCode !== code) {
            path.replaceWithSourceString(`(${updatedCode})`)
            return updatedCode
        }
        return code
    }, activeTopLevelComplexRules.map( ({ transform }) => transform).reduce( (res, t) => t(res), processed))
}

function tryToHandleComplex(path, state) {
    const { opts: { repeatLimit = 1 } } = state
    debug('processing complex rules')
    const node = JSON.parse(JSON.stringify(path.node))
    matches = []
    activeTopLevelComplexRules.forEach( ({ visitor: func }) => func(path, state) )
    activeComplexRules.forEach( ({ visitor }) => path.traverse(visitor) )
    try {
        const processed = generate(literalToAst(process(generate(path.node).code))).code
        let iteration = 0
        let current = runPass(path, processed)
        let previous
        while(iteration++ < repeatLimit) {
            if(!DODGY_MOPT.test(current)) return current
            previous = current
            current = runPass(path, current)
            if(previous === current) return current
        }
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
    CallExpression: function(path, state) {
        if(path.node.moptProcessed) return
        if(shouldProcess(path.node)) {
            const { code } = generate(path.node)
            try {
                tryAndReplace(path, process(code))
            } catch(e) {
                const result = tryToHandleComplex(path, state)
                if(result && !DODGY_MOPT.test(result)) {
                    debug(`replacing node with (${result})`)
                    path.replaceWithSourceString(`(${result})`)
                } else {
                    debugErrors('Failed to process node %j because of error %s', e.stack)
                    path.replaceWithSourceString(code)
                    path.node.moptProcessed = true
                }
            }
        }
        return
    }
}

module.exports = function() {
    activeComplexRules = COMPLEX_RULES
    activeTopLevelComplexRules = TOP_LEVEL
    return {
        visitor
    }
}
