import acorn, {
  ArrowFunctionExpression,
  BlockStatement,
  Expression,
  ExpressionStatement,
  FunctionExpression,
  Identifier,
  Literal,
  MemberExpression,
  Node,
  PrivateIdentifier,
  Statement,
} from "acorn";
import astring, { GENERATOR, generate } from "astring";
import { State, formatVariableDeclaration } from "./state";
import { traverse, VisitorOption } from "estraverse";

function getIdentifier(ast: Node) {
  const result: string[] = [];
  traverse(
    // @ts-ignore
    ast,
    {
      enter(node) {
        if (node.type === "MemberExpression") {
          // @ts-ignore
          const expr = getFirstExpression(node);
          if (expr.type === "Identifier") result.push(expr.name);

          return VisitorOption.Skip;
        }
        if (node.type === "Identifier") {
          result.push(node.name);
        }
      },
    }
  );

  return result;
}

function isTemplateCond(node: Node, toReplace: Set<string>) {
  const identifiers = getIdentifier(node);

  return (
    identifiers.findIndex(
      (name) => !name.startsWith("$") || toReplace.has(name)
    ) === -1 && identifiers.length > 0
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

function removeFirstMemberExpression(ast: MemberExpression): MemberExpression {
  if (ast.object.type !== "MemberExpression") {
    (ast.object as Identifier).name = "";
    return ast;
  } else {
    let current = ast.object;

    while (current.object && current.object.type === "MemberExpression") {
      current = current.object;
    }

    (current.object as Identifier).name = "";

    return ast;
  }
}

// TODO only allow insertCode to be used with replace vars
// TODO template c-style for loops
// TODO check for undefined template variables
// TODO define template variables in block
// TODO maybe template switch statements?
function main(
  program: Statement | Expression,
  templateVariables: Set<string>,
  inlineVariables: Set<string>,
  replaceVariables: Set<string>,
  // TODO find a way to get rid of this - should not inline new vars unless user says
  inlineNewVars: boolean
) {
  // const templateVariables = new Set(templateVariables);
  // const inlineVariables = new Set([...inlineVariables, ...replaceVariables]);
  // const replaceVariables = new Set(replaceVariables);

  let ForOfStatement: Function;

  const customGenerator = Object.assign({}, GENERATOR, {
    OIfStatement: GENERATOR.IfStatement,
    IfStatement(node: any, state: any, shouldBeTempCond?: boolean) {
      const isTempCond = isTemplateCond(node.test, replaceVariables);
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
        this.OIfStatement(node, state);
      }
    },
    OContinueStatement: GENERATOR.ContinueStatement,
    ContinueStatement(node: any, state: any) {
      if (
        node.label &&
        node.label.type === "Identifier" &&
        node.label.name.startsWith("$")
      ) {
        state.write(`continue ${node.label.name};`, true);
      } else {
        this.OContinueStatement(node, state);
      }
    },
    OBreakStatement: GENERATOR.BreakStatement,
    BreakStatement(node: any, state: any) {
      if (
        node.label &&
        node.label.type === "Identifier" &&
        node.label.name.startsWith("$")
      ) {
        state.write(`break ${node.label.name};`, true);
      } else {
        this.OBreakStatement(node, state);
      }
    },
    OLabeledStatement: GENERATOR.LabeledStatement,
    LabeledStatement(node: any, state: any) {
      if (node.label.type === "Identifier" && node.label.name.startsWith("$")) {
        if (
          !(
            node.body.type === "ForOfStatement" ||
            node.body.type === "ForInStatement"
          ) ||
          !isTemplateCond(node.body.right, replaceVariables)
        ) {
          throw new Error(
            `expect labeled statement "${node.label.name}" to be a template for-of or for-in`
          );
        }
        state.write(`${node.label.name}: `, true);
        // @ts-ignore
        this[node.body.type](node.body, state);
      } else {
        this.OLabeledStatement(node, state);
      }
    },
    OCallExpression: GENERATOR.CallExpression,
    CallExpression(node: any, state: any) {
      if (
        node.callee.type === "Identifier" &&
        node.callee.name.startsWith("$") &&
        templateVariables.has(node.callee.name)
      ) {
        state.forceIsTemplate = true;
        state.write(`result += `, true);
        this.OCallExpression(node, state);
        state.write(`;`, true);
        state.forceIsTemplate = false;
      } else if (isTemplateCond(node, replaceVariables)) {
        state.forceIsTemplate = true;
        state.write(`result += __inline(`, true);
        this.OCallExpression(node, state);
        state.write(`);`, true);
        state.forceIsTemplate = false;
      } else {
        this.OCallExpression(node, state);
      }
    },
    OMemberExpression: GENERATOR.MemberExpression,
    MemberExpression(node: any, state: any) {
      const firstExpr = getFirstExpression(node);
      if (
        firstExpr.type === "Identifier" &&
        firstExpr.name.startsWith("$") &&
        !state.forceIsTemplate
      ) {
        if (replaceVariables.has(firstExpr.name)) {
          state.write(`result += __inline(`, true);
          state.forceIsTemplate = true;
          // @ts-ignore
          GENERATOR[firstExpr.type](firstExpr, state);
          state.forceIsTemplate = false;
          state.write(`);`, true);
          const rest = removeFirstMemberExpression(node);
          this[rest.type](rest, state);
        } else if (inlineVariables.has(firstExpr.name)) {
          state.write(`result += __inline(`, true);
          state.forceIsTemplate = true;
          // @ts-ignore
          GENERATOR[node.type](node, state);
          state.forceIsTemplate = false;
          state.write(`);`, true);
        }
      } else {
        // @ts-ignore
        this.OMemberExpression(node, state);
      }
    },
    Identifier(node: any, state: any) {
      if (
        node.name.startsWith("$") &&
        inlineVariables.has(node.name) &&
        !state.forceIsTemplate
      ) {
        state.write(`result += __inline(${node.name});`, true);
      } else {
        // @ts-ignore
        GENERATOR[node.type](node, state);
      }
    },
    OForOfStatement: GENERATOR.ForOfStatement,
    ForOfStatement: (ForOfStatement = function (node: any, state: any) {
      const isTempCond = isTemplateCond(node.right, replaceVariables);
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
        newVariables.forEach((item) => templateVariables.add(item));
        if (inlineNewVars)
          newVariables.forEach((item) => inlineVariables.add(item));
        for (const name of newVariables) {
          if (inlineVariables.has(name)) continue;
          state.write(`let ${name} = `, false);
          state.write(`result += __inline(${name});`, true);
          state.write(";", false);
        }
        // @ts-ignore
        this[node.body.type](node.body, state);
        newVariables.forEach((item) => templateVariables.delete(item));
        if (inlineNewVars)
          newVariables.forEach((item) => inlineVariables.delete(item));

        state.write("};", false);
        state.write("};", true);
      } else {
        // @ts-ignore
        this.OForOfStatement(node, state);
      }
    }),
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
    Array.from(templateVariables)
      .filter((item) => !inlineVariables.has(item))
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

type BlockOptions = { inlineVariables: string[] | boolean; replace: string[] };

const DEFAULT_OPTIONS: BlockOptions = { inlineVariables: false, replace: [] };

const REPLACE = Symbol("js-gen-block");

export const insertCode = (code: string) => ({ [REPLACE]: code });

export class Block<T = {}> {
  _builder: ((obj: any) => string) | null = null;
  templateVariables: Set<string> = new Set();
  inlineVariables: Set<string> = new Set();
  replaceVariables: Set<string> = new Set();
  functionBody: BlockStatement =
    // @ts-ignore
    { type: "BlockStatement", body: [] } as BlockStatement;
  constructor(
    fn: Function | null,
    options?: Partial<BlockOptions> & { skipBuild?: boolean }
  ) {
    if (fn == null) return;

    const ops = Object.assign({}, DEFAULT_OPTIONS, options);

    const parsed = acorn.parse(`(${fn.toString()});`, {
      ecmaVersion: "latest",
    });
    const fnExpression = (parsed.body[0] as ExpressionStatement).expression as
      | FunctionExpression
      | ArrowFunctionExpression;

    for (const arg of fnExpression.params) {
      if (arg.type !== "Identifier")
        throw new Error(
          "Function has non-identifier params (like spread params)"
        );
      if (arg.name.startsWith("$")) this.templateVariables.add(arg.name);
    }

    this.functionBody =
      fnExpression.body.type !== "BlockStatement"
        ? ({
            type: "BlockStatement",
            body: [
              { type: "ExpressionStatement", expression: fnExpression.body },
            ],
          } as BlockStatement)
        : fnExpression.body;
    this.inlineVariables = new Set([
      ...(typeof ops.inlineVariables === "boolean"
        ? ops.inlineVariables
          ? [...this.templateVariables]
          : []
        : ops.inlineVariables),
      ...ops.replace,
    ]);
    this.replaceVariables = new Set(ops.replace);

    if (!ops.skipBuild) this.createBuilder();
  }

  createBuilder() {
    const code = `function build(__object) {
      const __inline = (value) => typeof value === "object" && !!value && REPLACE in value ? value[REPLACE] : value instanceof Date ? 'new Date("' + value.toString() + '")' : JSON.stringify(value);
      let result = "";
      const { ${Array.from(this.templateVariables).join(", ")} } = __object;
      ${main(
        this.functionBody,
        this.templateVariables,
        this.inlineVariables,
        this.replaceVariables,
        true
      )}
      return result;
    }; build`;

    this._builder = eval(code);
  }

  join<J>(block: Block<J>, skipRebuild = false): Block<T & J> {
    const newBlock = new Block(null);
    newBlock.functionBody.body.push(...this.functionBody.body);
    newBlock.functionBody.body.push(...block.functionBody.body);

    newBlock.templateVariables = new Set([
      ...this.templateVariables,
      ...block.templateVariables,
    ]);
    newBlock.inlineVariables = new Set([
      ...this.inlineVariables,
      ...block.inlineVariables,
    ]);
    newBlock.replaceVariables = new Set([
      ...this.replaceVariables,
      ...block.replaceVariables,
    ]);

    if (!skipRebuild) newBlock.createBuilder();
    // @ts-ignore
    return newBlock;
  }

  build(object: T): string {
    if (!this._builder) this.createBuilder();
    return this._builder!(object);
  }

  eval(object: T): any {
    if (!this._builder) this.createBuilder();
    return eval(this._builder!(object));
  }
}
