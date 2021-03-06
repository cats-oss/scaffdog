/// <reference types="./types/safe-eval" />
import eval from 'safe-eval';
import * as cc from 'change-case';
import dayjs from 'dayjs';
import type { Context, HelperMap } from '@scaffdog/types';

export const helpers: HelperMap = new Map();

/**
 * string utils
 */
helpers.set('camel', (_: Context, v: string) => cc.camelCase(v));

helpers.set('snake', (_: Context, v: string) => cc.snakeCase(v));

helpers.set('pascal', (_: Context, v: string) => cc.pascalCase(v));

helpers.set('kebab', (_: Context, v: string) => cc.paramCase(v));

helpers.set('constant', (_: Context, v: string) => cc.constantCase(v));

helpers.set('upper', (_: Context, v: string) => v.toUpperCase());

helpers.set('lower', (_: Context, v: string) => v.toLowerCase());

helpers.set(
  'replace',
  (_: Context, v: string, pattern: string, replacement: string) =>
    v.replace(new RegExp(pattern, 'g'), replacement),
);

helpers.set('trim', (_: Context, v: string) => v.trim());

helpers.set('ltrim', (_: Context, v: string) => v.trimStart());

helpers.set('rtrim', (_: Context, v: string) => v.trimEnd());

/**
 * date
 */
helpers.set('date', (_: Context, format?: string) => {
  const d = dayjs();

  return format ? d.format(format) : d.toISOString();
});

/**
 * language
 */
helpers.set('eval', (ctx: Context, v: string, code?: string) => {
  const evalCode = code != null ? code : v;
  const context: { [key: string]: any } = {};

  for (const [key, value] of ctx.variables.entries()) {
    context[key] = value;
  }

  return eval(evalCode, context);
});

/**
 * template helpers
 */
helpers.set('noop', () => '');

helpers.set('define', (ctx: Context, v: string, key: string) => {
  ctx.variables.set(key, v);
  return '';
});
