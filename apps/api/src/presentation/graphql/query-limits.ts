import {
  type ASTVisitor,
  type FragmentDefinitionNode,
  getNamedType,
  getNullableType,
  GraphQLError,
  type GraphQLNamedType,
  isInterfaceType,
  isListType,
  isObjectType,
  Kind,
  type OperationDefinitionNode,
  type SelectionSetNode,
  type ValidationContext,
  type ValidationRule,
} from 'graphql'

export interface QueryLimits {
  /** Deepest field nesting allowed; `assets { tasks { reminders { id } } }` has depth 4. */
  readonly maxDepth: number
  /** Highest estimated cost: one per field, a list field's selection counted `listFactor` times. */
  readonly maxCost: number
  readonly listFactor: number
}

export const DEFAULT_QUERY_LIMITS: QueryLimits = { maxDepth: 8, maxCost: 5000, listFactor: 10 }

interface Measure {
  readonly depth: number
  readonly cost: number
}

/** Walks one selection set with fragments inlined; type info comes from the schema, not from the client. */
class Measurer {
  constructor(
    private readonly context: ValidationContext,
    private readonly fragments: ReadonlyMap<string, FragmentDefinitionNode>,
    private readonly listFactor: number,
  ) {}

  measure(set: SelectionSetNode, parent: GraphQLNamedType | undefined, seen: ReadonlySet<string>): Measure {
    let depth = 0
    let cost = 0
    for (const selection of set.selections) {
      const inner = this.measureSelection(selection, parent, seen)
      depth = Math.max(depth, inner.depth)
      cost += inner.cost
    }
    return { depth, cost }
  }

  private measureSelection(
    selection: SelectionSetNode['selections'][number],
    parent: GraphQLNamedType | undefined,
    seen: ReadonlySet<string>,
  ): Measure {
    if (selection.kind === Kind.FIELD) {
      if (selection.name.value.startsWith('__')) return { depth: 0, cost: 0 }
      const field =
        parent && (isObjectType(parent) || isInterfaceType(parent))
          ? parent.getFields()[selection.name.value]
          : undefined
      if (!selection.selectionSet) return { depth: 1, cost: 1 }
      const child = this.measure(selection.selectionSet, field && getNamedType(field.type), seen)
      const isList = field !== undefined && isListType(getNullableType(field.type))
      return { depth: child.depth + 1, cost: 1 + child.cost * (isList ? this.listFactor : 1) }
    }
    if (selection.kind === Kind.INLINE_FRAGMENT) {
      const condition = selection.typeCondition
        ? this.context.getSchema().getType(selection.typeCondition.name.value)
        : parent
      return this.measure(selection.selectionSet, condition ?? undefined, seen)
    }
    const name = selection.name.value
    const fragment = this.fragments.get(name)
    if (!fragment || seen.has(name)) return { depth: 0, cost: 0 } // unknown or cyclic: other rules report it
    const condition = this.context.getSchema().getType(fragment.typeCondition.name.value)
    return this.measure(fragment.selectionSet, condition ?? undefined, new Set([...seen, name]))
  }
}

function rootType(
  context: ValidationContext,
  operation: OperationDefinitionNode,
): GraphQLNamedType | undefined {
  const schema = context.getSchema()
  const root = schema.getRootType(operation.operation)
  return root ?? undefined
}

/**
 * A validation rule that rejects queries deeper or costlier than the limits before any resolver runs, so a
 * client cannot ask for assets -> tasks -> reminders ... a thousand times over in one request.
 * Introspection fields are free, so GraphQL tools keep working.
 */
export function queryLimitsRule(limits: QueryLimits = DEFAULT_QUERY_LIMITS): ValidationRule {
  return (context: ValidationContext): ASTVisitor => {
    const fragments = new Map<string, FragmentDefinitionNode>()
    for (const definition of context.getDocument().definitions) {
      if (definition.kind === Kind.FRAGMENT_DEFINITION) fragments.set(definition.name.value, definition)
    }
    const measurer = new Measurer(context, fragments, limits.listFactor)
    return {
      OperationDefinition(operation) {
        const { depth, cost } = measurer.measure(
          operation.selectionSet,
          rootType(context, operation),
          new Set(),
        )
        if (depth > limits.maxDepth) {
          context.reportError(
            new GraphQLError(`Query depth ${depth} exceeds the limit of ${limits.maxDepth}`, {
              nodes: [operation],
            }),
          )
        }
        if (cost > limits.maxCost) {
          context.reportError(
            new GraphQLError(`Query cost ${cost} exceeds the limit of ${limits.maxCost}`, {
              nodes: [operation],
            }),
          )
        }
      },
    }
  }
}
