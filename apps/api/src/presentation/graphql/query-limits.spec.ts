import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { buildSchema, parse, validate } from 'graphql'
import { queryLimitsRule } from './query-limits'

const schema = buildSchema(`
  type Query { assets: [Asset!]! asset(id: ID!): Asset }
  type Asset { id: ID! name: String! tasks: [Task!]! owner: Asset }
  type Task { id: ID! title: String! asset: Asset }
`)

function errorsOf(query: string, limits = { maxDepth: 4, maxCost: 1000, listFactor: 10 }) {
  return validate(schema, parse(query), [queryLimitsRule(limits)]).map((e) => e.message.split(' ')[1])
}

describe('queryLimitsRule', () => {
  it('accepts a query within both limits', () => {
    expect(errorsOf('{ assets { id tasks { id title } } }')).toEqual([])
  })

  it('rejects a query nested deeper than the limit, also through fragments', () => {
    expect(errorsOf('{ asset(id: "1") { owner { owner { owner { owner { id } } } } } }')).toEqual(['depth'])
    const viaFragment = `
      query { asset(id: "1") { ...Deep } }
      fragment Deep on Asset { owner { owner { owner { owner { id } } } } }`
    expect(errorsOf(viaFragment)).toEqual(['depth'])
  })

  it('multiplies the cost of a list field by the list factor', () => {
    // assets (1) + 10 x [id + tasks (1) + 10 x (id + title)] = 1 + 10 x 22 = 221
    expect(
      errorsOf('{ assets { id tasks { id title } } }', { maxDepth: 9, maxCost: 220, listFactor: 10 }),
    ).toEqual(['cost'])
    expect(
      errorsOf('{ assets { id tasks { id title } } }', { maxDepth: 9, maxCost: 221, listFactor: 10 }),
    ).toEqual([])
  })

  it('treats aliases as separate fields, so repeating a field many times costs', () => {
    const aliases = Array.from({ length: 101 }, (_, i) => `a${i}: asset(id: "1") { id }`).join(' ')
    expect(errorsOf(`{ ${aliases} }`, { maxDepth: 9, maxCost: 200, listFactor: 10 })).toEqual(['cost'])
  })

  it('does not count introspection and survives a fragment cycle', () => {
    expect(errorsOf('{ __schema { types { fields { type { ofType { ofType { name } } } } } } }')).toEqual([])
    const cyclic = 'query { asset(id: "1") { ...A } } fragment A on Asset { owner { ...A } }'
    expect(errorsOf(cyclic)).toEqual([])
  })

  it('lets every operation of the web app through with the default limits', () => {
    const root = join(__dirname, '..', '..', '..', '..', 'web', 'src')
    const sources = readdirSync(root, { recursive: true, encoding: 'utf8' })
      .filter((f) => f.endsWith('.tsx') && !f.startsWith('gql'))
      .map((f) => readFileSync(join(root, f), 'utf8'))
    const documents = sources.flatMap((s) => [...s.matchAll(/graphql\(`([\s\S]*?)`\)/g)].map((m) => m[1]))
    expect(documents.length).toBeGreaterThan(3)
    const real = buildSchema(readFileSync(join(__dirname, '..', '..', '..', 'schema.gql'), 'utf8'))
    expect(validate(real, parse(documents.join('\n')), [queryLimitsRule()])).toEqual([])
  })
})
