'use strict';
Error.stackTraceLimit = Infinity

const vm = require('vm')
const t = require('babel-core').types
const parse = require('babylon').parse
const generate = require('babel-generator').default
const debug = require('debug')('mopt')
const { isM, isMithrilTrust } = require('./valid')

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

const visitor = {
    CallExpression: function(path) {
        if(shouldProcess(path.node)) {
            const { code } = generate(path.node)
            try {
                const replaced = JSON.stringify(process(code), (_, v) => v === void 0 ? DODGY_MOPT_REPLACE : v).replace(UNDEFINED_REGEX, 'undefined')
                console.log(replaced)
                path.replaceWithSourceString(`(${replaced})`)
            } catch(e) {
                debug('Failed to process node %j because of error %s', e.stack)
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
