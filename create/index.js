const Generator = require('yeoman-generator');
const ts = require('typescript');

const createTransformer = (pkg) => (context) => (rootNode) => {
  function visit(node) {
    node = ts.visitEachChild(node, visit, context);
    const type = ts.SyntaxKind[node.kind];

    if (type !== 'VariableDeclaration') {
      return node;
    }

    const text = node.name.escapedText;

    if (text !== 'corePackages') {
      return node;
    }

    const arr = node.initializer.expression;
    const exprType = ts.SyntaxKind[arr.kind];

    if (exprType !== 'ArrayLiteralExpression') {
      return node;
    }

    const n = ts.createCall(
      ts.createIdentifier('require'),
      [],
      [ts.createLiteral(pkg)],
    );
    node.initializer.expression.elements.push(n);
    return node;
  }

  return ts.visitNode(rootNode, visit);
};

class Create extends Generator {
  constructor(args, opts) {
    super(args, opts);
  }

  prompting() {
    const parentConfig = this.config.getAll();
    const namespace = parentConfig.promptValues.namespace;

    return this.prompt([
      {
        type: 'input',
        name: 'namespace',
        message: 'Your project namespace',
        default: namespace,
      },
      {
        type: 'input',
        name: 'packageName',
        message: 'Your package name',
      },
      {
        type: 'boolean',
        name: 'cofxExample',
        message: 'Do you want an example with cofx of a package?',
        default: false,
      },
      {
        when: (response) => !response.cofxExample,
        type: 'boolean',
        name: 'simple',
        message: 'Do you want a simple version of a package? (index file only)',
        default: false,
      },
      {
        when: (response) => !response.simple && !response.cofxExample,
        type: 'checkbox',
        name: 'submodules',
        message: 'What submodules do you want included in this package?',
        choices: ['actions', 'reducers'],
        store: true,
      },
    ]).then((answers) => {
      this.options.namespace = answers.namespace;
      this.options.packageName = answers.packageName;
      this.options.submodules = answers.submodules;
      this.options.simple = answers.simple;
      this.options.cofxExample = answers.cofxExample;
    });
  }

  writing() {
    const { simple, cofxExample } = this.options;
    if (cofxExample) {
      this._write_cofx();
      this._update_packages();
      return;
    }

    if (simple) {
      this._write_simple();
      this._update_packages();
      return;
    }

    this._write_complex();
    this._update_packages();
  }

  _update_packages() {
    const { namespace, packageName } = this.options;
    this.fs.copy(
      this.destinationPath(`packages/web-app/packages.ts`),
      this.destinationPath(`packages/web-app/packages.ts`),
      {
        process: (content) => {
          const sourceFile = ts.createSourceFile(
            'tmp.ts',
            content.toString(),
            ts.ScriptTarget.ES2015,
            true,
            ts.ScriptKind.TS,
          );
          const results = ts.transform(sourceFile, [
            createTransformer(`${namespace}/${packageName}`),
          ]);
          return ts.createPrinter().printFile(results.transformed[0]);
        },
      },
    );
  }

  _write_simple() {
    const { packageName } = this.options;
    this.fs.copyTpl(
      this.templatePath('simple.ts'),
      this.destinationPath(`packages/${packageName}/index.ts`),
    );
  }

  _write_cofx() {
    const { packageName, namespace } = this.options;
    const vars = { namespace };
    const files = ['slice.ts', 'effects.ts'];
    const indexExport = ['actions', 'reducers', 'selectors', 'effects'];
    const indexFile = [
      "import { actions, reducers, selectors } from './slice';",
      "import { effects } from './effects';",
      `export { ${indexExport.join(', ')} };`,
    ];

    this.fs.write(`packages/${packageName}/index.ts`, indexFile.join('\n'));

    files.forEach((file) => {
      this.fs.copyTpl(
        this.templatePath(`cofx/${file}`),
        this.destinationPath(`packages/${packageName}/${file}`),
        vars,
      );
    });
  }

  _write_complex() {
    const { packageName, submodules } = this.options;
    const files = [];
    const indexFile = [];
    const indexExport = [];

    if (submodules.indexOf('actions') >= 0) {
      indexFile.push(
        "import * as actionTypes from './action-types';",
        "import * as actionCreators from './action-creators';",
      );

      indexExport.push('actionTypes', 'actionCreators');

      files.push('action-types.ts', 'action-creators.ts');
    }

    if (submodules.indexOf('reducers') >= 0) {
      indexFile.push(
        "import reducers from './reducers';",
        "import * as selectors from './selectors';",
      );

      indexExport.push('reducers', 'selectors');

      files.push('reducers.ts', 'selectors.ts');
    }

    indexFile.push(`export { ${indexExport.join(', ')} };`);

    this.fs.write(`packages/${packageName}/index.ts`, indexFile.join('\n'));
    files.forEach((file) => {
      this.fs.write(`packages/${packageName}/${file}`, '// export here\n');
    });
  }
}

module.exports = Create;
