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
