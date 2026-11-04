#!/usr/bin/env node
// 静态检查显式邮箱谓词；不追踪运行时构造的 SQL、跨函数返回值或动态表名。
// 白名单按文件和完整谓词/SQL 匹配，避免一个例外放过同文件新增查询。
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as ts from 'typescript/unstable/ast'
import { createVirtualFileSystem } from 'typescript/unstable/fs'
import { API } from 'typescript/unstable/sync'

const rules = JSON.parse(readFileSync(new URL('./check-site-scope.rules.json', import.meta.url)))
const normalize = (text) => text.replace(/\s+/g, ' ').trim()
const predicates = new Set(['eq', 'ne', 'ilike', 'like', 'inArray', 'notInArray'])

export function isProductionSource(path) {
  return (
    /^(apps|packages)\/[^/]+\/src\//.test(path) &&
    /\.[cm]?[jt]sx?$/.test(path) &&
    !/\.(test|spec|d)\.[cm]?[jt]sx?$/.test(path) &&
    !/(^|\/)(__tests__|fixtures|__fixtures__|generated|paraglide)\//.test(path)
  )
}

function walk(node, fn) {
  fn(node)
  node.forEachChild((child) => walk(child, fn))
}

function callName(node) {
  if (!ts.isCallExpression(node)) return undefined
  return ts.isIdentifier(node.expression)
    ? node.expression.text
    : ts.isPropertyAccessExpression(node.expression)
      ? node.expression.name.text
      : undefined
}

// 子查询独立检查，不能把其 site 条件算作外层查询的条件。
function containsColumn(node, column, aliases) {
  let found = false
  function visit(current) {
    if (current !== node && ts.isCallExpression(current)) {
      if (['where', 'findFirst', 'findMany', 'select', 'exists'].includes(callName(current))) return
    }
    if (
      ts.isPropertyAccessExpression(current) &&
      current.name.text === column &&
      ts.isIdentifier(current.expression) &&
      aliases.has(current.expression.text)
    )
      found = true
    current.forEachChild(visit)
  }
  visit(node)
  return found
}

