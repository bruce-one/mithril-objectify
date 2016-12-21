// borrowed from babel-literal-to-ast, but with undefined values included in objects

const t = require('babel-core').types
const parse = require('babylon').parse
const traverse = require('babel-traverse')

module.exports = function astify(literal) {
  if (literal === null) {
    return t.nullLiteral()
  }
  switch (typeof literal) {
  case 'function':
    const ast = parse(literal.toString(), {
      allowReturnOutsideFunction: true,
      allowSuperOutsideMethod: true,
    })
    return traverse.removeProperties(ast)
  case 'number':
    return t.numericLiteral(literal)
  case 'string':
    return t.stringLiteral(literal)
  case 'boolean':
    return t.booleanLiteral(literal)
  case 'undefined':
    return t.identifier('undefined')
  default:
    if (Array.isArray(literal)) {
      return t.arrayExpression(literal.map(astify))
    }
    return t.objectExpression(Object.keys(literal)
      .map(k => {
        return t.objectProperty(
          t.stringLiteral(k),
          astify(literal[k])
        )
      }))
  }
}
