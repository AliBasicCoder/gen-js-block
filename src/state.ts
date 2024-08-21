// @ts-nocheck
import astring, { GENERATOR, EXPRESSIONS_PRECEDENCE } from "astring";

export class State {
  value: string[];
  isTemplate: number[];
  generator: astring.Generator;
  forceIsTemplate: boolean;

  constructor(options: any) {
    const setup = options == null ? {} : options;
    this.value = [];
    this.isTemplate = [];
    this.forceIsTemplate = false;
    this.generator = setup.generator != null ? setup.generator : GENERATOR;
    this.expressionsPrecedence =
      setup.expressionsPrecedence != null
        ? setup.expressionsPrecedence
        : EXPRESSIONS_PRECEDENCE;
    // Formating setup
    this.indent = setup.indent != null ? setup.indent : "  ";
    this.lineEnd = setup.lineEnd != null ? setup.lineEnd : "\n";
    this.indentLevel =
      setup.startingIndentLevel != null ? setup.startingIndentLevel : 0;
    this.writeComments = setup.comments ? setup.comments : false;
    // // Source map
    // if (setup.sourceMap != null) {
    //   this.write =
    //     setup.output == null ? this.writeAndMap : this.writeToStreamAndMap
    //   this.sourceMap = setup.sourceMap
    //   this.line = 1
    //   this.column = 0
    //   this.lineEndSize = this.lineEnd.split('\n').length - 1
    //   this.mapping = {
    //     original: null,
    //     // Uses the entire state to avoid generating ephemeral objects
    //     generated: this,
    //     name: undefined,
    //     source: setup.sourceMap.file || setup.sourceMap._file,
    //   }
    // }
  }

  write(code: string, isTemplate = false) {
    this.value.push(code);
    this.isTemplate.push(
      this.forceIsTemplate ||
        (typeof isTemplate === "boolean" ? isTemplate : false)
    );
  }

  toString() {
    let result = "";
    let start = 0;
    for (let i = 0; i < this.value.length; i++) {
      if (this.isTemplate[i]) {
        if (start !== i)
          result += `result += ${JSON.stringify(
            this.value.slice(start, i).join("")
          )};`;
        result += this.value[i];
        start = i + 1;
        continue;
      }
    }
    if (start < this.value.length) {
      result += `result += ${JSON.stringify(
        this.value.slice(start).join("")
      )};`;
    }
    return result;
  }
}

export function formatVariableDeclaration(state, node) {
  /*
  Writes into `state` a variable declaration.
  */
  const { generator } = state;
  const { declarations } = node;
  state.write(node.kind + " ");
  const { length } = declarations;
  if (length > 0) {
    generator.VariableDeclarator(declarations[0], state);
    for (let i = 1; i < length; i++) {
      state.write(", ");
      generator.VariableDeclarator(declarations[i], state);
    }
  }
}

// rest of this file is copied from https://github.com/davidbonnet/astring/blob/main/src/astring.js
const OPERATOR_PRECEDENCE = {
  "||": 2,
  "??": 3,
  "&&": 4,
  "|": 5,
  "^": 6,
  "&": 7,
  "==": 8,
  "!=": 8,
  "===": 8,
  "!==": 8,
  "<": 9,
  ">": 9,
  "<=": 9,
  ">=": 9,
  in: 9,
  instanceof: 9,
  "<<": 10,
  ">>": 10,
  ">>>": 10,
  "+": 11,
  "-": 11,
  "*": 12,
  "%": 12,
  "/": 12,
  "**": 13,
};

// Enables parenthesis regardless of precedence
export const NEEDS_PARENTHESES = 17;

function expressionNeedsParenthesis(state, node, parentNode, isRightHand) {
  const nodePrecedence = state.expressionsPrecedence[node.type];
  if (nodePrecedence === NEEDS_PARENTHESES) {
    return true;
  }
  const parentNodePrecedence = state.expressionsPrecedence[parentNode.type];
  if (nodePrecedence !== parentNodePrecedence) {
    // Different node types
    return (
      (!isRightHand &&
        nodePrecedence === 15 &&
        parentNodePrecedence === 14 &&
        parentNode.operator === "**") ||
      nodePrecedence < parentNodePrecedence
    );
  }
  if (nodePrecedence !== 13 && nodePrecedence !== 14) {
    // Not a `LogicalExpression` or `BinaryExpression`
    return false;
  }
  if (node.operator === "**" && parentNode.operator === "**") {
    // Exponentiation operator has right-to-left associativity
    return !isRightHand;
  }
  if (
    nodePrecedence === 13 &&
    parentNodePrecedence === 13 &&
    (node.operator === "??" || parentNode.operator === "??")
  ) {
    // Nullish coalescing and boolean operators cannot be combined
    return true;
  }
  if (isRightHand) {
    // Parenthesis are used if both operators have the same precedence
    return (
      OPERATOR_PRECEDENCE[node.operator] <=
      OPERATOR_PRECEDENCE[parentNode.operator]
    );
  }
  return (
    OPERATOR_PRECEDENCE[node.operator] <
    OPERATOR_PRECEDENCE[parentNode.operator]
  );
}

export function formatExpression(
  state,
  node,
  parentNode,
  isRightHand?: boolean
) {
  /*
  Writes into `state` the provided `node`, adding parenthesis around if the provided `parentNode` needs it. If `node` is a right-hand argument, the provided `isRightHand` parameter should be `true`.
  */
  const { generator } = state;
  if (expressionNeedsParenthesis(state, node, parentNode, isRightHand)) {
    state.write("(");
    generator[node.type](node, state);
    state.write(")");
  } else {
    generator[node.type](node, state);
  }
}