// 只保留 SQL 的标识符与操作符；值与注释不能伪装成站点条件。
function sqlTokens(text) {
  return (
    text.match(
      /--[^\n]*|\/\*[\s\S]*?\*\/|'(?:''|[^'])*'|"(?:""|[^"])*"|[a-z_][a-z_0-9]*|<>|!=|[().,;=<>]/gi,
    ) ?? []
  )
    .filter((token) => !/^(--|\/\*|')/.test(token))
    .map((token) => token.replace(/^"|"$/g, '').toLowerCase())
}

function unsafeSql(text) {
  const tokens = sqlTokens(text)
  // 每个 SELECT/UPDATE/DELETE 都有独立的 WHERE，括号内的子查询不向外提供条件。
  const depths = []
  let depth = 0
  for (const token of tokens) {
    if (token === ')') depth--
    depths.push(depth)
    if (token === '(') depth++
  }
  const unsafe = []
  for (let start = 0; start < tokens.length; start++) {
    if (!['select', 'update', 'delete'].includes(tokens[start])) continue
    const level = depths[start]
    let end = start + 1
    while (end < tokens.length && depths[end] >= level && tokens[end] !== ';') end++
    const query = []
    for (let i = start; i < end; i++) {
      if (depths[i] > level && ['select', 'update', 'delete'].includes(tokens[i])) {
        const nestedDepth = depths[i]
        while (i < end && depths[i] >= nestedDepth) i++
      }
      if (i < end) query.push(tokens[i])
    }
    const aliases = new Set(['user'])
    for (let i = 0; i < query.length; i++) {
      if (['from', 'join', 'update'].includes(query[i]) && query[i + 1] === 'user') {
        const alias = query[i + 2] === 'as' ? query[i + 3] : query[i + 2]
        if (
          alias &&
          !['where', 'join', 'on', 'set', 'left', 'right', 'inner', ')', ','].includes(alias)
        )
          aliases.add(alias)
      }
    }
    const where = query.indexOf('where')
    if (where < 0) continue
    const tail = query.slice(where + 1)
    const stop = tail.findIndex((token) =>
      ['order', 'group', 'limit', 'returning', 'having', 'union'].includes(token),
    )
    const conditions = stop < 0 ? tail : tail.slice(0, stop)
    const column = (name) =>
      conditions.some(
        (token, i) =>
          token === name &&
          (name !== 'site' || conditions[i + 1] === '=') &&
          ((conditions[i - 1] === '.' && aliases.has(conditions[i - 2])) ||
            (conditions[i - 1] !== '.' && aliases.size === 1 && query.includes('user'))),
      )
    if (column('email') && !column('site')) unsafe.push(start)
  }
  return unsafe.length > 0
}

function analyze(source) {
  const parents = new Map()
  const declarations = new Map()
  const aliases = new Set(['user'])
  walk(source, (node) => {
    node.forEachChild((child) => {
      parents.set(child, node)
    })
    if (ts.isImportSpecifier(node) && (node.propertyName ?? node.name).text === 'user')
      aliases.add(node.name.text)
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) {
      const entries = declarations.get(node.name.text) ?? []
      entries.push(node)
      declarations.set(node.name.text, entries)
    }
  })
  const resolveLocal = (node, seen = new Set()) => {
    if (!node || !ts.isIdentifier(node) || seen.has(node.text)) return node
    seen.add(node.text)
    const declaration = declarations.get(node.text)?.findLast((item) => item.pos < node.pos)
    return declaration ? resolveLocal(declaration.initializer, seen) : node
  }
  const results = new Map()
  const report = (node) =>
    results.set(node.pos, {
      line: source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1,
      query: normalize(node.getText(source)),
    })
  const scopeOf = (node) => {
    const localAliases = new Set(aliases)
    let scope
    let where = false
    for (let parent = parents.get(node); parent; parent = parents.get(parent)) {
      if (
        ts.isArrowFunction(parent) &&
        parent.parameters[0] &&
        ts.isIdentifier(parent.parameters[0].name)
      )
        localAliases.add(parent.parameters[0].name.text)
      if (ts.isCallExpression(parent) && callName(parent) === 'where') {
        scope = resolveLocal(parent.arguments[0])
        where = true
        break
      }
      if (ts.isPropertyAssignment(parent) && parent.name.getText(source) === 'where') {
        scope = parent.initializer
        where = true
        break
      }
      if (ts.isVariableDeclaration(parent)) {
        scope = parent.initializer
        break
      }
    }
    return { scope: scope ?? node, localAliases, where }
  }
  const sqlText = (node, localAliases) => {
    const template = node.template
    if (ts.isNoSubstitutionTemplateLiteral(template)) return template.text
    let text = template.head.text
    for (const span of template.templateSpans) {
      const expression = span.expression
      text +=
        ts.isPropertyAccessExpression(expression) &&
        ts.isIdentifier(expression.expression) &&
        localAliases.has(expression.expression.text)
          ? `user.${expression.name.text}`
          : '__value__'
      text += span.literal.text
    }
    return text
  }
  const hasSite = (scope, localAliases) => {
    let site = false
    const findSite = (candidate) => {
      if (
        candidate !== scope &&
        ['where', 'findFirst', 'findMany', 'select', 'exists'].includes(callName(candidate))
      )
        return
      if (callName(candidate) === 'eq' && containsColumn(candidate, 'site', localAliases))
        site = true
      // 用同一 SQL WHERE 分析器检查片段，防止嵌套 SELECT 或注释提供伪 site 条件。
      if (
        ts.isTaggedTemplateExpression(candidate) &&
        !unsafeSql(
          `select id from "user" where user.email=__value__ and (${sqlText(candidate, localAliases)})`,
        )
      )
        site = true
      candidate.forEachChild(findSite)
    }
    findSite(scope)
    return site
  }
  walk(source, (node) => {
    if (ts.isCallExpression(node) && predicates.has(callName(node))) {
      const { scope, localAliases } = scopeOf(node)
      // 独立构造的谓词也检查，避免把未约束片段藏在局部变量中。
      if (containsColumn(node, 'email', localAliases) && !hasSite(scope, localAliases))
        report(scope)
    }
    if (ts.isTaggedTemplateExpression(node)) {
      const { scope, localAliases, where } = scopeOf(node)
      const text = sqlText(node, localAliases)
      if (unsafeSql(text)) report(node)
      // Drizzle 的 where(sql`...`) 没有 SELECT，按当前 WHERE 的谓词片段检查。
      if (
        where &&
        unsafeSql(`select id from "user" where ${text}`) &&
        !hasSite(scope, localAliases)
      )
        report(scope)
    }
  })
  return [...results.values()]
}

export function checkSiteScope(root, paths, exceptions = rules) {
  const files = paths.filter(isProductionSource)
  if (!files.length) return []
  const configPath = '/site-scope-check/tsconfig.json'
  const virtual = Object.fromEntries(
    files.map((path) => [
      resolve('/site-scope-check', path),
      readFileSync(resolve(root, path), 'utf8'),
    ]),
  )
  const api = new API({
    cwd: '/site-scope-check',
    fs: createVirtualFileSystem({
      ...virtual,
      [configPath]: JSON.stringify({
        compilerOptions: { noLib: true, noResolve: true, allowJs: true, jsx: 'preserve' },
        files: Object.keys(virtual),
      }),
    }),
  })
  try {
    const snapshot = api.updateSnapshot({ openProjects: [configPath] })
    try {
      const program = snapshot.getProject(configPath).program
      return files.flatMap((path) =>
        analyze(program.getSourceFile(resolve('/site-scope-check', path)))
          .filter(
            (finding) =>
              !exceptions.some(
                (rule) =>
                  rule.path === path &&
                  rule.reason?.trim() &&
                  normalize(rule.query) === finding.query,
              ),
          )
          .map((finding) => ({
            path,
            ...finding,
            message: '按邮箱查用户必须在同一 WHERE 中限定 user.site',
          })),
      )
    } finally {
      snapshot.dispose()
    }
  } finally {
    api.close()
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = resolve(process.argv[2] ?? resolve(import.meta.dirname, '..'))
  const paths = [
    ...new Set(
      execFileSync('git', ['ls-files', '-co', '--exclude-standard', '-z'], {
        cwd: root,
        encoding: 'utf8',
      })
        .split('\0')
        .filter(Boolean),
    ),
  ]
  const findings = checkSiteScope(root, paths)
  for (const finding of findings)
    console.error(`${finding.path}:${finding.line}: ${finding.message}`)
  if (findings.length) process.exitCode = 1
  else
    console.log(
      `Site scope check passed (${paths.filter(isProductionSource).length} production files)`,
    )
}
