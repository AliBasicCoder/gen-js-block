import acorn, {
  ArrowFunctionExpression,
  Expression,
  ExpressionStatement,
  FunctionExpression,
  MemberExpression,
  Node,
  Statement,
} from "acorn";
import astring, { GENERATOR, generate } from "astring";
import { State, formatVariableDeclaration } from "./state";
import { traverse } from "estraverse";

function getIdentifier(ast: Node) {
  const result: string[] = [];
  traverse(
    // @ts-ignore
    ast,
    {
      enter(node) {
        if (node.type === "Identifier") {
          result.push(node.name);
        }
      },
    }
  );

  return result;
}

function isTemplateCond(node: Node) {
  const identifiers = getIdentifier(node);
  return (
    identifiers.findIndex((name) => !name.startsWith("$")) === -1 &&
    identifiers.length > 0
  );
}

function getFirstExpression(expression: MemberExpression) {
  let object = expression;

  while (true) {
    if (object.object.type === "MemberExpression") object = object.object;
    else {
      return object.object;
    }
  }
}

// TODO template c-style for loops
// TODO check for undefined template variables
// TODO define template variables in block
// TODO maybe template switch statements?
function main(
  program: Statement | Expression,
  templateVariables: string[],
  inlineVariables: string[] | boolean
) {
  const tempVars = new Set(templateVariables);
  const toInline = new Set(
    typeof inlineVariables === "boolean"
      ? inlineVariables
        ? templateVariables
        : []
      : inlineVariables
  );

  function ForOfStatement(node: any, state: any) {
    const isTempCond = isTemplateCond(node.right);
    if (isTempCond) {
      state.write(`for ${node.await ? "await " : ""}(`, true);
      state.forceIsTemplate = true;
      let newVariables = [] as string[];
      if (node.left.type[0] === "V") {
        newVariables = getIdentifier(node.left);
        if (newVariables.findIndex((name) => !name.startsWith("$")) !== -1) {
          throw new Error(
            `all template variables must start with $ (variables: ${generate(
              node.left
            )})`
          );
        }
        formatVariableDeclaration(state, node.left);
      } else {
        // @ts-ignore
        this[node.left.type](node.left, state);
      }
      state.write(node.type === "ForInStatement" ? " in " : " of ", true);
      // @ts-ignore
      this[node.right.type](node.right, state);
      state.write(") {", true);
      state.forceIsTemplate = false;
      state.write("{", false);
      newVariables.forEach((item) => tempVars.add(item));
      if (inlineVariables && typeof inlineVariables === "boolean")
        newVariables.forEach((item) => toInline.add(item));
      for (const name of newVariables) {
        if (toInline.has(name)) continue;
        state.write(`let ${name} = `, false);
        state.write(`result += __inline(${name});`, true);
        state.write(";", false);
      }
      // @ts-ignore
      this[node.body.type](node.body, state);
      newVariables.forEach((item) => tempVars.delete(item));
      if (inlineVariables && typeof inlineVariables === "boolean")
        newVariables.forEach((item) => toInline.delete(item));

      state.write("};", false);
      state.write("};", true);
    } else {
      // @ts-ignore
      GENERATOR[node.type](node, state);
    }
  }

  const customGenerator = Object.assign({}, GENERATOR, {
    IfStatement(node: any, state: any, shouldBeTempCond?: boolean) {
      const isTempCond = isTemplateCond(node.test);
      if (shouldBeTempCond && !isTempCond) {
        throw new Error(
          `else if statement on a template if statements should be template conditions (condition: ${generate(
            node.test
          )})`
        );
      }
      if (isTempCond) {
        state.write("if (", true);
        state.forceIsTemplate = true;
        // @ts-ignore
        this[node.test.type](node.test, state);
        state.write(") {", true);
        state.forceIsTemplate = false;
        // @ts-ignore
        this[node.consequent.type](node.consequent, state);
        state.write("}", true);
        if (node.alternate != null) {
          state.write(" else {", true);
          // @ts-ignore
          this[node.alternate.type](node.alternate, state, true);
          state.write("};", true);
        }
      } else {
        // @ts-ignore
        GENERATOR[node.type](node, state);
      }
    },
    ContinueStatement(node: any, state: any) {
      if (
        node.label &&
        node.label.type === "Identifier" &&
        node.label.name.startsWith("$")
      ) {
        state.write(`continue ${node.label.name};`, true);
      } else {
        // @ts-ignore
        GENERATOR[node.type](node, state);
      }
    },
    BreakStatement(node: any, state: any) {
      if (
        node.label &&
        node.label.type === "Identifier" &&
        node.label.name.startsWith("$")
      ) {
        state.write(`break ${node.label.name};`, true);
      } else {
        // @ts-ignore
        GENERATOR[node.type](node, state);
      }
    },
    LabeledStatement(node: any, state: any) {
      if (node.label.type === "Identifier" && node.label.name.startsWith("$")) {
        if (
          !(
            node.body.type === "ForOfStatement" ||
            node.body.type === "ForInStatement"
          ) ||
          !isTemplateCond(node.body.right)
        ) {
          throw new Error(
            `expect labeled statement "${node.label.name}" to be a template for-of or for-in`
          );
        }
        state.write(`${node.label.name}: `, true);
        // @ts-ignore
        this[node.body.type](node.body, state);
      } else {
        // @ts-ignore
        GENERATOR[node.type](node, state);
      }
    },
    CallExpression(node: any, state: any) {
      if (
        node.callee.type === "Identifier" &&
        node.callee.name.startsWith("$") &&
        tempVars.has(node.callee.name)
      ) {
        state.forceIsTemplate = true;
        state.write(`result += `, true);
        // @ts-ignore
        GENERATOR[node.type](node, state);
        state.write(`;`, true);
        state.forceIsTemplate = false;
      } else {
        // @ts-ignore
        GENERATOR[node.type](node, state);
      }
    },
    MemberExpression(node: any, state: any) {
      const firstExpr = getFirstExpression(node);
      if (
        firstExpr.type === "Identifier" &&
        firstExpr.name.startsWith("$") &&
        toInline.has(firstExpr.name)
      ) {
        state.write(`result += __inline(`, true);
        state.forceIsTemplate = true;
        // @ts-ignore
        GENERATOR[node.type](node, state);
        state.forceIsTemplate = false;
        state.write(`);`, true);
      } else {
        // @ts-ignore
        GENERATOR[node.type](node, state);
      }
    },
    Identifier(node: any, state: any) {
      if (
        node.name.startsWith("$") &&
        toInline.has(node.name) &&
        !state.forceIsTemplate
      ) {
        state.write(`result += __inline(${node.name});`, true);
      } else {
        // @ts-ignore
        GENERATOR[node.type](node, state);
      }
    },
    ForOfStatement,
    ForInStatement: ForOfStatement,
  });

  const state = new State({
    generator: customGenerator,
    indent: "",
    lineEnd: "",
  });

  // @ts-ignore
  state.generator.Program(program, state);
  return (
    templateVariables
      .filter((item) => !toInline.has(item))
      .map(
        (item) =>
          'result += "const ' +
          item +
          ' = " + ' +
          "__inline(" +
          item +
          ') + ";";'
      )
      .join("") + state.toString()
  );
}

