'use strict';
const glob = require('glob');
const path = require('path');

function transform(reservedNames = []) {
  return class {
    constructor(options) {
      this.syntax = null;
      this.options = options;
      this.reservedNames = reservedNames;
      this.locals = [];
    }

    notLocal(name) {
      return this.locals.indexOf(name) === -1;
    }

    transform(ast) {
      const b = this.syntax.builders;
      this.syntax.traverse(ast, {
        BlockStatement: {
          enter: (node) => {
            this.locals = this.locals.concat(node.program.blockParams);
          },
          exit: (node) => {
            this.locals = this.locals.filter((local) => {
              return node.program.blockParams.indexOf(local) > -1;
            });
          }
        },
        MustacheStatement: {
          enter: (node) => {
            if (node.params.length === 0 &&
              node.hash.pairs.length === 0 &&
              this.notLocal(node.path.parts[0]) &&
              this.reservedNames.indexOf(node.path.parts[0]) === -1) {
                console.log(`transforming: {{${node.path.parts.join('.')}}} -> {{this.${node.path.parts.join('.')}}}`)
              node.path = b.path(`this.${node.path.parts.join('.')}`)
            }
          }
        }
      });
    }
  }
}

module.exports = {
  name: 'rfc-308-migrator',

  _reservedPaths(_path, ext) {
    return glob.sync(`${_path}/*.${ext}`).map(item => path.basename(item).replace(`.${ext}`, ''))
  },

  included() {
    let addonInvokables = Object.keys(this.app.project.addonPackages).map((name) => {
      let addon = this.app.project.addonPackages[name];
      let addonAbsPath = addon.path;
      return [].concat(
        this._reservedPaths(`${addonAbsPath}/app/helpers`, 'js'),
        this._reservedPaths(`${addonAbsPath}/app/components`, 'js')
      );
    });

    let appHelpers = this._reservedPaths(`${this.app.project.root}/app/helpers`, 'js')
    let appComponentTemplates = this._reservedPaths(`${this.app.project.root}/app/templates/components`, 'hbs');
    let appComponentJS = this._reservedPaths(`${this.app.project.root}/app/components`, 'js');

    console.log(appComponentTemplates, appComponentJS);

    let reservedNames =  [].concat('outlet', 'yield', 'input', ...addonInvokables, ...appHelpers, ...appComponentTemplates, ...appComponentJS);

    this.app.registry.add('htmlbars-ast-plugin', {
      name: 'rfc-308',
      plugin: transform(reservedNames)
    });
  }
};
