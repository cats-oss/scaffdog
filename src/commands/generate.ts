import { Command, flags } from '@oclif/command';
import chalk from 'chalk';
import { clear } from 'console';
import * as fs from 'fs';
import globby from 'globby';
import * as inquirer from 'inquirer';
import * as symbols from 'log-symbols';
import mkdirp from 'mkdirp';
import { emojify } from 'node-emoji';
import * as path from 'path';
import * as windowSize from 'window-size';
import { commonFlags } from '../flags';
import { Compiler } from '../template/compiler';
import { createContext } from '../template/context';
import { Reader, Resource } from '../template/reader';
import { fileExists } from '../utils';

export default class GenerateCommand extends Command {
  public static description =
    'Scaffold using the specified template. If you do not specify the template name and execute it, interactively select the template.';

  public static args = [{ name: 'templateName' }];

  public static flags = {
    ...commonFlags,
    dryRun: flags.boolean({
      char: 'n',
      description: 'Output the result to stdout.',
      default: false,
    }),
  };

  public async run() {
    const {
      args,
      flags: { templateDir, dryRun },
    } = this.parse(GenerateCommand);

    clear();

    let templateName = args.templateName;

    const cwd = process.cwd();
    const dir = path.resolve(cwd, templateDir as string);
    const reader = new Reader(dir);
    const documents = reader.readAll();

    // prepare template name
    if (templateName == null) {
      if (documents.length < 1) {
        return this.error('Please create a template!', { exit: 1 });
      }

      const { choice } = await inquirer.prompt<{ choice: string }>([
        {
          name: 'choice',
          message: 'Please select a template',
          type: 'list',
          choices: documents.map(({ attributes }) => attributes.name),
        },
      ]);

      templateName = choice;
    }

    // search target document
    const document = documents.find(({ attributes }) => attributes.name === templateName);
    if (document == null) {
      return this.error(`template "${templateName}" does not exist.`, { exit: 1 });
    }

    // search target directories
    const root = path.resolve(cwd, document.attributes.root);

    let directories = globby.sync(path.join(root, document.attributes.output), {
      onlyFiles: false,
      onlyDirectories: true,
      ignore: document.attributes.ignore.map((ignore) => path.join(root, ignore)),
    });

    directories = [root, ...directories].map((directory) => path.join(path.relative(cwd, directory)));

    // prepare output & input
    const { dist, input } = await inquirer.prompt<{ dist: string; input: string }>([
      {
        name: 'dist',
        message: 'Please select the output destination directory.',
        type: 'list',
        choices: directories,
      },
      {
        name: 'input',
        message: document.attributes.message,
        type: 'input',
        validate: (v: string) => (v !== '' ? true : 'required input!'),
      },
    ]);

    const results = document.resources.map(({ filename, content }) => {
      const fname = Compiler.compile(
        createContext(document, new Map([['input', input], ['root', document.attributes.root]])),
        filename,
      );

      const output = path.join(dist, fname);
      const info = path.parse(output);

      return {
        filename: path.join(dist, fname),
        content: Compiler.compile(
          createContext(
            document,
            new Map([
              ['input', input],
              ['basename', info.base],
              ['filename', info.name],
              ['extname', info.ext],
              ['root', document.attributes.root],
              ['output', output],
            ]),
          ),
          content,
        ),
      };
    });

    return dryRun ? this.dryRun(results) : await this.writeFiles(results);
  }

  private dryRun(resources: Resource[]) {
    resources.forEach(({ filename, content }) => {
      this.log('');
      this.log(chalk.gray('-'.repeat(windowSize.width)));
      this.log(`${symbols.success}  File: ${chalk.bold(filename)}`);
      this.log(chalk.gray('-'.repeat(windowSize.width)));
      this.log(content);
      this.log('');
    });

    this.log('');

    return this.exit(0);
  }

  private async writeFiles(resources: Resource[]) {
    const writes = [];
    const skips = [];

    try {
      for (const { filename, content } of resources) {
        mkdirp.sync(path.dirname(filename));

        if (fileExists(filename)) {
          const { ok } = await inquirer.prompt([
            {
              name: 'ok',
              type: 'confirm',
              message: `Would you like to overwrite it? ("${filename}")`,
              prefix: `${symbols.warning} `,
              default: false,
            },
          ]);

          if (!ok) {
            skips.push(filename);
            continue;
          }
        }

        fs.writeFileSync(filename, content, 'utf8');

        writes.push(filename);
      }
    } catch (e) {
      this.error(e, { exit: 1 });
    }

    this.log(
      emojify(`
:sparkles: ${chalk.green('Completed scaffolding !')}
`),
    );

    writes.forEach((filename) => {
      this.log(`    ${symbols.success} ${chalk.bold(filename)}`);
    });

    skips.forEach((filename) => {
      this.log(`    ${symbols.warning} ${filename} ${chalk.gray('(skipped)')}`);
    });

    this.log('');

    return this.exit(0);
  }
}