type BlockOptions = { inlineVariables: string[] | boolean };

const DEFAULT_OPTIONS: BlockOptions = { inlineVariables: false };

const REPLACE = Symbol("js-gen-block");

export const insertCode = (code: string) => ({ [REPLACE]: code });

export class Block<T> {
  _builder: (obj: any) => string;

  constructor(
    public fn: Function,
    options?: Partial<BlockOptions>,
    logCode?: boolean
  ) {
    const ops = Object.assign({}, DEFAULT_OPTIONS, options);

    const parsed = acorn.parse(`(${fn.toString()});`, {
      ecmaVersion: "latest",
    });
    const fnExpression = (parsed.body[0] as ExpressionStatement).expression as
      | FunctionExpression
      | ArrowFunctionExpression;
    const templateVariables: string[] = [];
    for (const arg of fnExpression.params) {
      if (arg.type !== "Identifier")
        throw new Error(
          "Function has non-identifier params (like spread params)"
        );
      if (arg.name.startsWith("$")) templateVariables.push(arg.name);
    }

    const code = `function build(__object) {
      const __inline = (value) => typeof value === "object" && !!value && REPLACE in value ? value[REPLACE] : value instanceof Date ? 'new Date("' + value.toString() + '")' : JSON.stringify(value);
      let result = "";
      const { ${templateVariables.join(", ")} } = __object;
      ${main(fnExpression.body, templateVariables, ops.inlineVariables)}
      return result;
    }; build`;
    if (logCode) console.log(code);
    this._builder = eval(code);
  }

  build(object: T) {
    return this._builder(object);
  }

  eval(object: T) {
    return eval(this._builder(object));
  }
}
